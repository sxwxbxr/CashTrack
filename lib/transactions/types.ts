export type TransactionType = "income" | "expense"

export type TransactionStatus = "pending" | "completed" | "cleared"

export interface Transaction {
  id: string
  date: string
  description: string
  category: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TransactionListParams {
  search?: string
  category?: string
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
  category: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string
}

export interface UpdateTransactionInput {
  date?: string
  description?: string
  category?: string
  amount?: number
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string
}

export interface ParsedCsvTransaction {
  date: string
  description: string
  amount: number
  category?: string
  account?: string
  status?: TransactionStatus
  type?: TransactionType
  notes?: string
}

export interface CsvParseResult {
  transactions: ParsedCsvTransaction[]
  errors: Array<{ line: number; message: string }>
}
