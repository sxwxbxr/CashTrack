import { NextRequest, NextResponse } from "next/server"
import { importTransactions, parseCsvTransactions } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    await requireSession()
    const formData = await request.formData()
    const file = formData.get("file")
    const mappingRaw = formData.get("mapping")
    const dryRun = formData.get("dryRun") === "true"

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (typeof mappingRaw !== "string") {
      return NextResponse.json({ error: "Column mapping is required" }, { status: 400 })
    }

    const mapping = JSON.parse(mappingRaw)
    const content = await file.text()

    const { transactions, errors } = parseCsvTransactions(content, mapping)

    if (dryRun) {
      return NextResponse.json({ preview: transactions.slice(0, 20), total: transactions.length, errors })
    }

    const result = await importTransactions(transactions)
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
