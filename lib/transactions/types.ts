export type TransactionType = "income" | "expense" | "transfer"

export type TransactionStatus = "pending" | "completed" | "cleared"

export interface TransactionRecurrenceInput {
  frequency: "monthly"
  interval: number
  startDate?: string
}

export interface Transaction {
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
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string | null
  recurrence?: TransactionRecurrenceInput | null
}

export interface UpdateTransactionInput {
  date?: string
  description?: string
  categoryId?: string | null
  categoryName?: string
  amount?: number
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string | null
  recurrence?: TransactionRecurrenceInput | null
}

export interface RecurringTransaction {
  id: string
  templateTransactionId: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  startDate: string
  frequencyMonths: number
  nextOccurrence: string
  lastOccurrence: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
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

export interface CsvParseResult {
  transactions: ParsedCsvTransaction[]
  errors: Array<{ line: number; message: string }>
}
