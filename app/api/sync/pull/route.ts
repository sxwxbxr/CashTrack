import { NextRequest, NextResponse } from "next/server"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { pullChanges } from "@/lib/sync/service"

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    const url = new URL(request.url)
    const since = url.searchParams.get("since") || undefined
    if (since && Number.isNaN(new Date(since).getTime())) {
      return NextResponse.json({ error: "Invalid 'since' timestamp" }, { status: 400 })
    }

    const result = await pullChanges(since)
    return NextResponse.json(result)
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
