import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { initDatabase, recoverFromSchemaError, withTransaction } from "@/lib/db"
import { ensureAccountExists } from "@/lib/accounts/service"
import type { Account } from "@/lib/accounts/types"
import { createAutomationRuleEvaluator } from "@/lib/categories/rule-matcher"
import { listAutomationRules } from "@/lib/categories/rule-repository"
import { getCategoryById, getCategoryByName, listCategories } from "@/lib/categories/repository"
import { ensureCurrencyTracked, ensureFreshCurrencyRates, getAppSettings } from "@/lib/settings/service"
import { convertCurrency, ensureKnownCurrencies, normalizeCurrencyCode, roundAmount } from "@/lib/currency/service"
import { VALID_STATUSES, VALID_TYPES, normalizeDate } from "@/lib/transactions/import-utils"
import {
  bulkInsertTransactions,
  calculateTransactionTotals,
  countTransactions,
  CreateTransactionRecord,
  deleteTransaction as deleteTransactionRecord,
  getTransactionById as getTransactionRecordById,
  listTransactions as listTransactionRecords,
  TransactionFilters,
  TransactionQueryOptions,
  updateTransaction as updateTransactionRecord,
  insertTransaction as insertTransactionRecord,
} from "@/lib/transactions/repository"
import {
  deleteRecurringTransaction as deleteRecurringTransactionRecord,
  getRecurringTransactionById,
  insertRecurringTransaction,
  listRecurringTransactions as listRecurringTransactionRecords,
  updateRecurringTransaction as updateRecurringTransactionRecord,
} from "@/lib/transactions/recurring-repository"
import type {
  CreateTransactionInput,
  CreateTransferInput,
  ParsedCsvTransaction,
  RecurrenceInput,
  RecurrenceUnit,
  RecurringTransaction,
  Transaction,
  TransactionListParams,
  TransactionListResult,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from "@/lib/transactions/types"

void initDatabase()

function isSchemaError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return message.includes("no such table") || message.includes("no such column")
}

async function runWithDatabase<T>(operation: () => Promise<T>): Promise<T> {
  await initDatabase()
  try {
    return await operation()
  } catch (error) {
    if (isSchemaError(error)) {
      recoverFromSchemaError()
      return await operation()
    }
    throw error
  }
}

const DEFAULT_PAGE_SIZE = 50
const MUTABLE_TRANSACTION_TYPES: TransactionType[] = ["income", "expense"]

const ORDERABLE_FIELDS: Record<string, TransactionQueryOptions["orderBy"]> = {
  date: "date",
  amount: "amount",
  description: "description",
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

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
  const normalizedFrom = normalizeCurrencyCode(fromCurrency || "")
  const normalizedTo = normalizeCurrencyCode(toCurrency || "")
  if (!Number.isFinite(amount) || normalizedFrom === normalizedTo) {
    return roundAmount(Number(amount) || 0, 6)
  }
  try {
    return convertCurrency(amount, normalizedFrom, normalizedTo, rates)
  } catch {
    return roundAmount(Number(amount) || 0, 6)
  }
}

function resolveExchangeRate(fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
  const normalizedFrom = normalizeCurrencyCode(fromCurrency || "")
  const normalizedTo = normalizeCurrencyCode(toCurrency || "")
  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return 1
  }
  try {
    const rate = convertCurrency(1, normalizedFrom, normalizedTo, rates)
    return rate > 0 ? roundAmount(rate, 6) : 1
  } catch {
    return 1
  }
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

interface AmountComputationInput {
  account: string
  currency?: string | null
  amount?: number | null
  originalAmount?: number | null
  accountAmount?: number | null
  exchangeRate?: number | null
}

