import { NextResponse } from "next/server"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

export async function GET() {
  try {
    const session = await requireSession({ allowPasswordReset: true })
    return NextResponse.json({ user: session.user })
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
