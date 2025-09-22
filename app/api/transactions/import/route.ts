import { NextRequest, NextResponse } from "next/server"
import { importTransactions, parseCsvTransactions } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { parsePdfTransactions } from "@/lib/transactions/pdf-parser"
import { recordUserAction } from "@/lib/activity/service"
import type { ParsedCsvTransaction } from "@/lib/transactions/types"

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
      return NextResponse.json({ error: "File is required" }, { status: 400 })
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
        return NextResponse.json({ error: "Column mapping is required" }, { status: 400 })
      }
      const mapping = JSON.parse(mappingRaw)
      const content = await file.text()
      const result = parseCsvTransactions(content, mapping)
      transactions = result.transactions
      errors = result.errors
    }

    if (dryRun) {
      return NextResponse.json({ preview: transactions.slice(0, 20), total: transactions.length, errors })
    }

    const result = await importTransactions(transactions)
    await recordUserAction(session.user, "transaction.import", "transaction", null, {
      imported: result.imported,
      skipped: result.skipped,
      source: isPdfImport ? "pdf" : "csv",
      errors: errors.length,
    })
    return NextResponse.json({ ...result, errors })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
