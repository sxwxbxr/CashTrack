import { NextResponse } from "next/server"

import { listRecurringTransactions } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

export async function GET() {
  try {
    await requireSession()
    const schedules = await listRecurringTransactions()
    return NextResponse.json({ schedules })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
