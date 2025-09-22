import pdfParse from "pdf-parse"

import type { ParsedCsvTransaction, TransactionType } from "@/lib/transactions/types"

function normalizePdfDate(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return null

  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10)
  }

  const monthNameMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/)
  if (monthNameMatch) {
    const day = Number.parseInt(monthNameMatch[1], 10)
    const monthName = monthNameMatch[2]
    const yearRaw = Number.parseInt(monthNameMatch[3], 10)
    if (!Number.isFinite(day) || !Number.isFinite(yearRaw)) {
      return null
    }
    const year = yearRaw < 100 ? (yearRaw >= 70 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw
    const parsed = new Date(`${monthName} ${day}, ${year}`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const swapped = trimmed.replace(/[.\-]/g, "/")
  const parts = swapped.split("/")
  if (parts.length === 3) {
    let [part1, part2, part3] = parts.map((part) => part.trim())
    if (!part1 || !part2 || !part3) {
      return null
    }

    let year = Number.parseInt(part3, 10)
    let month = Number.parseInt(part1, 10)
    let day = Number.parseInt(part2, 10)

    if (part1.length === 4) {
      year = Number.parseInt(part1, 10)
      month = Number.parseInt(part2, 10)
      day = Number.parseInt(part3, 10)
    } else if (part3.length !== 4) {
      year = Number.parseInt(part3, 10)
    }

    if (part3.length === 2) {
      year = year >= 70 ? 1900 + year : 2000 + year
    }

    if (month > 12 && day <= 12) {
      const temp = month
      month = day
      day = temp
    }

    if (day > 31 && month <= 12) {
      const temp = day
      day = month
      month = temp
    }

    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const parsed = new Date(Date.UTC(year, month - 1, day))
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10)
      }
    }
  }

  return null
}

function sanitizeAmount(value: string): number {
  const trimmed = value.trim()
  let negative = false

  if (trimmed.includes("(") && trimmed.includes(")")) {
    negative = true
  }

  if (/DR$/i.test(trimmed)) {
    negative = true
  }

  if (/CR$/i.test(trimmed)) {
    negative = false
  }

  if (trimmed.endsWith("-")) {
    negative = true
  }

  let cleaned = trimmed.replace(/(CR|cr|DR|dr)$/g, "")
  cleaned = cleaned.replace(/[^0-9.,()\-]/g, "")
  if (cleaned.endsWith("-")) {
    negative = true
    cleaned = cleaned.slice(0, -1)
  }
  cleaned = cleaned.replace(/[,$]/g, "").replace(/[()]/g, "")

  const amount = Number(cleaned)
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid amount: ${value}`)
  }

  return negative ? -Math.abs(amount) : amount
}

function resolveTransactionAmount(amounts: number[]): number {
  if (amounts.length === 0) {
    throw new Error("Missing amount")
  }

  if (amounts.length >= 3) {
    const debit = amounts[0]
    const credit = amounts[1]
    if (Math.abs(credit) > 0) {
      return credit
    }
    if (Math.abs(debit) > 0) {
      return -Math.abs(debit)
    }
  }

  if (amounts.length >= 2) {
    const [first] = amounts
    if (Math.abs(first) > 0) {
      return first
    }
  }

  return amounts[0]
}

export async function parsePdfTransactions(
  buffer: Buffer,
  options: { accountName?: string } = {},
): Promise<{ transactions: ParsedCsvTransaction[]; errors: Array<{ line: number; message: string }> }> {
  const result = await pdfParse(buffer)
  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const transactions: ParsedCsvTransaction[] = []
  const errors: Array<{ line: number; message: string }> = []
  const account = options.accountName?.trim() || "Statement"

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const match = line.match(
      /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})\s+(.*)$/,
    )
    if (!match) {
      return
    }

    const dateValue = normalizePdfDate(match[1])
    if (!dateValue) {
      errors.push({ line: lineNumber, message: `Unrecognized date: ${match[1]}` })
      return
    }

    const remainder = match[2].trim()
    const amountMatches = Array.from(remainder.matchAll(/-?\$?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?(?:CR|DR)?/g))
    if (amountMatches.length === 0) {
      errors.push({ line: lineNumber, message: "Unable to locate amount" })
      return
    }

    const firstAmount = amountMatches[0]
    const descriptionRaw = remainder.slice(0, firstAmount.index).trim()
    const description = descriptionRaw || "Statement entry"

    try {
      const amountValues = amountMatches.map((matchResult) => sanitizeAmount(matchResult[0]))
      const resolvedAmount = resolveTransactionAmount(amountValues)
      const type: TransactionType = resolvedAmount >= 0 ? "income" : "expense"

      transactions.push({
        date: dateValue,
        description,
        amount: Math.abs(resolvedAmount),
        type,
        account,
      })
    } catch (error) {
      errors.push({ line: lineNumber, message: (error as Error).message })
    }
  })

  return { transactions, errors }
}
