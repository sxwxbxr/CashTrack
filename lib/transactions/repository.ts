import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "../db"
import { recordSyncLog } from "../db/sync-log"
import type { Transaction, TransactionStatus, TransactionType } from "./types"

const databaseReady = initDatabase()

const ORDERABLE_COLUMNS = new Set(["date", "amount", "description", "createdAt", "updatedAt"])

interface TransactionRow {
  id: string
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  transferGroupId: string | null
  transferDirection: "in" | "out" | null
  createdAt: string
  updatedAt: string
}

export interface TransactionFilters {
  ids?: string[]
  search?: string
  categoryIds?: string[]
  categoryNames?: string[]
  statuses?: TransactionStatus[]
  accounts?: string[]
  types?: TransactionType[]
  transferGroupIds?: string[]
  startDate?: string
  endDate?: string
  updatedSince?: string
}

export interface TransactionQueryOptions {
  limit?: number
  offset?: number
  orderBy?: "date" | "amount" | "description" | "createdAt" | "updatedAt"
  orderDirection?: "asc" | "desc"
}

interface TransactionTotals {
  income: number
  expenses: number
  net: number
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    account: row.account,
    status: row.status,
    type: row.type,
    notes: row.notes ?? null,
    transferGroupId: row.transferGroupId ?? null,
    transferDirection: row.transferDirection ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function buildFilters(filters: TransactionFilters = {}) {
  const clauses: string[] = []
  const parameters: unknown[] = []

  if (filters.ids?.length) {
    clauses.push(`id IN (${filters.ids.map(() => "?").join(", ")})`)
    parameters.push(...filters.ids)
  }

  if (filters.search) {
    clauses.push(`(description LIKE ? OR categoryName LIKE ? OR account LIKE ?)`)
    const pattern = `%${filters.search.replace(/%/g, "%%")}%`
    parameters.push(pattern, pattern, pattern)
  }

  if (filters.categoryIds?.length) {
    clauses.push(`categoryId IN (${filters.categoryIds.map(() => "?").join(", ")})`)
    parameters.push(...filters.categoryIds)
  }

  if (filters.categoryNames?.length) {
    clauses.push(`categoryName IN (${filters.categoryNames.map(() => "?").join(", ")})`)
    parameters.push(...filters.categoryNames)
  }

  if (filters.statuses?.length) {
    clauses.push(`status IN (${filters.statuses.map(() => "?").join(", ")})`)
    parameters.push(...filters.statuses)
  }

  if (filters.accounts?.length) {
    clauses.push(`account IN (${filters.accounts.map(() => "?").join(", ")})`)
    parameters.push(...filters.accounts)
  }

  if (filters.types?.length) {
    clauses.push(`type IN (${filters.types.map(() => "?").join(", ")})`)
    parameters.push(...filters.types)
  }

  if (filters.transferGroupIds?.length) {
    clauses.push(`transferGroupId IN (${filters.transferGroupIds.map(() => "?").join(", ")})`)
    parameters.push(...filters.transferGroupIds)
  }

  if (filters.startDate) {
    clauses.push(`date >= ?`)
    parameters.push(filters.startDate)
  }

  if (filters.endDate) {
    clauses.push(`date <= ?`)
    parameters.push(filters.endDate)
  }

  if (filters.updatedSince) {
    clauses.push(`updatedAt > ?`)
    parameters.push(filters.updatedSince)
  }

  return { clauses, parameters }
}

export function buildTransactionFilterClause(filters: TransactionFilters = {}) {
  return buildFilters(filters)
}

export async function listTransactions(
  filters: TransactionFilters = {},
  options: TransactionQueryOptions = {},
  db?: Database
): Promise<Transaction[]> {
  const connection = await resolveDatabase(db)
  const { clauses, parameters } = buildFilters(filters)

  const orderByCandidate = options.orderBy ?? ""
  const orderBy = ORDERABLE_COLUMNS.has(orderByCandidate) ? orderByCandidate : "date"
  const orderDirection = (options.orderDirection ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC"

  let sql =
    "SELECT id, date, description, categoryId, categoryName, amount, account, status, type, notes, transferGroupId, transferDirection, createdAt, updatedAt FROM transactions"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }
  sql += ` ORDER BY ${orderBy} ${orderDirection}`

  if (typeof options.limit === "number") {
    sql += " LIMIT ?"
    parameters.push(options.limit)
    if (typeof options.offset === "number") {
      sql += " OFFSET ?"
      parameters.push(options.offset)
    }
  }

  const statement = connection.prepare(sql)
  const rows = statement.all(...parameters) as TransactionRow[]
  return rows.map(mapRow)
}

export async function countTransactions(filters: TransactionFilters = {}, db?: Database): Promise<number> {
  const connection = await resolveDatabase(db)
  const { clauses, parameters } = buildFilters(filters)
  let sql = "SELECT COUNT(*) as count FROM transactions"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }
  const result = connection.prepare(sql).get(...parameters) as { count: number }
  return result?.count ?? 0
}

