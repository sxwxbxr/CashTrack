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

function normalizeName(name: string): string {
  return name.trim()
}

export async function listAccounts(filters: AccountFilters = {}): Promise<Account[]> {
  return listAccountRecords(filters)
}

export async function listAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const db = getDatabase()
  const accounts = await listAccountRecords({}, db)
  const accountMap = new Map<string, AccountWithBalance>()

  accounts.forEach((account) => {
    accountMap.set(account.name.toLowerCase(), {
      ...account,
      balance: 0,
      inflow: 0,
      outflow: 0,
      transactions: 0,
    })
  })

  const rows = db
    .prepare(
      `SELECT
         account AS name,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS outflow,
         SUM(amount) AS balance,
         COUNT(id) AS transactions
       FROM transactions
       GROUP BY account`,
    )
    .all() as Array<{
      name: string | null
      inflow: number | null
      outflow: number | null
      balance: number | null
      transactions: number | null
    }>

  for (const row of rows) {
    const name = (row.name ?? "Unspecified").trim() || "Unspecified"
    const key = name.toLowerCase()
    const inflow = Number(row.inflow ?? 0)
    const outflow = Number(row.outflow ?? 0)
    const balance = Number(row.balance ?? 0)
    const transactions = Number(row.transactions ?? 0)

    const existing = accountMap.get(key)
    if (existing) {
      existing.inflow = inflow
      existing.outflow = outflow
      existing.balance = balance
      existing.transactions = transactions
      continue
    }

    const ensured = await ensureAccountExists(name, db)
    accountMap.set(ensured.name.toLowerCase(), {
      ...ensured,
      inflow,
      outflow,
      balance,
      transactions,
    })
  }

  return Array.from(accountMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
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

  return insertAccount({ id: `acct_${randomUUID()}`, name })
}

export async function updateAccount(id: string, updates: UpdateAccountInput): Promise<Account> {
  const existing = await getAccountById(id)
  if (!existing) {
    throw new Error("Account not found")
  }

  if (updates.name) {
    const normalized = normalizeName(updates.name)
    if (!normalized) {
      throw new Error("Account name is required")
    }
    const duplicate = await getAccountByName(normalized)
    if (duplicate && duplicate.id !== id) {
      throw new Error("Another account already uses this name")
    }
    const updated = await updateAccountRecord(id, { name: normalized })
    if (!updated) {
      throw new Error("Unable to update account")
    }
    const db = getDatabase()
    db.prepare("UPDATE transactions SET account = ? WHERE account = ? COLLATE NOCASE").run(updated.name, existing.name)
    return updated
  }

  return existing
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

export async function ensureAccountExists(name: string, db?: Database): Promise<Account> {
  const normalized = normalizeName(name)
  if (!normalized) {
    throw new Error("Account name is required")
  }

  const existing = await getAccountByName(normalized, db)
  if (existing) {
    return existing
  }

  return insertAccount({ id: `acct_${randomUUID()}`, name: normalized }, db)
}

export async function upsertAccounts(records: Array<{ id: string; name: string }>, db?: Database) {
  await bulkUpsertAccounts(records, db)
}

export async function listAccountsForSync(updatedSince?: string): Promise<Account[]> {
  return listAccountRecords(updatedSince ? { updatedSince } : {})
}
