import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createAutomationRule, listAutomationRules } from "@/lib/categories/service"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

const querySchema = z.object({
  search: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  type: z.enum(["contains", "starts_with", "ends_with", "exact", "regex"]),
  pattern: z.string().min(1, "Pattern is required"),
  priority: z.coerce.number().int().min(1, "Priority must be at least 1"),
  isActive: z.boolean(),
  description: z.string().optional(),
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

    const rules = await listAutomationRules(parsed.data as QueryParams)
    return NextResponse.json(rules)
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
    await requireSession()
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { rule, reprocessedCount } = await createAutomationRule(parsed.data)
    return NextResponse.json({ rule, reprocessedCount }, { status: 201 })
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
