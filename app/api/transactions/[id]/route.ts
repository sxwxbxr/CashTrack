import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { deleteTransaction, updateTransaction } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const updateSchema = z.object({
  date: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().optional(),
  amount: z.coerce.number().optional(),
  account: z.string().optional(),
  status: z.enum(["pending", "completed", "cleared"]).optional(),
  type: z.enum(["income", "expense"]).optional(),
  notes: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const transaction = await updateTransaction(params.id, parsed.data)
    await recordUserAction(session.user, "transaction.update", "transaction", transaction.id, {
      changes: parsed.data,
    })
    return NextResponse.json({ transaction })
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

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    await deleteTransaction(params.id)
    await recordUserAction(session.user, "transaction.delete", "transaction", params.id)
    return NextResponse.json({ success: true })
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
