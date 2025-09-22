import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import {
  bulkUpsertAccounts,
  getAccountById,
  getAccountByName,
  insertAccount,
  listAccounts as listAccountRecords,
  updateAccount as updateAccountRecord,
  type AccountFilters,
} from "@/lib/accounts/repository"
import type { Account, CreateAccountInput, UpdateAccountInput } from "@/lib/accounts/types"

function normalizeName(name: string): string {
  return name.trim()
}

export async function listAccounts(filters: AccountFilters = {}): Promise<Account[]> {
  return listAccountRecords(filters)
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
    return updated
  }

  return existing
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
