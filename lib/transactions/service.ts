import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { initDatabase, withTransaction } from "@/lib/db"
import { ensureAccountExists } from "@/lib/accounts/service"
import { createAutomationRuleEvaluator } from "@/lib/categories/rule-matcher"
import { listAutomationRules } from "@/lib/categories/rule-repository"
import { getCategoryById, getCategoryByName, listCategories } from "@/lib/categories/repository"
import {
  bulkInsertTransactions,
  calculateTransactionTotals,
  countTransactions,
  CreateTransactionRecord,
  insertRecurringTransaction,
  deleteTransaction as deleteTransactionRecord,
  getRecurringTransactionByTemplateId,
  getTransactionById as getTransactionRecordById,
  insertTransaction as insertTransactionRecord,
  listTransactions as listTransactionRecords,
  listDueRecurringTransactions,
  RecurringTransactionRecord,
  RecurringTransactionUpdate,
  TransactionFilters,
  TransactionQueryOptions,
  updateRecurringTransactionById,
  updateRecurringTransactionByTemplateId,
  updateTransaction as updateTransactionRecord,
} from "@/lib/transactions/repository"
import type {
  CreateTransactionInput,
  CreateTransferInput,
  TransactionRecurrenceInput,
  ParsedCsvTransaction,
  Transaction,
  TransactionListParams,
  TransactionListResult,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from "@/lib/transactions/types"

void initDatabase()

const DEFAULT_PAGE_SIZE = 50
const VALID_STATUSES: TransactionStatus[] = ["pending", "completed", "cleared"]
const VALID_TYPES: TransactionType[] = ["income", "expense", "transfer"]
const MUTABLE_TRANSACTION_TYPES: TransactionType[] = ["income", "expense"]

const ORDERABLE_FIELDS: Record<string, TransactionQueryOptions["orderBy"]> = {
  date: "date",
  amount: "amount",
  description: "description",
}

type CsvMapping = {
  date: string
  description: string
  amount: string
  category?: string
  account?: string
  status?: string
  type?: string
  notes?: string
}

function normalizeDate(input: string): string {
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${input}`)
  }
  return parsed.toISOString().slice(0, 10)
}

function applyAmount(amount: number, type: TransactionType): number {
  if (type === "expense") {
    return -Math.abs(amount)
  }
  if (type === "income") {
    return Math.abs(amount)
  }
  return amount
}

function resolveStatus(status?: string): TransactionStatus {
  if (status && VALID_STATUSES.includes(status as TransactionStatus)) {
    return status as TransactionStatus
  }
  return "completed"
}

function resolveType(type?: string): TransactionType {
  if (type && VALID_TYPES.includes(type as TransactionType)) {
    return type as TransactionType
  }
  return "expense"
}

function addMonthsToDateString(date: string, months: number): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }
  const result = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months, parsed.getUTCDate()))
  return result.toISOString().slice(0, 10)
}

function normalizeRecurrence(
  recurrence: TransactionRecurrenceInput,
  transactionDate: string,
): { interval: number; startDate: string } {
  const rawInterval = Number.isFinite(recurrence.interval) ? Math.trunc(recurrence.interval) : 0
  const interval = Math.max(1, Math.min(120, rawInterval))
  const startDate = recurrence.startDate ? normalizeDate(recurrence.startDate) : transactionDate
  return { interval, startDate }
}

async function resolveCategoryReference(
  categoryId: string | null | undefined,
  categoryName: string | undefined,
  db?: Database,
): Promise<{ categoryId: string | null; categoryName: string }> {
  let resolvedId = categoryId ?? null
  let resolvedName = categoryName?.trim() ?? "Uncategorized"

  if (resolvedId) {
    const category = await getCategoryById(resolvedId, db)
    if (category) {
      resolvedName = category.name
    } else {
      resolvedId = null
    }
  }

  if (!resolvedId && resolvedName && resolvedName !== "Uncategorized") {
    const category = await getCategoryByName(resolvedName, db)
    if (category) {
      resolvedId = category.id
      resolvedName = category.name
    }
  }

  return { categoryId: resolvedId, categoryName: resolvedName || "Uncategorized" }
}

async function getAutomationEvaluator(db?: Database) {
  const [categories, rules] = await Promise.all([listCategories({}, db), listAutomationRules({}, db)])
  return createAutomationRuleEvaluator(rules, categories)
}

export async function reapplyAutomationRules(): Promise<number> {
  const transactions = await listTransactionRecords()
  if (transactions.length === 0) {
    return 0
  }

  const evaluator = await getAutomationEvaluator()
  let updatedCount = 0

  await withTransaction(async (db) => {
    for (const transaction of transactions) {
      const match = evaluator(transaction.description)
      if (!match) {
        continue
      }

      const sameCategory =
        transaction.categoryId === match.categoryId ||
        transaction.categoryName.toLowerCase() === match.categoryName.toLowerCase()

      if (sameCategory) {
        continue
      }

      const updated = await updateTransactionRecord(
        transaction.id,
        { categoryId: match.categoryId, categoryName: match.categoryName },
        db,
      )

      if (updated) {
        updatedCount += 1
      }
    }
  })

  return updatedCount
}

function buildFiltersFromParams(params: TransactionListParams): TransactionFilters {
  const filters: TransactionFilters = {}

  if (params.search) {
    filters.search = params.search
  }

  if (params.categoryId) {
    filters.categoryIds = [params.categoryId]
  }

  if (params.categoryName) {
    filters.categoryNames = [params.categoryName]
  }

  if (params.status && VALID_STATUSES.includes(params.status as TransactionStatus)) {
    filters.statuses = [params.status as TransactionStatus]
  }

  if (params.account) {
    filters.accounts = [params.account]
  }

  if (params.type && VALID_TYPES.includes(params.type as TransactionType)) {
    filters.types = [params.type as TransactionType]
  }

  if (params.startDate) {
    filters.startDate = params.startDate
  }

  if (params.endDate) {
    filters.endDate = params.endDate
  }

  return filters
}

export async function listTransactions(params: TransactionListParams): Promise<TransactionListResult> {
  const {
    sortField = "date",
    sortDirection = "desc",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params

  const safePage = Math.max(page, 1)
  const safePageSize = Math.max(Math.min(pageSize, 200), 1)
  const offset = (safePage - 1) * safePageSize

  await processRecurringTransactions()

  const filters = buildFiltersFromParams(params)
  const options: TransactionQueryOptions = {
    orderBy: ORDERABLE_FIELDS[sortField] ?? "date",
    orderDirection: sortDirection === "asc" ? "asc" : "desc",
    limit: safePageSize,
    offset,
  }

  const [transactions, total, totals] = await Promise.all([
    listTransactionRecords(filters, options),
    countTransactions(filters),
    calculateTransactionTotals(filters),
  ])

  return {
    transactions,
    total,
    page: safePage,
    pageSize: safePageSize,
    totals,
  }
}

async function prepareTransactionRecord(
  input: CreateTransactionInput,
  db?: Database,
): Promise<CreateTransactionRecord> {
  const normalizedDate = normalizeDate(input.date)
  const type = resolveType(input.type)
  const status = resolveStatus(input.status)
  const amount = applyAmount(input.amount, type)
  const notes = input.notes ?? null

  const evaluator = await getAutomationEvaluator(db)
  const baseCategory = await resolveCategoryReference(input.categoryId ?? null, input.categoryName, db)
  const matched = evaluator(input.description)
  const finalCategory = matched ?? baseCategory
  const account = await ensureAccountExists(input.account, db)

  return {
    id: `txn_${randomUUID()}`,
    date: normalizedDate,
    description: input.description,
    categoryId: finalCategory.categoryId,
    categoryName: finalCategory.categoryName,
    amount,
    account: account.name,
    status,
    type,
    notes,
    transferGroupId: null,
    transferDirection: null,
  }
}

async function scheduleRecurringTransaction(
  transaction: Transaction,
  recurrence: TransactionRecurrenceInput,
  db: Database,
): Promise<void> {
  if (transaction.type === "transfer") {
    return
  }

  const { interval, startDate } = normalizeRecurrence(recurrence, transaction.date)
  const lastOccurrence = transaction.date
  const nextOccurrence = addMonthsToDateString(lastOccurrence, interval)

  const record: RecurringTransactionRecord = {
    id: `rtxn_${randomUUID()}`,
    templateTransactionId: transaction.id,
    description: transaction.description,
    categoryId: transaction.categoryId,
    categoryName: transaction.categoryName,
    amount: Math.abs(transaction.amount),
    account: transaction.account,
    status: transaction.status,
    type: transaction.type,
    notes: transaction.notes ?? null,
    startDate,
    frequencyMonths: interval,
    nextOccurrence,
    lastOccurrence,
    isActive: true,
  }

  await insertRecurringTransaction(record, db)
}

export async function processRecurringTransactions(
  currentDate?: string,
  db?: Database,
): Promise<number> {
  const targetDate = currentDate ? normalizeDate(currentDate) : new Date().toISOString().slice(0, 10)

  const run = async (connection: Database): Promise<number> => {
    const schedules = await listDueRecurringTransactions(targetDate, connection)
    if (schedules.length === 0) {
      return 0
    }

    let created = 0

    for (const schedule of schedules) {
      const interval = Math.max(1, Math.trunc(schedule.frequencyMonths || 1))
      const occurrences: string[] = []
      let nextDate = schedule.nextOccurrence

      while (nextDate <= targetDate) {
        occurrences.push(nextDate)
        nextDate = addMonthsToDateString(nextDate, interval)
      }

      if (occurrences.length === 0) {
        continue
      }

      const ensuredAccount = await ensureAccountExists(schedule.account, connection)

      for (const occurrenceDate of occurrences) {
        const record: CreateTransactionRecord = {
          id: `txn_${randomUUID()}`,
          date: occurrenceDate,
          description: schedule.description,
          categoryId: schedule.categoryId,
          categoryName: schedule.categoryName,
          amount:
            schedule.type === "expense"
              ? -Math.abs(schedule.amount)
              : Math.abs(schedule.amount),
          account: ensuredAccount.name,
          status: schedule.status,
          type: schedule.type,
          notes: schedule.notes ?? null,
          transferGroupId: null,
          transferDirection: null,
        }

        await insertTransactionRecord(record, connection)
        created += 1
      }

      const update: RecurringTransactionUpdate = {
        nextOccurrence: nextDate,
        lastOccurrence: occurrences[occurrences.length - 1],
      }

      await updateRecurringTransactionById(schedule.id, update, connection)
    }

    return created
  }

  if (db) {
    return run(db)
  }

  return withTransaction((connection) => run(connection))
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  if (input.type === "transfer") {
    throw new Error("Transfers must be created using the transfer workflow")
  }

  return withTransaction(async (db) => {
    const record = await prepareTransactionRecord(input, db)
    const transaction = await insertTransactionRecord(record, db)
    if (input.recurrence) {
      await scheduleRecurringTransaction(transaction, input.recurrence, db)
    }
    return transaction
  })
}

export async function updateTransaction(id: string, updates: UpdateTransactionInput): Promise<Transaction> {
  return withTransaction(async (db) => {
    const existing = await getTransactionRecordById(id, db)
    if (!existing) {
      throw new Error("Transaction not found")
    }

    if (existing.type === "transfer") {
      throw new Error("Transfers cannot be edited. Delete the transfer and recreate it instead.")
    }

    if (updates.type === "transfer") {
      throw new Error("Transfers cannot be set via the standard transaction editor")
    }

    const type = updates.type ? resolveType(updates.type) : existing.type
    if (!MUTABLE_TRANSACTION_TYPES.includes(type)) {
      throw new Error("Unsupported transaction type")
    }
    let amount = existing.amount
    if (typeof updates.amount === "number") {
      amount = applyAmount(updates.amount, type)
    } else if (type !== existing.type) {
      amount = applyAmount(Math.abs(existing.amount), type)
    }

    const status = updates.status ? resolveStatus(updates.status) : existing.status
    const date = updates.date ? normalizeDate(updates.date) : existing.date
    const notes = updates.notes ?? existing.notes ?? null

    const evaluator = await getAutomationEvaluator(db)
    const baseCategory = await resolveCategoryReference(
      updates.categoryId ?? existing.categoryId,
      updates.categoryName ?? existing.categoryName,
      db,
    )
    const matched = evaluator(updates.description ?? existing.description)
    const finalCategory = matched ?? baseCategory
    let resolvedAccount = existing.account
    if (typeof updates.account === "string") {
      const ensuredAccount = await ensureAccountExists(updates.account, db)
      resolvedAccount = ensuredAccount.name
    }

    const updated = await updateTransactionRecord(
      id,
      {
        date,
        description: updates.description ?? existing.description,
        categoryId: finalCategory.categoryId,
        categoryName: finalCategory.categoryName,
        amount,
        account: resolvedAccount,
        status,
        type,
        notes,
        transferGroupId: existing.transferGroupId,
        transferDirection: existing.transferDirection,
      },
      db,
    )

    if (!updated) {
      throw new Error("Transaction not found")
    }

    const recurring = await getRecurringTransactionByTemplateId(id, db)
    if (recurring) {
      const recurrenceUpdates: RecurringTransactionUpdate = {
        description: updated.description,
        categoryId: updated.categoryId,
        categoryName: updated.categoryName,
        amount: Math.abs(updated.amount),
        account: updated.account,
        status: updated.status,
        type: updated.type,
        notes: updated.notes ?? null,
      }

      await updateRecurringTransactionByTemplateId(id, recurrenceUpdates, db)
    }

    return updated
  })
}

async function deleteTransferGroup(groupId: string): Promise<number> {
  return withTransaction(async (db) => {
    const related = await listTransactionRecords({ transferGroupIds: [groupId] }, {}, db)
    if (related.length === 0) {
      return 0
    }

    let deletedCount = 0
    for (const transaction of related) {
      const deleted = await deleteTransactionRecord(transaction.id, db)
      if (deleted) {
        deletedCount += 1
      }
    }
    return deletedCount
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await getTransactionRecordById(id)
  if (!existing) {
    throw new Error("Transaction not found")
  }

  if (existing.type === "transfer" && existing.transferGroupId) {
    const deletedCount = await deleteTransferGroup(existing.transferGroupId)
    if (deletedCount === 0) {
      throw new Error("Transfer not found")
    }
    return
  }

  const deleted = await withTransaction(async (db) => deleteTransactionRecord(id, db))
  if (!deleted) {
    throw new Error("Transaction not found")
  }
}

function formatTransferDescription(base: string, direction: "in" | "out", counterparty: string) {
  const normalized = base.trim()
  if (!normalized) {
    return direction === "out" ? `Transfer to ${counterparty}` : `Transfer from ${counterparty}`
  }
  return direction === "out" ? `${normalized} → ${counterparty}` : `${normalized} ← ${counterparty}`
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<{ transferId: string; transactions: [Transaction, Transaction] }> {
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be greater than zero")
  }

  if (input.fromAccount.trim().toLowerCase() === input.toAccount.trim().toLowerCase()) {
    throw new Error("Choose two different accounts for a transfer")
  }

  const normalizedDate = normalizeDate(input.date)
  const status = resolveStatus(input.status)
  const notes = input.notes?.trim() ? input.notes.trim() : null

  return withTransaction(async (db) => {
    const [fromAccount, toAccount] = await Promise.all([
      ensureAccountExists(input.fromAccount, db),
      ensureAccountExists(input.toAccount, db),
    ])

    const transferId = `trf_${randomUUID()}`

    const outgoingRecord: CreateTransactionRecord = {
      id: `txn_${randomUUID()}`,
      date: normalizedDate,
      description: formatTransferDescription(input.description, "out", toAccount.name),
      categoryId: null,
      categoryName: "Transfer",
      amount: -Math.abs(amount),
      account: fromAccount.name,
      status,
      type: "transfer",
      notes,
      transferGroupId: transferId,
      transferDirection: "out",
    }

    const incomingRecord: CreateTransactionRecord = {
      id: `txn_${randomUUID()}`,
      date: normalizedDate,
      description: formatTransferDescription(input.description, "in", fromAccount.name),
      categoryId: null,
      categoryName: "Transfer",
      amount: Math.abs(amount),
      account: toAccount.name,
      status,
      type: "transfer",
      notes,
      transferGroupId: transferId,
      transferDirection: "in",
    }

    const [outgoing, incoming] = await Promise.all([
      insertTransactionRecord(outgoingRecord, db),
      insertTransactionRecord(incomingRecord, db),
    ])

    return { transferId, transactions: [outgoing, incoming] }
  })
}

export function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false

  const pushValue = () => {
    currentRow.push(currentValue)
    currentValue = ""
  }

  const pushRow = () => {
    if (currentRow.length > 0 || currentValue.length > 0) {
      pushValue()
      rows.push(currentRow)
      currentRow = []
    }
  }

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (char === "\"") {
      if (inQuotes && content[i + 1] === "\"") {
        currentValue += "\""
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      pushValue()
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") {
        i++
      }
      pushRow()
    } else {
      currentValue += char
    }
  }

  pushRow()
  return rows.filter((row) => row.length > 0)
}

function sanitizeNumber(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").replace(/[()]/g, "")
  const amount = Number(cleaned)
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid amount: ${value}`)
  }
  if (value.includes("(") && value.includes(")")) {
    return -Math.abs(amount)
  }
  return amount
}

