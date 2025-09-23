import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  deleteRecurringTransaction,
  getRecurringTransaction,
  updateRecurringTransactionSchedule,
} from "@/lib/transactions/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const updateSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
  interval: z.coerce.number().int().min(1).optional(),
  unit: z.enum(["day", "week", "month", "year"]).optional(),
  nextRunDate: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid next run date",
    }),
  isActive: z.boolean().optional(),
  status: z.enum(["pending", "completed", "cleared"]).optional(),
})

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession()
    const schedule = await getRecurringTransaction(params.id)
    if (!schedule) {
      return NextResponse.json({ error: "Recurring transaction not found" }, { status: 404 })
    }
    return NextResponse.json({ schedule })
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const schedule = await updateRecurringTransactionSchedule(params.id, parsed.data)
    await recordUserAction(session.user, "recurring.update", "recurring_transaction", schedule.id, parsed.data)
    return NextResponse.json({ schedule })
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
    await deleteRecurringTransaction(params.id)
    await recordUserAction(session.user, "recurring.delete", "recurring_transaction", params.id)
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
