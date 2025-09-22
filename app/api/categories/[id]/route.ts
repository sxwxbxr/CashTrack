import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { deleteCategory, updateCategory } from "@/lib/categories/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  icon: z.string().min(1, "Icon is required").optional(),
  color: z.string().min(1, "Color is required").optional(),
  monthlyBudget: z.coerce.number().min(0, "Budget must be at least 0").optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const category = await updateCategory(params.id, parsed.data)
    await recordUserAction(session.user, "category.update", "category", category.id, {
      changes: parsed.data,
    })
    return NextResponse.json({ category })
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
    await deleteCategory(params.id)
    await recordUserAction(session.user, "category.delete", "category", params.id)
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
