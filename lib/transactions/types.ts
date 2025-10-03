export type TransactionType = "income" | "expense" | "transfer"

export type TransactionStatus = "pending" | "completed" | "cleared"

export interface Transaction {
  id: string
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  exchangeRate: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  transferGroupId: string | null
  transferDirection: "in" | "out" | null
  createdAt: string
  updatedAt: string
}

export interface TransactionListParams {
  search?: string
  categoryId?: string
  categoryName?: string
  status?: string
  account?: string
  type?: TransactionType
  startDate?: string
  endDate?: string
  sortField?: "date" | "amount" | "description"
  sortDirection?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface TransactionListResult {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  totals: {
    income: number
    expenses: number
    net: number
  }
}

export interface CreateTransactionInput {
  date: string
  description: string
  categoryId?: string | null
  categoryName: string
  amount: number
  accountAmount?: number
  originalAmount?: number
  currency?: string
  exchangeRate?: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string | null
  recurrence?: RecurrenceInput | null
}

export interface UpdateTransactionInput {
  date?: string
  description?: string
  categoryId?: string | null
  categoryName?: string
  amount?: number
  accountAmount?: number
  originalAmount?: number
  currency?: string
  exchangeRate?: number
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string | null
  recurrence?: RecurrenceInput | null
}

export interface ParsedCsvTransaction {
  date: string
  description: string
  amount: number
  categoryId?: string | null
  categoryName?: string
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string | null
  originalAmount?: number
  accountAmount?: number
  currency?: string
  exchangeRate?: number
}

export interface CreateTransferInput {
  date: string
  description: string
  amount: number
  fromAccount: string
  toAccount: string
  status: TransactionStatus
  notes?: string | null
}

export type RecurrenceUnit = "day" | "week" | "month" | "year"

export interface RecurrenceInput {
  interval: number
  unit: RecurrenceUnit
  startDate?: string
}

export interface RecurringTransaction {
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
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  interval: number
  unit: RecurrenceUnit
  nextRunDate: string
  lastRunDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CsvParseResult {
  transactions: ParsedCsvTransaction[]
  errors: Array<{ line: number; message: string }>
}
