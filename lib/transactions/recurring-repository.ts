import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "@/lib/db"
import { recordSyncLog } from "@/lib/db/sync-log"
import type { RecurrenceUnit, RecurringTransaction } from "@/lib/transactions/types"

const databaseReady = initDatabase()

interface RecurringTransactionRow {
  id: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  exchangeRate: number
  account: string
  status: string
  type: string
  notes: string | null
  interval: number
  intervalUnit: RecurrenceUnit
  nextRunDate: string
  lastRunDate: string | null
  isActive: number
  createdAt: string
  updatedAt: string
}

export interface CreateRecurringTransactionRecord {
  id: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  exchangeRate: number
  account: string
  status: string
  type: string
  notes: string | null
  interval: number
  intervalUnit: RecurrenceUnit
  nextRunDate: string
  lastRunDate: string | null
}

export interface UpdateRecurringTransactionRecord {
  description?: string
  categoryId?: string | null
  categoryName?: string
  amount?: number
  accountAmount?: number
  originalAmount?: number
  currency?: string
  exchangeRate?: number
  account?: string
  status?: string
  type?: string
  notes?: string | null
  interval?: number
  intervalUnit?: RecurrenceUnit
  nextRunDate?: string
  lastRunDate?: string | null
  isActive?: boolean
}

function mapRow(row: RecurringTransactionRow): RecurringTransaction {
  return {
    id: row.id,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    accountAmount: row.accountAmount,
    originalAmount: row.originalAmount,
    currency: row.currency,
    exchangeRate: row.exchangeRate,
    account: row.account,
    status: row.status as RecurringTransaction["status"],
    type: row.type as RecurringTransaction["type"],
    notes: row.notes ?? null,
    interval: row.interval,
    unit: row.intervalUnit,
    nextRunDate: row.nextRunDate,
    lastRunDate: row.lastRunDate,
    isActive: row.isActive === 1,
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

export async function listRecurringTransactions(db?: Database): Promise<RecurringTransaction[]> {
  const connection = await resolveDatabase(db)
  const rows = connection
    .prepare(
      `SELECT id, description, categoryId, categoryName, amount, accountAmount, originalAmount, currency, exchangeRate, account,
              status, type, notes, interval, intervalUnit, nextRunDate, lastRunDate, isActive, createdAt, updatedAt
         FROM recurring_transactions
         ORDER BY createdAt ASC`,
    )
    .all() as RecurringTransactionRow[]
  return rows.map(mapRow)
}

export async function getRecurringTransactionById(id: string, db?: Database): Promise<RecurringTransaction | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare(
      `SELECT id, description, categoryId, categoryName, amount, accountAmount, originalAmount, currency, exchangeRate, account,
              status, type, notes, interval, intervalUnit, nextRunDate, lastRunDate, isActive, createdAt, updatedAt
         FROM recurring_transactions
         WHERE id = ?`,
    )
    .get(id) as RecurringTransactionRow | undefined
  return row ? mapRow(row) : null
}

export async function insertRecurringTransaction(
  record: CreateRecurringTransactionRecord,
  db?: Database,
): Promise<RecurringTransaction> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: RecurringTransactionRow = {
    ...record,
    status: record.status,
    type: record.type,
    notes: record.notes ?? null,
    isActive: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      `INSERT INTO recurring_transactions (
         id, description, categoryId, categoryName, amount, accountAmount, originalAmount, currency, exchangeRate, account,
         status, type, notes, interval, intervalUnit, nextRunDate, lastRunDate, isActive, createdAt, updatedAt
       ) VALUES (
         @id, @description, @categoryId, @categoryName, @amount, @accountAmount, @originalAmount, @currency, @exchangeRate, @account,
         @status, @type, @notes, @interval, @intervalUnit, @nextRunDate, @lastRunDate, @isActive, @createdAt, @updatedAt
       )`,
    )
    .run(row)

  recordSyncLog(connection, "recurring_transaction", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateRecurringTransaction(
  id: string,
  updates: UpdateRecurringTransactionRecord,
  db?: Database,
): Promise<RecurringTransaction | null> {
  const connection = await resolveDatabase(db)
  const existing = await getRecurringTransactionById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: RecurringTransactionRow = {
    ...existing,
    ...updates,
    notes: updates.notes === undefined ? existing.notes : updates.notes ?? null,
    interval: updates.interval ?? existing.interval,
    intervalUnit: updates.intervalUnit ?? existing.unit,
    nextRunDate: updates.nextRunDate ?? existing.nextRunDate,
    lastRunDate: updates.lastRunDate ?? existing.lastRunDate,
    isActive: updates.isActive === undefined ? (existing.isActive ? 1 : 0) : updates.isActive ? 1 : 0,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      `UPDATE recurring_transactions
         SET description = @description,
             categoryId = @categoryId,
             categoryName = @categoryName,
             amount = @amount,
             accountAmount = @accountAmount,
             originalAmount = @originalAmount,
             currency = @currency,
             exchangeRate = @exchangeRate,
             account = @account,
             status = @status,
             type = @type,
             notes = @notes,
             interval = @interval,
             intervalUnit = @intervalUnit,
             nextRunDate = @nextRunDate,
             lastRunDate = @lastRunDate,
             isActive = @isActive,
             updatedAt = @updatedAt
       WHERE id = @id`,
    )
    .run(updatedRow)

  recordSyncLog(connection, "recurring_transaction", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function deleteRecurringTransaction(id: string, db?: Database): Promise<boolean> {
  const connection = await resolveDatabase(db)
  const result = connection.prepare("DELETE FROM recurring_transactions WHERE id = ?").run(id)
  if (result.changes > 0) {
    const timestamp = new Date().toISOString()
    recordSyncLog(connection, "recurring_transaction", id, timestamp)
    return true
  }
  return false
}
