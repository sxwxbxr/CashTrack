import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { getDatabase } from "@/lib/db"
import {
  bulkUpsertAccounts,
  deleteAccount as deleteAccountRecord,
  getAccountById,
  getAccountByName,
  insertAccount,
  listAccounts as listAccountRecords,
  updateAccount as updateAccountRecord,
  type AccountFilters,
} from "@/lib/accounts/repository"
import type { Account, AccountWithBalance, CreateAccountInput, UpdateAccountInput } from "@/lib/accounts/types"
import { getAppSettings, ensureCurrencyTracked } from "@/lib/settings/service"
import { convertCurrency, normalizeCurrencyCode, roundAmount } from "@/lib/currency/service"

function normalizeName(name: string): string {
  return name.trim()
}

async function recalculateAccountTransactionAmounts(
  db: Database,
  accountName: string,
  accountCurrency: string,
) {
  const settings = await getAppSettings()
  const normalizedCurrency = normalizeCurrencyCode(accountCurrency || settings.baseCurrency)
  const transactions = db
    .prepare("SELECT id, originalAmount, currency FROM transactions WHERE account = ? COLLATE NOCASE")
    .all(accountName) as Array<{ id: string; originalAmount: number | null; currency: string | null }>

  if (transactions.length === 0) {
    return
  }

  const updateStatement = db.prepare("UPDATE transactions SET accountAmount = @accountAmount WHERE id = @id")

  for (const transaction of transactions) {
    const original = Number(transaction.originalAmount ?? 0)
    const transactionCurrency = normalizeCurrencyCode(transaction.currency ?? normalizedCurrency)
    let accountExchangeRate = 1
    try {
      accountExchangeRate = convertCurrency(1, transactionCurrency, normalizedCurrency, settings.currencyRates)
    } catch {
      accountExchangeRate = 1
    }
    const accountAmount = roundAmount(original * accountExchangeRate, 2)
    updateStatement.run({ id: transaction.id, accountAmount })
  }
}

export async function listAccounts(filters: AccountFilters = {}): Promise<Account[]> {
  return listAccountRecords(filters)
}

export async function listAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const db = getDatabase()
  const settings = await getAppSettings()
  const accounts = await listAccountRecords({}, db)
  const accountMap = new Map<string, AccountWithBalance>()

  accounts.forEach((account) => {
    accountMap.set(account.name.toLowerCase(), {
      ...account,
      balance: 0,
      inflow: 0,
      outflow: 0,
      transactions: 0,
      balanceInBase: 0,
      inflowInBase: 0,
      outflowInBase: 0,
    })
  })

  const rows = db
    .prepare(
      `SELECT
         account AS name,
         SUM(CASE WHEN accountAmount > 0 THEN accountAmount ELSE 0 END) AS accountInflow,
         SUM(CASE WHEN accountAmount < 0 THEN ABS(accountAmount) ELSE 0 END) AS accountOutflow,
         SUM(accountAmount) AS accountBalance,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS baseInflow,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS baseOutflow,
         SUM(amount) AS baseBalance,
         COUNT(id) AS transactions
       FROM transactions
       GROUP BY account`,
    )
    .all() as Array<{
      name: string | null
      accountInflow: number | null
      accountOutflow: number | null
      accountBalance: number | null
      baseInflow: number | null
      baseOutflow: number | null
      baseBalance: number | null
      transactions: number | null
    }>

  for (const row of rows) {
    const name = (row.name ?? "Unspecified").trim() || "Unspecified"
    const key = name.toLowerCase()
    const accountInflow = Number(row.accountInflow ?? 0)
    const accountOutflow = Number(row.accountOutflow ?? 0)
    const accountBalance = Number(row.accountBalance ?? 0)
    const baseInflow = Number(row.baseInflow ?? 0)
    const baseOutflow = Number(row.baseOutflow ?? 0)
    const baseBalance = Number(row.baseBalance ?? 0)
    const transactions = Number(row.transactions ?? 0)

    const existing = accountMap.get(key)
    if (existing) {
      existing.inflow = accountInflow
      existing.outflow = accountOutflow
      existing.balance = accountBalance
      existing.transactions = transactions
      existing.inflowInBase = baseInflow
      existing.outflowInBase = baseOutflow
      existing.balanceInBase = baseBalance
      continue
    }

    const ensured = await ensureAccountExists(name, db, settings.baseCurrency)
    accountMap.set(ensured.name.toLowerCase(), {
      ...ensured,
      inflow: accountInflow,
      outflow: accountOutflow,
      balance: accountBalance,
      transactions,
      inflowInBase: baseInflow,
      outflowInBase: baseOutflow,
      balanceInBase: baseBalance,
    })
  }

  return Array.from(accountMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  )
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const name = normalizeName(input.name)
  if (!name) {
    throw new Error("Account name is required")
  }

  const existing = await getAccountByName(name)
  if (existing) {
    throw new Error("An account with this name already exists")
  }

  const settings = await getAppSettings()
  const normalizedCurrency = normalizeCurrencyCode(input.currency ?? settings.baseCurrency)
  if (!normalizedCurrency) {
    throw new Error("Invalid currency code")
  }

  const account = await insertAccount({ id: `acct_${randomUUID()}`, name, currency: normalizedCurrency })
  await ensureCurrencyTracked(normalizedCurrency)
  return account
}