export function parseCsvTransactions(content: string, mapping: CsvMapping) {
  const rows = parseCsv(content.replace(/^\uFEFF/, ""))
  if (rows.length === 0) {
    return { transactions: [], errors: [] }
  }

  const [headerRow, ...dataRows] = rows
  const headerMap = new Map<string, number>()
  headerRow.forEach((header, index) => {
    headerMap.set(header.trim().toLowerCase(), index)
  })

  const requiredFields: Array<keyof CsvMapping> = ["date", "description", "amount"]
  for (const field of requiredFields) {
    const selected = mapping[field]
    if (!selected) {
      throw new Error(`Missing mapping for ${field}`)
    }
    if (!headerMap.has(selected.trim().toLowerCase())) {
      throw new Error(`Column ${selected} not found in CSV header`)
    }
  }

  const transactions: ParsedCsvTransaction[] = []
  const errors: Array<{ line: number; message: string }> = []

  dataRows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2
    try {
      const dateColumn = headerMap.get(mapping.date.trim().toLowerCase())!
      const descriptionColumn = headerMap.get(mapping.description.trim().toLowerCase())!
      const amountColumn = headerMap.get(mapping.amount.trim().toLowerCase())!

      const dateValue = row[dateColumn]?.trim()
      const descriptionValue = row[descriptionColumn]?.trim()
      const amountValue = row[amountColumn]?.trim()

      if (!dateValue || !descriptionValue || !amountValue) {
        throw new Error("Missing required values")
      }

      const date = normalizeDate(dateValue)
      const amount = sanitizeNumber(amountValue)
      const transactionType: TransactionType = amount >= 0 ? "income" : "expense"

      const parsed: ParsedCsvTransaction = {
        date,
        description: descriptionValue,
        amount: Math.abs(amount),
        type: transactionType,
      }

      if (mapping.category) {
        const categoryColumn = headerMap.get(mapping.category.trim().toLowerCase())
        if (typeof categoryColumn === "number") {
          const categoryValue = row[categoryColumn]?.trim()
          if (categoryValue) {
            parsed.categoryName = categoryValue
          }
        }
      }

      if (mapping.account) {
        const accountColumn = headerMap.get(mapping.account.trim().toLowerCase())
        if (typeof accountColumn === "number") {
          const accountValue = row[accountColumn]?.trim()
          if (accountValue) {
            parsed.account = accountValue
          }
        }
      }

      if (mapping.status) {
        const statusColumn = headerMap.get(mapping.status.trim().toLowerCase())
        if (typeof statusColumn === "number") {
          const statusValue = row[statusColumn]?.trim().toLowerCase()
          if (statusValue && VALID_STATUSES.includes(statusValue as TransactionStatus)) {
            parsed.status = statusValue as TransactionStatus
          }
        }
      }

      if (mapping.type) {
        const typeColumn = headerMap.get(mapping.type.trim().toLowerCase())
        if (typeof typeColumn === "number") {
          const typeValue = row[typeColumn]?.trim().toLowerCase()
          if (typeValue && VALID_TYPES.includes(typeValue as TransactionType)) {
            parsed.type = typeValue as TransactionType
          }
        }
      }

      if (mapping.notes) {
        const notesColumn = headerMap.get(mapping.notes.trim().toLowerCase())
        if (typeof notesColumn === "number") {
          const notesValue = row[notesColumn]?.trim()
          if (notesValue) {
            parsed.notes = notesValue
          }
        }
      }

      transactions.push(parsed)
    } catch (error) {
      errors.push({ line: lineNumber, message: (error as Error).message })
    }
  })

  return { transactions, errors }
}