async function resolveTransactionAmounts(
  type: TransactionType,
  input: AmountComputationInput,
  db?: Database,
): Promise<{
  account: Account
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  exchangeRate: number
}> {
  const account = await ensureAccountExists(input.account, db, input.currency ?? undefined)
  let settings = await getAppSettings()
  const baseCurrency = normalizeCurrencyCode(settings.baseCurrency)
  const accountCurrency = normalizeCurrencyCode(account.currency || baseCurrency)
  let transactionCurrency = normalizeCurrencyCode(
    (input.currency && input.currency.trim()) || accountCurrency || baseCurrency,
  )
  if (!transactionCurrency) {
    transactionCurrency = baseCurrency
  }

  const requiredCurrencies = ensureKnownCurrencies(baseCurrency, [transactionCurrency, accountCurrency])
  await Promise.all(requiredCurrencies.map((code) => ensureCurrencyTracked(code)))
  settings = await ensureFreshCurrencyRates({ currencies: requiredCurrencies })

  const rates = settings.currencyRates
  const rawOriginal =
    typeof input.originalAmount === "number"
      ? input.originalAmount
      : typeof input.amount === "number"
      ? input.amount
      : 0
  const absoluteOriginal = Math.abs(Number(rawOriginal) || 0)
  const originalAmount = applyAmount(absoluteOriginal, type)

  const manualExchangeRate =
    typeof input.exchangeRate === "number" && Number.isFinite(input.exchangeRate) && input.exchangeRate > 0
      ? input.exchangeRate
      : null
  const exchangeRate = manualExchangeRate ?? resolveExchangeRate(transactionCurrency, baseCurrency, rates)
  const baseConverted = roundAmount(absoluteOriginal * exchangeRate, 2)
  const amount = applyAmount(baseConverted, type)

  const resolvedAccountAmount =
    typeof input.accountAmount === "number" && Number.isFinite(input.accountAmount)
      ? Math.abs(input.accountAmount)
      : roundAmount(convertAmount(absoluteOriginal, transactionCurrency, accountCurrency, rates), 2)
  const accountAmount = applyAmount(resolvedAccountAmount, type)

  return { account, amount, accountAmount, originalAmount, currency: transactionCurrency, exchangeRate }
}

function normalizeRecurrenceInterval(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) {
    return 1
  }
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : 1
}

function parseDateOnly(value: string): Date {
  const normalized = normalizeDate(value)
  const parsed = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }
  return parsed
}

function addRecurrenceInterval(date: string, interval: number, unit: RecurrenceUnit): string {
  const parsed = parseDateOnly(date)
  switch (unit) {
    case "day":
      parsed.setUTCDate(parsed.getUTCDate() + interval)
      break
    case "week":
      parsed.setUTCDate(parsed.getUTCDate() + interval * 7)
      break
    case "month":
      parsed.setUTCMonth(parsed.getUTCMonth() + interval)
      break
    case "year":
      parsed.setUTCFullYear(parsed.getUTCFullYear() + interval)
      break
    default:
      parsed.setUTCDate(parsed.getUTCDate() + interval)
      break
  }
  return parsed.toISOString().slice(0, 10)
}

function determineNextRunDate(
  lastRunDate: string,
  interval: number,
  unit: RecurrenceUnit,
  startDate?: string | null,
): string {
  if (startDate) {
    let candidate = normalizeDate(startDate)
    while (candidate <= lastRunDate) {
      candidate = addRecurrenceInterval(candidate, interval, unit)
    }
    return candidate
  }
  return addRecurrenceInterval(lastRunDate, interval, unit)
}

function normalizeRecurrenceInput(input: RecurrenceInput): RecurrenceInput {
  const interval = normalizeRecurrenceInterval(input.interval)
  const startDate = input.startDate ? normalizeDate(input.startDate) : undefined
  return { interval, unit: input.unit, startDate }
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
  return runWithDatabase(async () => {
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
  })
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
  return runWithDatabase(async () => {
    await processRecurringTransactions()
    const {
      sortField = "date",
      sortDirection = "desc",
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
    } = params

    const safePage = Math.max(page, 1)
    const safePageSize = Math.max(Math.min(pageSize, 200), 1)
    const offset = (safePage - 1) * safePageSize

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
  })
}

async function prepareTransactionRecord(
  input: CreateTransactionInput,
  db?: Database,
): Promise<CreateTransactionRecord> {
  const normalizedDate = normalizeDate(input.date)
  const type = resolveType(input.type)
  const status = resolveStatus(input.status)
  const notes = input.notes ?? null

  const evaluator = await getAutomationEvaluator(db)
  const baseCategory = await resolveCategoryReference(input.categoryId ?? null, input.categoryName, db)
  const matched = evaluator(input.description)
  const finalCategory = matched ?? baseCategory
  const { account, amount, accountAmount, originalAmount, currency, exchangeRate } =
    await resolveTransactionAmounts(type, {
      account: input.account,
      currency: input.currency,
      amount: input.amount,
      originalAmount: input.originalAmount,
      accountAmount: input.accountAmount,
      exchangeRate: input.exchangeRate,
    }, db)

  return {
    id: `txn_${randomUUID()}`,
    date: normalizedDate,
    description: input.description,
    categoryId: finalCategory.categoryId,
    categoryName: finalCategory.categoryName,
    amount,
    accountAmount,
    originalAmount,
    currency,
    exchangeRate,
    account: account.name,
    status,
    type,
    notes,
    transferGroupId: null,
    transferDirection: null,
  }
}

