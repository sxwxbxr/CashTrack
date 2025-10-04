import { NextRequest, NextResponse } from "next/server"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { parsePdfTransactions } from "@/lib/transactions/pdf-parser"
import {
  parseCsvTransactions,
  normalizeDate,
  VALID_STATUSES,
  VALID_TYPES,
} from "@/lib/transactions/import-utils"
import type { CsvMapping } from "@/lib/transactions/import-utils"
import type { ParsedCsvTransaction, TransactionStatus, TransactionType } from "@/lib/transactions/types"

interface DuplicateDecisionMap {
  [sourceId: string]: "import" | "skip"
}

const VALID_DUPLICATE_DECISIONS: Array<DuplicateDecisionMap[keyof DuplicateDecisionMap]> = [
  "import",
  "skip",
]

type ConsoleLevel = "log" | "warn" | "error"

const IMPORT_LOG_PREFIX = "[transactions/import]"
const MAX_LOGGED_ERRORS = 5

function logImport(level: ConsoleLevel, message: string, context: Record<string, unknown> = {}) {
  const payload = { ...context, timestamp: new Date().toISOString() }
  console[level](`${IMPORT_LOG_PREFIX} ${message}`, payload)
}

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin")
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.append("Vary", "Origin")
  }
  return response
}

function parseOverrideMap(
  raw: FormDataEntryValue | null,
): Record<string, Partial<ParsedCsvTransaction>> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    const overrides: Record<string, Partial<ParsedCsvTransaction>> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.trim().length === 0) {
        continue
      }
      if (!value || typeof value !== "object") {
        continue
      }
      overrides[key] = value as Partial<ParsedCsvTransaction>
    }
    return overrides
  } catch {
    return {}
  }
}

function parseBooleanMap(raw: FormDataEntryValue | null): Record<string, boolean> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    const selections: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.trim().length === 0) {
        continue
      }
      if (typeof value !== "boolean") {
        continue
      }
      selections[key] = value
    }
    return selections
  } catch {
    return {}
  }
}

function parseDuplicateDecisions(raw: FormDataEntryValue | null): DuplicateDecisionMap {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    const decisions: DuplicateDecisionMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.trim().length === 0) {
        continue
      }
      if (typeof value !== "string") {
        continue
      }
      const lowered = value.toLowerCase()
      if (VALID_DUPLICATE_DECISIONS.includes(lowered as DuplicateDecisionMap[keyof DuplicateDecisionMap])) {
        decisions[key] = lowered as DuplicateDecisionMap[keyof DuplicateDecisionMap]
      }
    }
    return decisions
  } catch {
    return {}
  }
}

function applyTransactionOverride(
  transaction: ParsedCsvTransaction,
  override: Partial<ParsedCsvTransaction>,
): ParsedCsvTransaction {
  const updated: ParsedCsvTransaction = { ...transaction }

  if (typeof override.date === "string") {
    try {
      updated.date = normalizeDate(override.date)
    } catch {
      // ignore invalid override dates
    }
  }

  if (typeof override.description === "string") {
    const trimmed = override.description.trim()
    if (trimmed) {
      updated.description = trimmed
    }
  }

  if (typeof override.amount === "number" && Number.isFinite(override.amount)) {
    updated.amount = Math.abs(override.amount)
  }

  if (override.originalAmount === null) {
    delete updated.originalAmount
  } else if (typeof override.originalAmount === "number" && Number.isFinite(override.originalAmount)) {
    updated.originalAmount = Math.abs(override.originalAmount)
  }

  if (override.accountAmount === null) {
    delete updated.accountAmount
  } else if (typeof override.accountAmount === "number" && Number.isFinite(override.accountAmount)) {
    updated.accountAmount = Math.abs(override.accountAmount)
  }

  if (override.exchangeRate === null) {
    delete updated.exchangeRate
  } else if (typeof override.exchangeRate === "number" && Number.isFinite(override.exchangeRate) && override.exchangeRate > 0) {
    updated.exchangeRate = override.exchangeRate
  }

  if (typeof override.currency === "string") {
    const trimmed = override.currency.trim().toUpperCase()
    if (trimmed) {
      updated.currency = trimmed
    }
  }

  if (typeof override.categoryName === "string") {
    const trimmed = override.categoryName.trim()
    updated.categoryName = trimmed || undefined
  }

  if (override.categoryId === null) {
    updated.categoryId = null
  } else if (typeof override.categoryId === "string") {
    const trimmed = override.categoryId.trim()
    updated.categoryId = trimmed ? trimmed : null
  }

  if (typeof override.account === "string") {
    const trimmed = override.account.trim()
    updated.account = trimmed || undefined
  }

  if (override.notes === null) {
    updated.notes = null
  } else if (typeof override.notes === "string") {
    updated.notes = override.notes
  }

  if (typeof override.status === "string") {
    const lowered = override.status.toLowerCase() as TransactionStatus
    if (VALID_STATUSES.includes(lowered)) {
      updated.status = lowered
    }
  }

  if (typeof override.type === "string") {
    const lowered = override.type.toLowerCase() as TransactionType
    if (VALID_TYPES.includes(lowered)) {
      updated.type = lowered
    }
  }

  return updated
}

