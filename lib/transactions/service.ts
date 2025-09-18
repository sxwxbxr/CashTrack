import { randomUUID } from "crypto"
import {
  CreateTransactionInput,
  ParsedCsvTransaction,
  Transaction,
  TransactionListParams,
  TransactionListResult,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from "@/lib/transactions/types"
import { readTransactions, writeTransactions } from "@/lib/transactions/storage"
import { readAutomationRules, readCategories } from "@/lib/categories/storage"
import { createAutomationRuleEvaluator } from "@/lib/categories/rule-matcher"

const DEFAULT_PAGE_SIZE = 50

const VALID_STATUSES: TransactionStatus[] = ["pending", "completed", "cleared"]
const VALID_TYPES: TransactionType[] = ["income", "expense"]

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
  return type === "expense" ? -Math.abs(amount) : Math.abs(amount)
}

function sortTransactions(transactions: Transaction[], sortField: "date" | "amount" | "description", sortDirection: "asc" | "desc") {
  const sorted = [...transactions]
  sorted.sort((a, b) => {
    let aValue: string | number = a[sortField]
    let bValue: string | number = b[sortField]

    if (sortField === "date") {
      aValue = new Date(a.date).getTime()
      bValue = new Date(b.date).getTime()
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1
    }
    return 0
  })
  return sorted
}

export async function reapplyAutomationRules(): Promise<number> {
  const [transactions, rules, categories] = await Promise.all([
    readTransactions(),
    readAutomationRules(),
    readCategories(),
  ])

  if (transactions.length === 0) {
    return 0
  }

  const hasActiveRules = rules.some((rule) => rule.isActive)
  if (!hasActiveRules) {
    return 0
  }

  const evaluateRules = createAutomationRuleEvaluator(rules, categories)

  let updatedCount = 0
  const timestamp = new Date().toISOString()

  const nextTransactions = transactions.map((transaction) => {
    const match = evaluateRules(transaction.description)
    if (!match) {
      return transaction
    }

    if (transaction.category.toLowerCase() === match.categoryName.toLowerCase()) {
      return transaction
    }

    updatedCount += 1
    return {
      ...transaction,
      category: match.categoryName,
      updatedAt: timestamp,
    }
  })

  if (updatedCount > 0) {
    const sorted = sortTransactions(nextTransactions, "date", "desc")
    await writeTransactions(sorted)
  }

  return updatedCount
}

