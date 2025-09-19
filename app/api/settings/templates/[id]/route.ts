import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { removeCsvTemplate, updateCsvTemplate } from "@/lib/settings/service"

const delimiterEnum = z.enum([",", ";", "\t", "|"])

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    columns: z.array(z.string().min(1)).optional(),
    delimiter: delimiterEnum.optional(),
    hasHeaders: z.boolean().optional(),
    dateColumn: z.string().min(1).optional(),
    amountColumn: z.string().min(1).optional(),
    descriptionColumn: z.string().min(1).optional(),
    active: z.boolean().optional(),
  })
  .partial()

type RouteContext = { params: { id: string } }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = context.params

  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await updateCsvTemplate(id, parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = context.params

  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 })
  }

  try {
    const result = await removeCsvTemplate(id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
