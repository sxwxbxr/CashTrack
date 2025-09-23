import type Database from "better-sqlite3"

import { getDatabase, initDatabase } from "@/lib/db"
import { recordSyncLog } from "@/lib/db/sync-log"
import type { Account } from "@/lib/accounts/types"

const databaseReady = initDatabase()

interface AccountRow {
  id: string
  name: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface AccountFilters {
  ids?: string[]
  names?: string[]
  search?: string
  updatedSince?: string
}

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listAccounts(filters: AccountFilters = {}, db?: Database): Promise<Account[]> {
  const connection = await resolveDatabase(db)
  const clauses: string[] = []
  const parameters: unknown[] = []

  if (filters.ids?.length) {
    clauses.push(`id IN (${filters.ids.map(() => "?").join(", ")})`)
    parameters.push(...filters.ids)
  }

  if (filters.names?.length) {
    clauses.push(`name IN (${filters.names.map(() => "?").join(", ")})`)
    parameters.push(...filters.names)
  }

  if (filters.search) {
    clauses.push(`name LIKE ?`)
    parameters.push(`%${filters.search.replace(/%/g, "%%")}%`)
  }

  if (filters.updatedSince) {
    clauses.push(`updatedAt > ?`)
    parameters.push(filters.updatedSince)
  }

  let sql = "SELECT id, name, currency, createdAt, updatedAt FROM accounts"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }
  sql += " ORDER BY name COLLATE NOCASE"

  const rows = connection.prepare(sql).all(...parameters) as AccountRow[]
  return rows.map(mapRow)
}

export async function getAccountById(id: string, db?: Database): Promise<Account | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT id, name, currency, createdAt, updatedAt FROM accounts WHERE id = ?")
    .get(id) as AccountRow | undefined
  return row ? mapRow(row) : null
}

export async function getAccountByName(name: string, db?: Database): Promise<Account | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT id, name, currency, createdAt, updatedAt FROM accounts WHERE name = ? COLLATE NOCASE")
    .get(name) as AccountRow | undefined
  return row ? mapRow(row) : null
}

export interface CreateAccountRecord {
  id: string
  name: string
  currency: string
}

export interface UpdateAccountRecord {
  name?: string
  currency?: string
}

export async function insertAccount(record: CreateAccountRecord, db?: Database): Promise<Account> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: AccountRow = {
    ...record,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      "INSERT INTO accounts (id, name, currency, createdAt, updatedAt) VALUES (@id, @name, @currency, @createdAt, @updatedAt)",
    )
    .run(row)

  recordSyncLog(connection, "account", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateAccount(id: string, updates: UpdateAccountRecord, db?: Database): Promise<Account | null> {
  const connection = await resolveDatabase(db)
  const existing = await getAccountById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: AccountRow = {
    ...existing,
    ...updates,
    currency: updates.currency ?? existing.currency,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      "UPDATE accounts SET name = @name, currency = @currency, updatedAt = @updatedAt WHERE id = @id",
    )
    .run(updatedRow)

  recordSyncLog(connection, "account", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function deleteAccount(id: string, db?: Database): Promise<boolean> {
  const connection = await resolveDatabase(db)
  const result = connection.prepare("DELETE FROM accounts WHERE id = ?").run(id)
  if (result.changes > 0) {
    const timestamp = new Date().toISOString()
    recordSyncLog(connection, "account", id, timestamp)
    return true
  }
  return false
}

export async function bulkUpsertAccounts(records: CreateAccountRecord[], db?: Database): Promise<Account[]> {
  if (records.length === 0) {
    return []
  }

  const connection = await resolveDatabase(db)
  const statement = connection.prepare(
    `INSERT INTO accounts (id, name, currency, createdAt, updatedAt)
     VALUES (@id, @name, @currency, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       currency = excluded.currency,
       updatedAt = excluded.updatedAt`,
  )

  const results: Account[] = []
  for (const record of records) {
    const timestamp = new Date().toISOString()
      const row: AccountRow = {
        ...record,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    statement.run(row)
    recordSyncLog(connection, "account", row.id, row.updatedAt)
    results.push(mapRow(row))
  }

  return results
}