export async function importTransactions(transactionsToImport: ParsedCsvTransaction[]) {
  if (transactionsToImport.length === 0) {
    return { imported: 0, skipped: 0 }
  }

  const existingTransactions = await listTransactionRecords()
  const existingKeys = new Set(
    existingTransactions.map((transaction) =>
      [transaction.date, transaction.description.toLowerCase(), transaction.amount, transaction.account.toLowerCase()].join("|"),
    ),
  )

  const evaluator = await getAutomationEvaluator()
  const accountCache = new Map<string, string>()

  const newRecords: CreateTransactionRecord[] = []

  for (const entry of transactionsToImport) {
    const type = resolveType(entry.type)
    const amount = applyAmount(entry.amount, type)
    const rawAccount = (entry.account ?? "Checking").trim()
    const candidateAccount = rawAccount || "Checking"
    const candidateKey = candidateAccount.toLowerCase()
    let ensuredAccount = accountCache.get(candidateKey)
    if (!ensuredAccount) {
      const ensured = await ensureAccountExists(candidateAccount)
      ensuredAccount = ensured.name
      accountCache.set(candidateKey, ensuredAccount)
      accountCache.set(ensuredAccount.toLowerCase(), ensuredAccount)
    }
    const account = ensuredAccount
    const status = resolveStatus(entry.status)
    const key = [entry.date, entry.description.toLowerCase(), amount, account.toLowerCase()].join("|")
    if (existingKeys.has(key)) {
      continue
    }
    existingKeys.add(key)

    const baseCategory = await resolveCategoryReference(entry.categoryId ?? null, entry.categoryName, undefined)
    const matched = evaluator(entry.description)
    const finalCategory = matched ?? baseCategory

    newRecords.push({
      id: `txn_${randomUUID()}`,
      date: entry.date,
      description: entry.description,
      categoryId: finalCategory.categoryId,
      categoryName: finalCategory.categoryName,
      amount,
      account,
      status,
      type,
      notes: entry.notes ?? null,
    })
  }

  if (newRecords.length > 0) {
    await bulkInsertTransactions(newRecords)
  }

  return {
    imported: newRecords.length,
    skipped: transactionsToImport.length - newRecords.length,
  }
}