export async function updateAccount(id: string, updates: UpdateAccountInput): Promise<Account> {
  const existing = await getAccountById(id)
  if (!existing) {
    throw new Error("Account not found")
  }

  const changes: { name?: string; currency?: string } = {}
  let normalizedName = existing.name
  let normalizedCurrency = existing.currency

  if (updates.name) {
    const trimmed = normalizeName(updates.name)
    if (!trimmed) {
      throw new Error("Account name is required")
    }
    const duplicate = await getAccountByName(trimmed)
    if (duplicate && duplicate.id !== id) {
      throw new Error("Another account already uses this name")
    }
    normalizedName = trimmed
    changes.name = trimmed
  }

  if (updates.currency) {
    const normalized = normalizeCurrencyCode(updates.currency)
    if (!normalized) {
      throw new Error("Invalid currency code")
    }
    normalizedCurrency = normalized
    changes.currency = normalized
  }

  if (!changes.name && !changes.currency) {
    return existing
  }

  const updated = await updateAccountRecord(id, changes)
  if (!updated) {
    throw new Error("Unable to update account")
  }

  const db = getDatabase()
  if (changes.name && updated.name !== existing.name) {
    db.prepare("UPDATE transactions SET account = ? WHERE account = ? COLLATE NOCASE").run(updated.name, existing.name)
  }

  if (changes.currency && normalizedCurrency !== existing.currency) {
    await ensureCurrencyTracked(normalizedCurrency)
    await recalculateAccountTransactionAmounts(db, updated.name, normalizedCurrency)
  }

  return updated
}

export async function deleteAccount(id: string): Promise<void> {
  const existing = await getAccountById(id)
  if (!existing) {
    throw new Error("Account not found")
  }

  const db = getDatabase()
  const usage = db
    .prepare("SELECT COUNT(*) as count FROM transactions WHERE account = ? COLLATE NOCASE")
    .get(existing.name) as { count: number | null } | undefined

  if (Number(usage?.count ?? 0) > 0) {
    throw new Error("Cannot delete an account with existing transactions")
  }

  const deleted = await deleteAccountRecord(id)
  if (!deleted) {
    throw new Error("Account not found")
  }
}

export async function ensureAccountExists(
  name: string,
  db?: Database,
  preferredCurrency?: string,
): Promise<Account> {
  const normalized = normalizeName(name)
  if (!normalized) {
    throw new Error("Account name is required")
  }

  const existing = await getAccountByName(normalized, db)
  if (existing) {
    return existing
  }

  const settings = await getAppSettings()
  const resolvedCurrency = normalizeCurrencyCode(preferredCurrency ?? settings.baseCurrency)
  const account = await insertAccount({ id: `acct_${randomUUID()}`, name: normalized, currency: resolvedCurrency }, db)
  await ensureCurrencyTracked(resolvedCurrency)
  return account
}

export async function upsertAccounts(
  records: Array<{ id: string; name: string; currency?: string }>,
  db?: Database,
) {
  if (records.length === 0) {
    return
  }
  const settings = await getAppSettings()
  const normalizedRecords = await Promise.all(
    records.map(async (record) => {
      const currency = normalizeCurrencyCode(record.currency ?? settings.baseCurrency)
      await ensureCurrencyTracked(currency)
      return { id: record.id, name: normalizeName(record.name), currency }
    }),
  )
  await bulkUpsertAccounts(normalizedRecords, db)
}

export async function listAccountsForSync(updatedSince?: string): Promise<Account[]> {
  return listAccountRecords(updatedSince ? { updatedSince } : {})
}
