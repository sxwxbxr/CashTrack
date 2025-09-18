import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createTransaction, listTransactions } from "@/lib/transactions/service"
import type { TransactionStatus, TransactionType } from "@/lib/transactions/types"

const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["pending", "completed", "cleared"]).optional(),
  account: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
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
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number(),
  account: z.string().min(1, "Account is required"),
  status: z.enum(["pending", "completed", "cleared"]).default("completed"),
  type: z.enum(["income", "expense"]),
  notes: z.string().optional(),
})

type QueryParams = z.infer<typeof querySchema>

type CreateTransactionPayload = z.infer<typeof createSchema>

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { status, type, ...rest } = parsed.data
    const result = await listTransactions({ ...rest, status: status as TransactionStatus | undefined, type: type as TransactionType | undefined })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const transaction = await createTransaction(parsed.data as CreateTransactionPayload)
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