export async function calculateTransactionTotals(
  filters: TransactionFilters = {},
  db?: Database
): Promise<TransactionTotals> {
  const connection = await resolveDatabase(db)
  const { clauses, parameters } = buildFilters(filters)
  let sql =
    "SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income, " +
    "SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) AS expenses, " +
    "SUM(amount) AS net FROM transactions"

  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }

  const result = connection.prepare(sql).get(...parameters) as TransactionTotals | undefined
  return {
    income: Number(result?.income ?? 0),
    expenses: Number(result?.expenses ?? 0),
    net: Number(result?.net ?? 0),
  }
}

export interface CreateTransactionRecord {
  id: string
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  transferGroupId: string | null
  transferDirection: "in" | "out" | null
}

export interface UpdateTransactionRecord {
  date?: string
  description?: string
  categoryId?: string | null
  categoryName?: string
  amount?: number
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string | null
  transferGroupId?: string | null
  transferDirection?: "in" | "out" | null
}

export async function getTransactionById(id: string, db?: Database): Promise<Transaction | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare(
      "SELECT id, date, description, categoryId, categoryName, amount, account, status, type, notes, transferGroupId, transferDirection, createdAt, updatedAt FROM transactions WHERE id = ?"
    )
    .get(id) as TransactionRow | undefined
  return row ? mapRow(row) : null
}

export async function insertTransaction(record: CreateTransactionRecord, db?: Database): Promise<Transaction> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: TransactionRow = {
    ...record,
    notes: record.notes ?? null,
    transferGroupId: record.transferGroupId ?? null,
    transferDirection: record.transferDirection ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      `INSERT INTO transactions (id, date, description, categoryId, categoryName, amount, account, status, type, notes, transferGroupId, transferDirection, createdAt, updatedAt)
       VALUES (@id, @date, @description, @categoryId, @categoryName, @amount, @account, @status, @type, @notes, @transferGroupId, @transferDirection, @createdAt, @updatedAt)`
    )
    .run(row)

  recordSyncLog(connection, "transaction", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateTransaction(
  id: string,
  updates: UpdateTransactionRecord,
  db?: Database
): Promise<Transaction | null> {
  const connection = await resolveDatabase(db)
  const existing = await getTransactionById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: TransactionRow = {
    ...existing,
    ...updates,
    notes: updates.notes ?? existing.notes ?? null,
    categoryId: updates.categoryId ?? existing.categoryId,
    categoryName: updates.categoryName ?? existing.categoryName,
    date: updates.date ?? existing.date,
    description: updates.description ?? existing.description,
    amount: updates.amount ?? existing.amount,
    account: updates.account ?? existing.account,
    status: updates.status ?? existing.status,
    type: updates.type ?? existing.type,
    transferGroupId: updates.transferGroupId ?? existing.transferGroupId,
    transferDirection: updates.transferDirection ?? existing.transferDirection,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      `UPDATE transactions
       SET date = @date,
           description = @description,
           categoryId = @categoryId,
           categoryName = @categoryName,
           amount = @amount,
           account = @account,
           status = @status,
           type = @type,
           notes = @notes,
           transferGroupId = @transferGroupId,
           transferDirection = @transferDirection,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(updatedRow)

  recordSyncLog(connection, "transaction", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function deleteTransaction(id: string, db?: Database): Promise<boolean> {
  const connection = await resolveDatabase(db)
  const statement = connection.prepare("DELETE FROM transactions WHERE id = ?")
  const result = statement.run(id)
  if (result.changes > 0) {
    const deletedAt = new Date().toISOString()
    recordSyncLog(connection, "transaction", id, deletedAt)
    return true
  }
  return false
}

export async function bulkInsertTransactions(records: CreateTransactionRecord[], db?: Database): Promise<Transaction[]> {
  if (records.length === 0) {
    return []
  }

  const insertMany = (connection: Database) => {
    const inserted: Transaction[] = []
    const statement = connection.prepare(
      `INSERT INTO transactions (id, date, description, categoryId, categoryName, amount, account, status, type, notes, transferGroupId, transferDirection, createdAt, updatedAt)
       VALUES (@id, @date, @description, @categoryId, @categoryName, @amount, @account, @status, @type, @notes, @transferGroupId, @transferDirection, @createdAt, @updatedAt)`
    )

    for (const record of records) {
      const timestamp = new Date().toISOString()
      const row: TransactionRow = {
        ...record,
        notes: record.notes ?? null,
        transferGroupId: record.transferGroupId ?? null,
        transferDirection: record.transferDirection ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      statement.run(row)
      recordSyncLog(connection, "transaction", row.id, row.updatedAt)
      inserted.push(mapRow(row))
    }

    return inserted
  }

  if (db) {
    return insertMany(db)
  }

  return withTransaction((connection) => insertMany(connection))
}
