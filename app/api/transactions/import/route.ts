import { NextRequest, NextResponse } from "next/server"
import { importTransactions, parseCsvTransactions } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { parsePdfTransactions } from "@/lib/transactions/pdf-parser"
import { recordUserAction } from "@/lib/activity/service"
import type { ParsedCsvTransaction } from "@/lib/transactions/types"

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin")
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.append("Vary", "Origin")
  }
  return response
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
  try {
    const session = await requireSession()
    const formData = await request.formData()
    const file = formData.get("file")
    const mappingRaw = formData.get("mapping")
    const dryRun = formData.get("dryRun") === "true"
    const importTypeRaw = formData.get("importType")
    const accountNameRaw = formData.get("accountName")
    const importType = typeof importTypeRaw === "string" ? importTypeRaw.toLowerCase() : ""
    const accountName = typeof accountNameRaw === "string" ? accountNameRaw : undefined

    if (!(file instanceof Blob)) {
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
      const mapping = JSON.parse(mappingRaw)
      const content = await file.text()
      const result = parseCsvTransactions(content, mapping)
      transactions = result.transactions
      errors = result.errors
    }

    if (dryRun) {
      return withCors(
        NextResponse.json({ preview: transactions.slice(0, 20), total: transactions.length, errors }),
        request,
      )
    }

    const result = await importTransactions(transactions)
    await recordUserAction(session.user, "transaction.import", "transaction", null, {
      imported: result.imported,
      skipped: result.skipped,
      source: isPdfImport ? "pdf" : "csv",
      errors: errors.length,
    })
    return withCors(NextResponse.json({ ...result, errors }), request)
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return withCors(NextResponse.json({ error: error.message }, { status: 401 }), request)
    }
    if (error instanceof PasswordChangeRequiredError) {
      return withCors(NextResponse.json({ error: error.message }, { status: 403 }), request)
    }
    return withCors(NextResponse.json({ error: (error as Error).message }, { status: 400 }), request)
  }
}
