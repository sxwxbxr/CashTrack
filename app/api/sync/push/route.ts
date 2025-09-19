import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { syncPushPayloadSchema } from "@/lib/sync/schemas"
import { applySyncPayload } from "@/lib/sync/service"

export async function POST(request: NextRequest) {
  try {
    await requireSession()
    const payload = await request.json()
    const parsed = syncPushPayloadSchema.parse(payload)
    const { result, conflicts } = await applySyncPayload(parsed)
    const status = conflicts.length > 0 ? 409 : 200
    return NextResponse.json({ ...result, conflicts }, { status })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 })
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