async function registerRecurringTransaction(
  transaction: Transaction,
  recurrence: RecurrenceInput,
  db: Database,
): Promise<void> {
  if (transaction.type === "transfer") {
    throw new Error("Recurring transfers are not supported")
  }

  const normalized = normalizeRecurrenceInput(recurrence)
  const interval = normalizeRecurrenceInterval(normalized.interval)
  const nextRunDate = determineNextRunDate(transaction.date, interval, normalized.unit, normalized.startDate)

  await insertRecurringTransaction(
    {
      id: `rcr_${randomUUID()}`,
      description: transaction.description,
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      amount: Math.abs(transaction.amount),
      accountAmount: Math.abs(transaction.accountAmount),
      originalAmount: Math.abs(transaction.originalAmount),
      currency: transaction.currency,
      exchangeRate: transaction.exchangeRate,
      account: transaction.account,
      status: transaction.status,
      type: transaction.type,
      notes: transaction.notes ?? null,
      interval,
      intervalUnit: normalized.unit,
      nextRunDate,
      lastRunDate: transaction.date,
    },
    db,
  )
}

async function processRecurringTransactions(referenceDate?: string): Promise<number> {
  const targetDate = referenceDate ? normalizeDate(referenceDate) : new Date().toISOString().slice(0, 10)
  return runWithDatabase(() =>
    withTransaction(async (db) => {
      const schedules = await listRecurringTransactionRecords(db)
      if (schedules.length === 0) {
        return 0
      }

      let createdCount = 0

      for (const schedule of schedules) {
        if (!schedule.isActive || !schedule.nextRunDate) {
          continue
        }
        if (schedule.type === "transfer") {
          continue
        }

        const interval = normalizeRecurrenceInterval(schedule.interval)
        let nextRunDate = schedule.nextRunDate
        let safety = 36
        while (nextRunDate && nextRunDate <= targetDate && safety > 0) {
          safety -= 1
          const amountDetails = await resolveTransactionAmounts(
            schedule.type,
            {
              account: schedule.account,
              currency: schedule.currency,
              amount: schedule.originalAmount,
              originalAmount: schedule.originalAmount,
            },
            db,
          )

          const record: CreateTransactionRecord = {
            id: `txn_${randomUUID()}`,
            date: nextRunDate,
            description: schedule.description,
            categoryId: schedule.categoryId,
            categoryName: schedule.categoryName,
            amount: amountDetails.amount,
            accountAmount: amountDetails.accountAmount,
            originalAmount: amountDetails.originalAmount,
            currency: amountDetails.currency,
            exchangeRate: amountDetails.exchangeRate,
            account: amountDetails.account.name,
            status: schedule.status,
            type: schedule.type,
            notes: schedule.notes,
            transferGroupId: null,
            transferDirection: null,
          }

          const created = await insertTransactionRecord(record, db)
          createdCount += 1

          const updatedNextRunDate = addRecurrenceInterval(nextRunDate, interval, schedule.unit)
          await updateRecurringTransactionRecord(
            schedule.id,
            {
              amount: Math.abs(created.amount),
              accountAmount: Math.abs(created.accountAmount),
              originalAmount: Math.abs(created.originalAmount),
              currency: created.currency,
              exchangeRate: created.exchangeRate,
              account: created.account,
              lastRunDate: nextRunDate,
              nextRunDate: updatedNextRunDate,
            },
            db,
          )

          nextRunDate = updatedNextRunDate
        }
      }

      return createdCount
    }),
  )
  }

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  if (input.type === "transfer") {
    throw new Error("Transfers must be created using the transfer workflow")
  }

  return runWithDatabase(() =>
    withTransaction(async (db) => {
      const record = await prepareTransactionRecord(input, db)
      const transaction = await insertTransactionRecord(record, db)
      if (input.recurrence) {
        await registerRecurringTransaction(transaction, input.recurrence, db)
      }
      return transaction
    }),
  )
}

