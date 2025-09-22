import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createTransaction, listTransactions } from "@/lib/transactions/service"
import type { TransactionStatus, TransactionType } from "@/lib/transactions/types"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const querySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  status: z.enum(["pending", "completed", "cleared"]).optional(),
  account: z.string().optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  startDate: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), { message: "Invalid start date" }),
  endDate: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), { message: "Invalid end date" }),
  sortField: z.enum(["date", "amount", "description"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

const createSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().optional(),
  amount: z.coerce.number(),
  account: z.string().min(1, "Account is required"),
  status: z.enum(["pending", "completed", "cleared"]).default("completed"),
  type: z.enum(["income", "expense"]),
  notes: z.string().optional(),
})

type QueryParams = z.infer<typeof querySchema>

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { status, type, ...rest } = parsed.data
    const result = await listTransactions({
      ...rest,
      status: status as TransactionStatus | undefined,
      type: type as TransactionType | undefined,
    })
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const transaction = await createTransaction({
      ...parsed.data,
      categoryName: parsed.data.categoryName ?? "Uncategorized",
    })
    await recordUserAction(session.user, "transaction.create", "transaction", transaction.id, {
      amount: transaction.amount,
      description: transaction.description,
      account: transaction.account,
    })
    return NextResponse.json({ transaction }, { status: 201 })
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
