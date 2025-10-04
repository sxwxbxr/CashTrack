import type { ParsedCsvTransaction, TransactionStatus, TransactionType } from "@/lib/transactions/types"

export type CsvMapping = {
  date: string
  description: string
  amount: string
  category?: string
  account?: string
  status?: string
  type?: string
  notes?: string
}

export const VALID_STATUSES: TransactionStatus[] = ["pending", "completed", "cleared"]
export const VALID_TYPES: TransactionType[] = ["income", "expense", "transfer"]

export function normalizeDate(input: string): string {
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${input}`)
  }
  return parsed.toISOString().slice(0, 10)
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

export function sanitizeNumber(value: string): number {
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
        sourceId: `csv-${lineNumber}`,
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

      parsed.sourceLine = lineNumber
      transactions.push(parsed)
    } catch (error) {
      errors.push({ line: lineNumber, message: (error as Error).message })
    }
  })

  return { transactions, errors }
}