export async function updateTransaction(id: string, updates: UpdateTransactionInput): Promise<Transaction> {
  return runWithDatabase(() =>
    withTransaction(async (db) => {
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

    const needsAmountRecalculation =
      type !== existing.type ||
      updates.amount !== undefined ||
      updates.originalAmount !== undefined ||
      updates.accountAmount !== undefined ||
      updates.currency !== undefined ||
      updates.account !== undefined ||
      updates.exchangeRate !== undefined

    let amount = existing.amount
    let accountAmount = existing.accountAmount
    let originalAmount = existing.originalAmount
    let currency = existing.currency
    let exchangeRate = existing.exchangeRate
    let resolvedAccount = existing.account

    if (needsAmountRecalculation) {
      const amountDetails = await resolveTransactionAmounts(
        type,
        {
          account: updates.account ?? existing.account,
          currency: updates.currency ?? existing.currency,
          amount:
            updates.originalAmount ??
            updates.amount ??
            Math.abs(existing.originalAmount),
          originalAmount: updates.originalAmount ?? Math.abs(existing.originalAmount),
          accountAmount: updates.accountAmount ?? undefined,
          exchangeRate: updates.exchangeRate ?? undefined,
        },
        db,
      )
      amount = amountDetails.amount
      accountAmount = amountDetails.accountAmount
      originalAmount = amountDetails.originalAmount
      currency = amountDetails.currency
      exchangeRate = amountDetails.exchangeRate
      resolvedAccount = amountDetails.account.name
    } else if (typeof updates.account === "string") {
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
        accountAmount,
        originalAmount,
        currency,
        exchangeRate,
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

      return updated
    }),
  )
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
  await runWithDatabase(async () => {
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
  })
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

  return runWithDatabase(() =>
    withTransaction(async (db) => {
      const [fromAccount, toAccount] = await Promise.all([
        ensureAccountExists(input.fromAccount, db),
        ensureAccountExists(input.toAccount, db),
      ])

      let settings = await getAppSettings()
      const baseCurrency = normalizeCurrencyCode(settings.baseCurrency)
      const fromCurrency = normalizeCurrencyCode(fromAccount.currency || baseCurrency)
      const toCurrency = normalizeCurrencyCode(toAccount.currency || baseCurrency)
      const requiredCurrencies = ensureKnownCurrencies(baseCurrency, [fromCurrency, toCurrency])
      await Promise.all(requiredCurrencies.map((code) => ensureCurrencyTracked(code)))
      settings = await ensureFreshCurrencyRates({ currencies: requiredCurrencies })

      const normalizedAmount = roundAmount(Math.abs(amount), 2)
      const outgoingExchangeRate = resolveExchangeRate(fromCurrency, baseCurrency, settings.currencyRates)
      const baseAmountAbs = roundAmount(normalizedAmount * outgoingExchangeRate, 2)
      const incomingExchangeRate = resolveExchangeRate(toCurrency, baseCurrency, settings.currencyRates)
      const incomingOriginalAbs =
        incomingExchangeRate === 0
          ? normalizedAmount
          : roundAmount(baseAmountAbs / incomingExchangeRate, 2)

      const transferId = `trf_${randomUUID()}`

      const outgoingRecord: CreateTransactionRecord = {
        id: `txn_${randomUUID()}`,
        date: normalizedDate,
        description: formatTransferDescription(input.description, "out", toAccount.name),
        categoryId: null,
        categoryName: "Transfer",
        amount: -baseAmountAbs,
        accountAmount: -normalizedAmount,
        originalAmount: -normalizedAmount,
        currency: fromCurrency,
        exchangeRate: outgoingExchangeRate,
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
        amount: baseAmountAbs,
        accountAmount: incomingOriginalAbs,
        originalAmount: incomingOriginalAbs,
        currency: toCurrency,
        exchangeRate: incomingExchangeRate,
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
    }),
  )
}

export interface UpdateRecurringScheduleInput {
  description?: string
  notes?: string | null
  interval?: number
  unit?: RecurrenceUnit
  nextRunDate?: string
  isActive?: boolean
  status?: TransactionStatus
}

export async function listRecurringTransactions(): Promise<RecurringTransaction[]> {
  return runWithDatabase(() => listRecurringTransactionRecords())
}

export async function getRecurringTransaction(id: string): Promise<RecurringTransaction | null> {
  return runWithDatabase(() => getRecurringTransactionById(id))
}

export async function updateRecurringTransactionSchedule(
  id: string,
  updates: UpdateRecurringScheduleInput,
): Promise<RecurringTransaction> {
  const payload: Parameters<typeof updateRecurringTransactionRecord>[1] = {}

  if (updates.description !== undefined) {
    payload.description = updates.description
  }
  if (updates.notes !== undefined) {
    payload.notes = updates.notes ?? null
  }
  if (updates.interval !== undefined) {
    payload.interval = normalizeRecurrenceInterval(updates.interval)
  }
  if (updates.unit) {
    payload.intervalUnit = updates.unit
  }
  if (updates.nextRunDate) {
    payload.nextRunDate = normalizeDate(updates.nextRunDate)
  }
  if (updates.isActive !== undefined) {
    payload.isActive = updates.isActive
  }
  if (updates.status) {
    payload.status = updates.status
  }

  return runWithDatabase(async () => {
    const updated = await updateRecurringTransactionRecord(id, payload)
    if (!updated) {
      throw new Error("Recurring transaction not found")
    }
    return updated
  })
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  await runWithDatabase(async () => {
    const deleted = await deleteRecurringTransactionRecord(id)
    if (!deleted) {
      throw new Error("Recurring transaction not found")
    }
  })
}

export { parseCsvTransactions, parseCsv } from "@/lib/transactions/import-utils"

export async function importTransactions(transactionsToImport: ParsedCsvTransaction[]) {
  return runWithDatabase(() =>
    withTransaction(async (db) => {
      if (transactionsToImport.length === 0) {
        return { imported: 0, skipped: 0 }
      }

      const existingTransactions = await listTransactionRecords({}, {}, db)
      const existingKeys = new Set(
        existingTransactions.map((transaction) =>
          [
            transaction.date,
            transaction.description.toLowerCase(),
            transaction.amount,
            transaction.account.toLowerCase(),
          ].join("|"),
        ),
      )

      const evaluator = await getAutomationEvaluator(db)
      const newRecords: CreateTransactionRecord[] = []

      for (const entry of transactionsToImport) {
        const type = resolveType(entry.type)
        const status = resolveStatus(entry.status)
        const normalizedAccount = (entry.account ?? "Checking").trim() || "Checking"

        const amountDetails = await resolveTransactionAmounts(
          type,
          {
            account: normalizedAccount,
            currency: entry.currency ?? undefined,
            amount: entry.originalAmount ?? entry.amount,
            originalAmount: entry.originalAmount ?? entry.amount,
            accountAmount: entry.accountAmount ?? undefined,
            exchangeRate: entry.exchangeRate ?? undefined,
          },
          db,
        )

        const key = [
          entry.date,
          entry.description.toLowerCase(),
          amountDetails.amount,
          amountDetails.account.name.toLowerCase(),
        ].join("|")
        if (existingKeys.has(key)) {
          continue
        }
        existingKeys.add(key)

        const baseCategory = await resolveCategoryReference(
          entry.categoryId ?? null,
          entry.categoryName,
          db,
        )
        const matched = evaluator(entry.description)
        const finalCategory = matched ?? baseCategory

        newRecords.push({
          id: `txn_${randomUUID()}`,
          date: entry.date,
          description: entry.description,
          categoryId: finalCategory.categoryId,
          categoryName: finalCategory.categoryName,
          amount: amountDetails.amount,
          accountAmount: amountDetails.accountAmount,
          originalAmount: amountDetails.originalAmount,
          currency: amountDetails.currency,
          exchangeRate: amountDetails.exchangeRate,
          account: amountDetails.account.name,
          status,
          type,
          notes: entry.notes ?? null,
          transferGroupId: null,
          transferDirection: null,
        })
      }

      if (newRecords.length > 0) {
        await bulkInsertTransactions(newRecords, db)
      }

      return {
        imported: newRecords.length,
        skipped: transactionsToImport.length - newRecords.length,
      }
    }),
  )
}
