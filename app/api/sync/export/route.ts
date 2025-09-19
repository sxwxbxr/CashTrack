import { NextResponse } from "next/server"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { exportSnapshot } from "@/lib/sync/service"

export async function GET() {
  try {
    await requireSession()
    const snapshot = await exportSnapshot()
    return NextResponse.json(snapshot)
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
