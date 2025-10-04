import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { PdfReader } from "pdfreader"
import pdfParse from "pdf-parse/lib/pdf-parse.js"

import type { ParsedCsvTransaction, TransactionType } from "@/lib/transactions/types"

function normalizePdfDate(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return null

  const dotDateMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (dotDateMatch) {
    const day = Number.parseInt(dotDateMatch[1], 10)
    const month = Number.parseInt(dotDateMatch[2], 10)
    let year = Number.parseInt(dotDateMatch[3], 10)
    if (dotDateMatch[3].length === 2) {
      year = year >= 70 ? 1900 + year : 2000 + year
    }
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const parsed = new Date(Date.UTC(year, month - 1, day))
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10)
      }
    }
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

  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10)
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
  cleaned = cleaned.replace(/[()]/g, "")

  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const decimalSeparator = Math.max(lastComma, lastDot)

  let normalized: string

  if (decimalSeparator !== -1) {
    const separatorChar = cleaned[decimalSeparator]
    const integerPart = cleaned
      .slice(0, decimalSeparator)
      .replace(/[.,]/g, "")
    const fractionalPart = cleaned
      .slice(decimalSeparator + 1)
      .replace(/[.,]/g, "")
    normalized = `${integerPart}.${fractionalPart}`
    if (separatorChar === "," && fractionalPart.length === 0) {
      normalized = `${integerPart}`
    }
  } else {
    normalized = cleaned.replace(/[.,]/g, "")
  }

  const amount = Number(normalized)
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid amount: ${value}`)
  }

  return negative ? -Math.abs(amount) : amount
}

const DATE_LINE_REGEX = /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(.*)$/
const AMOUNT_REGEX = /-?\$?\(?\d{1,3}(?:[.,']\d{3})*(?:[.,]\d{2})?\)?(?:CR|DR)?/g

function toCents(value: number): number {
  return Math.round(value * 100)
}

function splitCombinedAmountPair(value: string): [string, string] | null {
  const normalized = value.replace(/\s+/g, "")
  const compact = normalized.replace(/'/g, "")
  const match = compact.match(/^(-?\d+(?:[.,]\d{2}))(-?\d+(?:[.,]\d{2}))$/)
  if (!match) {
    return null
  }
  return [match[1], match[2]]
}

function extractAmounts(value: string): RegExpMatchArray[] {
  AMOUNT_REGEX.lastIndex = 0
  return Array.from(value.matchAll(AMOUNT_REGEX))
}

const PDF_DUMP_DIRECTORY = path.join(process.cwd(), "data", "import-dumps")
const PDF_LOG_PREFIX = "[transactions/pdf-parser]"
const PDF_DUMP_DIRECTORY_RELATIVE = path.relative(process.cwd(), PDF_DUMP_DIRECTORY)

type PdfTextItem = {
  x: number
  y: number
  text: string
}

async function extractPdfText(buffer: Buffer): Promise<{ lines: string[]; raw: string }> {
  const reader = new PdfReader()
  return new Promise((resolve, reject) => {
    const pages: string[][] = []
    let rows = new Map<number, PdfTextItem[]>()

    const flushRows = () => {
      if (rows.size === 0) {
        return
      }

      const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b)
      const pageLines: string[] = []

      for (const key of sortedRowKeys) {
        const items = rows.get(key) ?? []
        if (items.length === 0) {
          continue
        }

        items.sort((a, b) => a.x - b.x)

        let line = ""
        let previousX: number | null = null

        for (const item of items) {
          if (previousX !== null) {
            const gap = item.x - previousX
            if (gap > 1.5) {
              line += gap > 6 ? "   " : " "
            }
          }

          line += item.text
          previousX = item.x
        }

        pageLines.push(line.trimEnd())
      }

      pages.push(pageLines)
      rows = new Map<number, PdfTextItem[]>()
    }

    reader.parseBuffer(buffer, (error, item) => {
      if (error) {
        reject(error)
        return
      }

      if (!item) {
        flushRows()
        const lines = pages.flatMap((pageLines, index) =>
          index === pages.length - 1 ? pageLines : [...pageLines, ""],
        )
        resolve({ lines, raw: lines.join("\n") })
        return
      }

      if ((item as { page?: number }).page) {
        flushRows()
        return
      }

      if ((item as PdfTextItem).text) {
        const textItem = item as PdfTextItem
        if (!textItem.text || !textItem.text.trim()) {
          return
        }
        const normalizedY = Math.round(textItem.y * 10)
        const existing = rows.get(normalizedY)
        if (existing) {
          existing.push(textItem)
        } else {
          rows.set(normalizedY, [textItem])
        }
      }
    })
  })
}

let ensureDumpDirectoryPromise: Promise<void> | null = null

async function ensurePdfDumpDirectory() {
  if (!ensureDumpDirectoryPromise) {
    ensureDumpDirectoryPromise = (async () => {
      try {
        await mkdir(PDF_DUMP_DIRECTORY, { recursive: true })
        console.info(`${PDF_LOG_PREFIX} Prepared PDF dump directory`, {
          path: PDF_DUMP_DIRECTORY_RELATIVE,
        })
      } catch (error) {
        console.warn(
          `${PDF_LOG_PREFIX} Failed to prepare PDF dump directory`,
          error instanceof Error ? { error: error.message } : { error },
        )
        throw error
      }
    })()
  }

  try {
    await ensureDumpDirectoryPromise
  } catch (error) {
    ensureDumpDirectoryPromise = null
    if (error instanceof Error) {
      console.warn(`${PDF_LOG_PREFIX} Continuing without dump directory`, { error: error.message })
    }
  }
}

async function persistPdfTextDump(text: string, accountName?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const safeAccountName = accountName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const filename = safeAccountName && safeAccountName.length > 0
    ? `${timestamp}-${safeAccountName}.txt`
    : `${timestamp}-statement.txt`
  const outputPath = path.join(PDF_DUMP_DIRECTORY, filename)

  try {
    await ensurePdfDumpDirectory()
    await writeFile(outputPath, text, "utf8")
    console.info(`${PDF_LOG_PREFIX} Wrote PDF text dump`, { path: path.relative(process.cwd(), outputPath) })
  } catch (error) {
    console.warn(
      `${PDF_LOG_PREFIX} Failed to persist PDF text dump`,
      error instanceof Error ? { error: error.message } : { error },
    )
  }
}

void ensurePdfDumpDirectory().catch(() => {
  // The warning was already logged in ensurePdfDumpDirectory; continue without blocking module load.
})

function isRaiffeisenStatement(lines: string[], rawText: string): boolean {
  const hasHeader = lines.some((line) =>
    /Datum\s+Text\s+Belastungen\s+Gutschriften\s+Saldo/i.test(line),
  )
  if (!hasHeader) {
    return false
  }

  if (/Raiffeisenbank/i.test(rawText)) {
    return true
  }

  return /Kontoauszug\s+\d{2}\.\d{2}\.\d{4}\s+-\s+\d{2}\.\d{2}\.\d{4}/.test(rawText)
}

type RaiffeisenEntry = {
  dateToken: string
  mainLine: string
  extras: string[]
  lineNumber: number
}

function normalizeTableArtifacts(value: string): string {
  return value.replace(/^[A-Za-z0-9_]+(?=\d{2}\.\d{2}\.\d{2}\s)/, "").trim()
}

const CREDIT_KEYWORDS = [
  /gutschrift/,
  /eingang/,
  /zahlungseingang/,
  /erstattung/,
  /übertrag von/,
  /uebertrag von/,
  /zins/,
]

const DEBIT_KEYWORDS = [
  /belastung/,
  /einkauf/,
  /zahlung/,
  /übertrag auf/,
  /uebertrag auf/,
  /abbuchung/,
]

function parseRaiffeisenStatement(
  lines: string[],
  account: string,
): { transactions: ParsedCsvTransaction[]; errors: Array<{ line: number; message: string }> } {
  const transactions: ParsedCsvTransaction[] = []
  const errors: Array<{ line: number; message: string }> = []
  let entryCounter = 0
  let previousBalanceCents: number | undefined
  let currentEntry: RaiffeisenEntry | null = null

  const finalizeCurrent = () => {
    if (!currentEntry) {
      return
    }

    const normalizedDate = normalizePdfDate(currentEntry.dateToken)
    if (!normalizedDate) {
      errors.push({ line: currentEntry.lineNumber, message: "Unable to parse transaction date" })
      currentEntry = null
      return
    }

    let remainder = currentEntry.mainLine.trim()
    if (!remainder) {
      currentEntry = null
      return
    }

    let amountToken: string | null = null
    let balanceToken: string | null = null

    const trailingPairMatch = remainder.match(/(-?\d[\d'.,]*)\s+(-?\d[\d'.,]*)\s*$/)
    if (trailingPairMatch) {
      amountToken = trailingPairMatch[1]
      balanceToken = trailingPairMatch[2]
      remainder = remainder.slice(0, remainder.length - trailingPairMatch[0].length).trim()
    } else {
      const singleMatch = remainder.match(/(-?\d[\d'.,]*)\s*$/)
      if (singleMatch) {
        balanceToken = singleMatch[1]
        remainder = remainder.slice(0, remainder.length - singleMatch[0].length).trim()
      }
    }

    const normalizedExtras = currentEntry.extras
      .map((line) => normalizeTableArtifacts(line).replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0 && !/^\d+\s*\/\s*\d+$/.test(line) && line !== "0")

    const descriptionParts = [remainder.replace(/\s+/g, " ").trim(), ...normalizedExtras].filter(
      (part) => part.length > 0,
    )
    const description = descriptionParts.join("; ")
    const loweredDescription = description.toLowerCase()

    let amountValueCents: number | undefined
    let balanceValueCents: number | undefined

    if (amountToken) {
      try {
        amountValueCents = toCents(sanitizeAmount(amountToken))
      } catch (error) {
        errors.push({
          line: currentEntry.lineNumber,
          message: error instanceof Error ? error.message : "Invalid amount",
        })
      }
    }

    if (balanceToken) {
      try {
        balanceValueCents = toCents(sanitizeAmount(balanceToken))
      } catch (error) {
        errors.push({
          line: currentEntry.lineNumber,
          message: error instanceof Error ? error.message : "Invalid balance",
        })
      }
    }

    const isBalanceMarker =
      /^saldo/.test(loweredDescription) || /^saldovortrag/.test(loweredDescription) || loweredDescription.startsWith("umsatz")

    if (isBalanceMarker) {
      if (typeof balanceValueCents === "number") {
        previousBalanceCents = balanceValueCents
      }
      currentEntry = null
      return
    }

    if (typeof balanceValueCents !== "number" && typeof amountValueCents !== "number") {
      errors.push({ line: currentEntry.lineNumber, message: "Unable to determine amount" })
      currentEntry = null
      return
    }

    const likelyCredit = CREDIT_KEYWORDS.some((regex) => regex.test(loweredDescription))
    const likelyDebit = DEBIT_KEYWORDS.some((regex) => regex.test(loweredDescription))

    let resolvedAmountCents: number | undefined

    if (typeof balanceValueCents === "number") {
      if (typeof previousBalanceCents === "number") {
        const delta = balanceValueCents - previousBalanceCents
        if (delta !== 0) {
          resolvedAmountCents = delta
        } else if (typeof amountValueCents === "number") {
          resolvedAmountCents = likelyCredit && !likelyDebit ? Math.abs(amountValueCents) : -Math.abs(amountValueCents)
        } else {
          resolvedAmountCents = 0
        }
      } else if (typeof amountValueCents === "number") {
        resolvedAmountCents = likelyCredit && !likelyDebit ? Math.abs(amountValueCents) : -Math.abs(amountValueCents)
      } else {
        previousBalanceCents = balanceValueCents
        currentEntry = null
        return
      }
      previousBalanceCents = balanceValueCents
    } else if (typeof amountValueCents === "number") {
      const sign = likelyCredit && !likelyDebit ? 1 : -1
      resolvedAmountCents = sign * Math.abs(amountValueCents)
      if (typeof previousBalanceCents === "number") {
        previousBalanceCents += resolvedAmountCents
      }
    }

    if (typeof resolvedAmountCents !== "number" || resolvedAmountCents === 0) {
      currentEntry = null
      return
    }

    if (
      typeof amountValueCents === "number" &&
      Math.abs(Math.abs(resolvedAmountCents) - Math.abs(amountValueCents)) > 1
    ) {
      errors.push({
        line: currentEntry.lineNumber,
        message: "Statement amount does not match calculated balance delta",
      })
    }

    const type: TransactionType = resolvedAmountCents >= 0 ? "income" : "expense"
    entryCounter += 1
    const sourceLine = currentEntry?.lineNumber
    transactions.push({
      sourceId: `pdf-${sourceLine ?? entryCounter}`,
      date: normalizedDate,
      description: description || "Statement entry",
      amount: Math.abs(resolvedAmountCents) / 100,
      type,
      account,
      sourceLine,
    })

    currentEntry = null
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    const normalized = normalizeTableArtifacts(trimmed)
    if (/^\d{2}\.\d{2}\.\d{2}\s/.test(normalized)) {
      finalizeCurrent()
      const mainLine = normalized.slice(8).trim()
      currentEntry = {
        dateToken: normalized.slice(0, 8),
        mainLine,
        extras: [],
        lineNumber: index + 1,
      }
      return
    }

    if (currentEntry) {
      currentEntry.extras.push(trimmed)
    }
  })

  finalizeCurrent()

  return { transactions, errors }
}

export async function parsePdfTransactions(
  buffer: Buffer,
  options: { accountName?: string } = {},
): Promise<{ transactions: ParsedCsvTransaction[]; errors: Array<{ line: number; message: string }> }> {
  let rawLines: string[]
  let rawText: string

  try {
    const extracted = await extractPdfText(buffer)
    rawLines = extracted.lines
    rawText = extracted.raw
  } catch (error) {
    console.warn(
      `${PDF_LOG_PREFIX} Falling back to pdf-parse extraction`,
      error instanceof Error ? { error: error.message } : { error },
    )
    const parsed = await pdfParse(buffer)
    rawText = parsed.text
    rawLines = parsed.text.split(/\r?\n/)
  }

  const account = options.accountName?.trim() || "Statement"
  await persistPdfTextDump(rawText, options.accountName)

  if (isRaiffeisenStatement(rawLines, rawText)) {
    return parseRaiffeisenStatement(rawLines, account)
  }

  const transactions: ParsedCsvTransaction[] = []
  const errors: Array<{ line: number; message: string }> = []

  type PendingEntry = {
    date: string
    parts: string[]
    lineNumber: number
  }

  let currentEntry: PendingEntry | null = null
  let previousBalanceCents: number | undefined
  let entryCounter = 0

  const finalizeCurrentEntry = () => {
    if (!currentEntry) {
      return
    }

    const entryText = currentEntry.parts
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => part.length > 0)
      .join(" ")
      .replace(/^\((\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\)\s*/, "")

    if (!entryText) {
      currentEntry = null
      return
    }

    const trailingPairRegex = /(-?\d{1,3}(?:[.,']\d{3})*(?:[.,]\d{2}))\s*(-?\d{1,3}(?:[.,']\d{3})*(?:[.,]\d{2}))\s*$/
    const trailingPairMatch = trailingPairRegex.exec(entryText)

    let amountString: string | undefined
    let balanceString: string | undefined
    let descriptionEndIndex = entryText.length

    if (trailingPairMatch) {
      const combinedFromBalance = splitCombinedAmountPair(trailingPairMatch[2])
      const combinedFromAmount = splitCombinedAmountPair(trailingPairMatch[1])
      if (combinedFromBalance) {
        amountString = combinedFromBalance[0]
        balanceString = combinedFromBalance[1]
      } else if (combinedFromAmount) {
        amountString = combinedFromAmount[0]
        balanceString = combinedFromAmount[1]
      } else {
        amountString = trailingPairMatch[1]
        balanceString = trailingPairMatch[2]
      }
      descriptionEndIndex = trailingPairMatch.index
    } else {
      const amountMatches = extractAmounts(entryText)
      if (amountMatches.length === 0) {
        errors.push({ line: currentEntry.lineNumber, message: "Unable to locate amount" })
        currentEntry = null
        return
      }

      const amountMatchIndex = amountMatches.length >= 2 ? amountMatches.length - 2 : amountMatches.length - 1
      const amountMatch = amountMatches[amountMatchIndex]
      amountString = amountMatch[0]
      descriptionEndIndex = amountMatch.index ?? entryText.indexOf(amountString)

      if (amountMatches.length >= 2) {
        balanceString = amountMatches[amountMatches.length - 1][0]
      }
    }

    let amountValueCents: number
    let balanceValueCents: number | undefined

    try {
      if (!amountString) {
        throw new Error("Missing amount")
      }
      amountValueCents = toCents(sanitizeAmount(amountString))
      if (balanceString) {
        balanceValueCents = toCents(sanitizeAmount(balanceString))
      }
    } catch (error) {
      errors.push({ line: currentEntry.lineNumber, message: (error as Error).message })
      currentEntry = null
      return
    }

    let description = entryText.slice(0, descriptionEndIndex).replace(/^\(([^)]+)\)\s*/, "").trim()

    if (!description || /^Saldo/i.test(description) || /^Saldovortrag/i.test(description)) {
      if (typeof balanceValueCents === "number") {
        previousBalanceCents = balanceValueCents
      }
      currentEntry = null
      return
    }

    const startingBalanceCents = previousBalanceCents
    let resolvedAmountCents = amountValueCents

    if (typeof balanceValueCents === "number") {
      if (typeof startingBalanceCents === "number") {
        const deltaCents = balanceValueCents - startingBalanceCents
        if (deltaCents !== 0) {
          resolvedAmountCents = deltaCents
        }
      }
      previousBalanceCents = balanceValueCents
    }

    if (typeof startingBalanceCents !== "number" && typeof balanceValueCents !== "number") {
      const lowered = description.toLowerCase()
      if (/gutschrift|eingang|zahlungseingang|erstattung/.test(lowered)) {
        resolvedAmountCents = Math.abs(resolvedAmountCents)
      } else {
        resolvedAmountCents = -Math.abs(resolvedAmountCents)
      }
    } else if (typeof startingBalanceCents !== "number" && typeof balanceValueCents === "number") {
      const lowered = description.toLowerCase()
      if (/gutschrift|eingang|zahlungseingang|erstattung/.test(lowered)) {
        resolvedAmountCents = Math.abs(resolvedAmountCents)
      } else {
        resolvedAmountCents = -Math.abs(resolvedAmountCents)
      }
    }

    const resolvedAmount = resolvedAmountCents / 100
    const type: TransactionType = resolvedAmount >= 0 ? "income" : "expense"

    entryCounter += 1
    const sourceLine = currentEntry?.lineNumber

    transactions.push({
      sourceId: `pdf-${sourceLine ?? entryCounter}`,
      date: currentEntry.date,
      description: description || "Statement entry",
      amount: Math.abs(resolvedAmount),
      type,
      account,
      sourceLine,
    })

    currentEntry = null
  }

  rawLines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      return
    }

    const dateMatch = line.match(DATE_LINE_REGEX)
    if (dateMatch) {
      const dateValue = normalizePdfDate(dateMatch[1])
      if (!dateValue) {
        errors.push({ line: index + 1, message: `Unrecognized date: ${dateMatch[1]}` })
        currentEntry = null
        return
      }

      const remainderRaw = dateMatch[2]
      const remainderTrimmed = remainderRaw.trim()
      const remainderFirstChar = remainderTrimmed.charAt(0)
      const isLikelyNewEntry =
        remainderTrimmed.length === 0 || /[A-Za-zÄÖÜäöü]/.test(remainderFirstChar)

      if (!isLikelyNewEntry && currentEntry) {
        currentEntry.parts.push(line)
        return
      }

      finalizeCurrentEntry()

      currentEntry = {
        date: dateValue,
        parts: [],
        lineNumber: index + 1,
      }

      const remainder = remainderTrimmed
      if (remainder) {
        currentEntry.parts.push(remainder)
      }

      return
    }

    if (!currentEntry) {
      return
    }

    if (
      /^(Saldo|Umsatz|Kontoinhaber|Kontoauszug|IBAN|Kontoart|Raiffeisenbank|Telefon|UID\b|www\.|wil@|Herr\b|Für Sie zuständig|Privatkundenberatung|Wil SG|AN\d+|\d+\s*\/\s*\d+|Übertrag\b)/i.test(
        line,
      )
    ) {
      finalizeCurrentEntry()
      return
    }

    currentEntry.parts.push(line)
  })

  finalizeCurrentEntry()

  return { transactions, errors }
}