export async function listTransactions(params: TransactionListParams): Promise<TransactionListResult> {
  const {
    search,
    category,
    status,
    account,
    type,
    startDate,
    endDate,
    sortField = "date",
    sortDirection = "desc",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params

  const transactions = await readTransactions()

  const filtered = transactions.filter((transaction) => {
    if (search) {
      const normalized = search.toLowerCase()
      const matchesSearch =
        transaction.description.toLowerCase().includes(normalized) ||
        transaction.category.toLowerCase().includes(normalized) ||
        transaction.account.toLowerCase().includes(normalized)
      if (!matchesSearch) {
        return false
      }
    }

    if (category && category !== "All Categories" && transaction.category !== category) {
      return false
    }

    if (status && transaction.status !== status) {
      return false
    }

    if (account && transaction.account !== account) {
      return false
    }

    if (type && transaction.type !== type) {
      return false
    }

    if (startDate) {
      const transactionDate = new Date(transaction.date)
      if (transactionDate < new Date(startDate)) {
        return false
      }
    }

    if (endDate) {
      const transactionDate = new Date(transaction.date)
      if (transactionDate > new Date(endDate)) {
        return false
      }
    }

    return true
  })

  const totals = filtered.reduce(
    (acc, transaction) => {
      if (transaction.amount >= 0) {
        acc.income += transaction.amount
      } else {
        acc.expenses += Math.abs(transaction.amount)
      }
      acc.net = acc.income - acc.expenses
      return acc
    },
    { income: 0, expenses: 0, net: 0 },
  )

  const sorted = sortTransactions(filtered, sortField, sortDirection)

  const safePage = Math.max(page, 1)
  const safePageSize = Math.max(Math.min(pageSize, 200), 1)
  const startIndex = (safePage - 1) * safePageSize
  const endIndex = startIndex + safePageSize
  const paginated = sorted.slice(startIndex, endIndex)

  return {
    transactions: paginated,
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
    totals,
  }
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const normalizedDate = normalizeDate(input.date)
  const now = new Date().toISOString()
  const type: TransactionType = VALID_TYPES.includes(input.type) ? input.type : "expense"
  const status: TransactionStatus = VALID_STATUSES.includes(input.status) ? input.status : "completed"
  const amount = applyAmount(input.amount, type)

  const fallbackCategory = input.category || "Uncategorized"

  const [transactions, rules, categories] = await Promise.all([
    readTransactions(),
    readAutomationRules(),
    readCategories(),
  ])

  const evaluateRules = createAutomationRuleEvaluator(rules, categories)
  const matchedCategory = evaluateRules(input.description)
  const categoryName = matchedCategory?.categoryName ?? fallbackCategory

  const transaction: Transaction = {
    id: `txn_${randomUUID()}`,
    date: normalizedDate,
    description: input.description,
    category: categoryName,
    amount,
    account: input.account,
    status,
    type,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }

  transactions.push(transaction)
  const sorted = sortTransactions(transactions, "date", "desc")
  await writeTransactions(sorted)

  return transaction
}

export async function updateTransaction(id: string, updates: UpdateTransactionInput): Promise<Transaction> {
  const [transactions, rules, categories] = await Promise.all([
    readTransactions(),
    readAutomationRules(),
    readCategories(),
  ])
  const evaluateRules = createAutomationRuleEvaluator(rules, categories)
  const index = transactions.findIndex((transaction) => transaction.id === id)

  if (index === -1) {
    throw new Error("Transaction not found")
  }

  const existing = transactions[index]
  const type = updates.type && VALID_TYPES.includes(updates.type) ? updates.type : existing.type
  const status = updates.status && VALID_STATUSES.includes(updates.status) ? updates.status : existing.status

  let amount = existing.amount
  if (typeof updates.amount === "number") {
    amount = applyAmount(updates.amount, type)
  } else if (type !== existing.type) {
    amount = applyAmount(Math.abs(existing.amount), type)
  }

  const updated: Transaction = {
    ...existing,
    ...updates,
    date: updates.date ? normalizeDate(updates.date) : existing.date,
    amount,
    type,
    status,
    updatedAt: new Date().toISOString(),
  }

  const matchedCategory = evaluateRules(updated.description)
  const fallbackCategory = updated.category || "Uncategorized"
  const nextCategory = matchedCategory?.categoryName ?? fallbackCategory

  const finalTransaction: Transaction = {
    ...updated,
    category: nextCategory,
  }

  transactions[index] = finalTransaction
  const sorted = sortTransactions(transactions, "date", "desc")
  await writeTransactions(sorted)

  return finalTransaction
}

export async function deleteTransaction(id: string) {
  const transactions = await readTransactions()
  const filtered = transactions.filter((transaction) => transaction.id !== id)
  if (filtered.length === transactions.length) {
    throw new Error("Transaction not found")
  }
  const sorted = sortTransactions(filtered, "date", "desc")
  await writeTransactions(sorted)
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

export function parseCsvTransactions(content: string, mapping: CsvMapping): CsvParseResult {
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
            parsed.category = categoryValue
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

  const [existingTransactions, rules, categories] = await Promise.all([
    readTransactions(),
    readAutomationRules(),
    readCategories(),
  ])
  const evaluateRules = createAutomationRuleEvaluator(rules, categories)
  const existingKeys = new Set(
    existingTransactions.map((transaction) =>
      [transaction.date, transaction.description.toLowerCase(), transaction.amount, transaction.account.toLowerCase()].join("|"),
    ),
  )

  const newTransactions: Transaction[] = []

  transactionsToImport.forEach((entry) => {
    const type = entry.type ?? (entry.amount >= 0 ? "income" : "expense")
    const amount = applyAmount(entry.amount, type)
    const account = entry.account || "Checking"
    const status = entry.status && VALID_STATUSES.includes(entry.status) ? entry.status : "completed"
    const key = [entry.date, entry.description.toLowerCase(), amount, account.toLowerCase()].join("|")
    if (existingKeys.has(key)) {
      return
    }
    existingKeys.add(key)

    const now = new Date().toISOString()
    const fallbackCategory = entry.category || "Uncategorized"
    const matchedCategory = evaluateRules(entry.description)
    const categoryName = matchedCategory?.categoryName ?? fallbackCategory
    newTransactions.push({
      id: `txn_${randomUUID()}`,
      date: entry.date,
      description: entry.description,
      category: categoryName,
      amount,
      account,
      status,
      type,
      notes: entry.notes,
      createdAt: now,
      updatedAt: now,
    })
  })

  if (newTransactions.length > 0) {
    const sorted = sortTransactions([...existingTransactions, ...newTransactions], "date", "desc")
    await writeTransactions(sorted)
  }

  return {
    imported: newTransactions.length,
    skipped: transactionsToImport.length - newTransactions.length,
  }
}
