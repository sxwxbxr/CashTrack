import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createCategory, listCategories } from "@/lib/categories/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { recordUserAction } from "@/lib/activity/service"

const querySchema = z.object({
  search: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
  monthlyBudget: z.coerce.number().min(0, "Budget must be at least 0"),
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

    const categories = await listCategories(parsed.data as QueryParams)
    return NextResponse.json({ categories })
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

    const category = await createCategory(parsed.data)
    await recordUserAction(session.user, "category.create", "category", category.id, {
      name: category.name,
    })
    return NextResponse.json({ category }, { status: 201 })
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
