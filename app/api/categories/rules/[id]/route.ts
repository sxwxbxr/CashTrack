import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteAutomationRule, updateAutomationRule } from "@/lib/categories/service"

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  categoryId: z.string().min(1, "Category is required").optional(),
  type: z.enum(["contains", "starts_with", "ends_with", "exact", "regex"]).optional(),
  pattern: z.string().min(1, "Pattern is required").optional(),
  priority: z.coerce.number().int().min(1, "Priority must be at least 1").optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const rule = await updateAutomationRule(params.id, parsed.data)
    return NextResponse.json({ rule })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteAutomationRule(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
