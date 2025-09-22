import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createTransfer } from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const createTransferSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  amount: z.coerce.number().gt(0, "Amount must be greater than zero"),
  fromAccount: z.string().min(1, "From account is required"),
  toAccount: z.string().min(1, "To account is required"),
  status: z.enum(["pending", "completed", "cleared"]).default("completed"),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = createTransferSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { transferId, transactions } = await createTransfer({
      date: parsed.data.date,
      description: parsed.data.description ?? "",
      amount: parsed.data.amount,
      fromAccount: parsed.data.fromAccount,
      toAccount: parsed.data.toAccount,
      status: parsed.data.status,
      notes: parsed.data.notes,
    })

    await recordUserAction(session.user, "transaction.transfer", "transaction", transferId, {
      amount: parsed.data.amount,
      fromAccount: parsed.data.fromAccount,
      toAccount: parsed.data.toAccount,
    })

    return NextResponse.json({ transferId, transactions }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : "Unable to create transfer"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