function ensureTransactionDefaults(transaction: ParsedCsvTransaction): ParsedCsvTransaction {
  const normalized: ParsedCsvTransaction = { ...transaction }

  if (!normalized.status || !VALID_STATUSES.includes(normalized.status)) {
    normalized.status = "completed"
  }

  if (!normalized.type || !VALID_TYPES.includes(normalized.type)) {
    normalized.type = "expense"
  }

  return normalized
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "*"
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") ?? "*",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}

export async function POST(request: NextRequest) {
  const logContext: Record<string, unknown> = {
    requestId: request.headers.get("x-request-id"),
  }

  try {
    const session = await requireSession()
    const formData = await request.formData()
    const file = formData.get("file")
    const mappingRaw = formData.get("mapping")
    const dryRun = formData.get("dryRun") === "true"
    const importTypeRaw = formData.get("importType")
    const accountNameRaw = formData.get("accountName")
    const overridesRaw = formData.get("overrides")
    const selectionsRaw = formData.get("selections")
    const duplicateDecisionsRaw = formData.get("duplicateDecisions")

    const overrideMap = parseOverrideMap(overridesRaw)
    const selectionMap = parseBooleanMap(selectionsRaw)
    const duplicateDecisions = parseDuplicateDecisions(duplicateDecisionsRaw)

    const importType = typeof importTypeRaw === "string" ? importTypeRaw.toLowerCase() : ""
    const accountName = typeof accountNameRaw === "string" ? accountNameRaw : undefined
    const baseContext = {
      accountName: accountName ?? null,
      dryRun,
      importType: importType || "unknown",
    }
    Object.assign(logContext, baseContext)

    if (!(file instanceof Blob)) {
      logImport("error", "Upload rejected because no file was provided", baseContext)
      return withCors(NextResponse.json({ error: "File is required" }, { status: 400 }), request)
    }

    const isPdfImport = importType === "pdf"

    let transactions: ParsedCsvTransaction[]
    let errors: Array<{ line: number; message: string }>

    if (isPdfImport) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await parsePdfTransactions(buffer, { accountName })
      transactions = result.transactions
      errors = result.errors
    } else {
      if (typeof mappingRaw !== "string") {
        return withCors(
          NextResponse.json({ error: "Column mapping is required" }, { status: 400 }),
          request,
        )
      }
      const mapping = JSON.parse(mappingRaw) as CsvMapping
      const content = await file.text()
      const result = parseCsvTransactions(content, mapping)
      transactions = result.transactions
      errors = result.errors
    }

    transactions = transactions.map((transaction) => {
      const override = overrideMap[transaction.sourceId]
      const adjusted = override ? applyTransactionOverride(transaction, override) : transaction
      return ensureTransactionDefaults(adjusted)
    })

    if (errors.length > 0) {
      logImport(
        "warn",
        `Parser reported ${errors.length} error${errors.length === 1 ? "" : "s"} during ${
          isPdfImport ? "PDF" : "CSV"
        } ${dryRun ? "dry-run" : "import"}`,
        {
          ...baseContext,
          sampleErrors: errors.slice(0, MAX_LOGGED_ERRORS),
        },
      )
    }

    const transactionService = await import("@/lib/transactions/service")
    const duplicatesMap = await transactionService.findPotentialDuplicateTransactions(transactions)

    if (dryRun) {
      const preview = transactions.map((transaction) => {
        const duplicates = duplicatesMap.get(transaction.sourceId) ?? []
        return {
          id: transaction.sourceId,
          sourceId: transaction.sourceId,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          categoryId: transaction.categoryId ?? null,
          categoryName: transaction.categoryName ?? null,
          account: transaction.account ?? null,
          status: transaction.status ?? "completed",
          type: transaction.type ?? "expense",
          notes: transaction.notes ?? null,
          originalAmount: transaction.originalAmount ?? null,
          accountAmount: transaction.accountAmount ?? null,
          currency: transaction.currency ?? null,
          exchangeRate: transaction.exchangeRate ?? null,
          sourceLine: transaction.sourceLine ?? null,
          duplicates: duplicates.map((candidate) => ({
            id: candidate.id,
            date: candidate.date,
            description: candidate.description,
            amount: candidate.amount,
            accountAmount: candidate.accountAmount,
            originalAmount: candidate.originalAmount,
            currency: candidate.currency,
            account: candidate.account,
            status: candidate.status,
            type: candidate.type,
            matchReasons: candidate.matchReasons,
          })),
        }
      })

      return withCors(
        NextResponse.json({ preview, total: transactions.length, errors }),
        request,
      )
    }

    const filteredTransactions = transactions.filter((transaction) => {
      if (selectionMap[transaction.sourceId] === false) {
        return false
      }
      const duplicates = duplicatesMap.get(transaction.sourceId)
      if (duplicates?.length && duplicateDecisions[transaction.sourceId] !== "import") {
        return false
      }
      return true
    })

    const droppedCount = transactions.length - filteredTransactions.length

    const activityService = await import("@/lib/activity/service")

    const forceDuplicateIds = new Set(
      filteredTransactions
        .filter((transaction) => {
          const duplicates = duplicatesMap.get(transaction.sourceId)
          return duplicates?.length && duplicateDecisions[transaction.sourceId] === "import"
        })
        .map((transaction) => transaction.sourceId),
    )

    const result = await transactionService.importTransactions(filteredTransactions, {
      forceDuplicateSourceIds: forceDuplicateIds,
    })
    const totalSkipped = result.skipped + droppedCount

    await activityService.recordUserAction(session.user, "transaction.import", "transaction", null, {
      imported: result.imported,
      skipped: totalSkipped,
      source: isPdfImport ? "pdf" : "csv",
      errors: errors.length,
    })

    if (result.imported === 0) {
      logImport("warn", "Import completed but no new transactions were created", {
        ...baseContext,
        skipped: totalSkipped,
        parserErrors: errors.length,
        droppedBeforeInsert: droppedCount,
      })
    }

    return withCors(NextResponse.json({ ...result, skipped: totalSkipped, errors }), request)
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return withCors(NextResponse.json({ error: error.message }, { status: 401 }), request)
    }
    if (error instanceof PasswordChangeRequiredError) {
      return withCors(NextResponse.json({ error: error.message }, { status: 403 }), request)
    }
    logImport("error", "Unhandled exception while processing import request", {
      ...logContext,
      ...(error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error: String(error) }),
    })
    return withCors(NextResponse.json({ error: (error as Error).message }, { status: 400 }), request)
  }
}
