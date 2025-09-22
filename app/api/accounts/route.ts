import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { listAccounts, createAccount } from "@/lib/accounts/service"
import { recordUserAction } from "@/lib/activity/service"

const createSchema = z.object({
  name: z.string().min(1, "Account name is required").max(120),
})

export async function GET() {
  try {
    await requireSession()
    const accounts = await listAccounts()
    return NextResponse.json({ accounts })
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const account = await createAccount({ name: parsed.data.name })
    await recordUserAction(session.user, "account.create", "account", account.id, { account: account.name })
    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : "Unable to create account"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
