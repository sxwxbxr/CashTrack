import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { updateAccount, deleteAccount } from "@/lib/accounts/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const updateSchema = z.object({
  name: z.string().min(1, "Account name is required").max(120),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const account = await updateAccount(params.id, { name: parsed.data.name })
    await recordUserAction(session.user, "account.update", "account", account.id, { account: account.name })
    return NextResponse.json({ account })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : "Unable to update account"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    await deleteAccount(params.id)
    await recordUserAction(session.user, "account.delete", "account", params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : "Unable to delete account"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
