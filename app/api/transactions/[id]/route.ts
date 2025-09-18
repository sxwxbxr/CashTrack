import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteTransaction, updateTransaction } from "@/lib/transactions/service"

const updateSchema = z.object({
  date: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.coerce.number().optional(),
  account: z.string().optional(),
  status: z.enum(["pending", "completed", "cleared"]).optional(),
  type: z.enum(["income", "expense"]).optional(),
  notes: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const transaction = await updateTransaction(params.id, parsed.data)
    return NextResponse.json({ transaction })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteTransaction(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
