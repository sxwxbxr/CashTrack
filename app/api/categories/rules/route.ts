import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAutomationRule, listAutomationRules } from "@/lib/categories/service"

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

type CreateRulePayload = z.infer<typeof createSchema>

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const parsed = querySchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const rules = await listAutomationRules(parsed.data as QueryParams)
    return NextResponse.json(rules)
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

    const rule = await createAutomationRule(parsed.data as CreateRulePayload)
    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
