import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createCsvTemplate } from "@/lib/settings/service"

const delimiterEnum = z.enum([",", ";", "\t", "|"])

const createSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  columns: z.array(z.string().min(1)).min(1, "At least one column is required"),
  delimiter: delimiterEnum.default(","),
  hasHeaders: z.boolean(),
  dateColumn: z.string().min(1, "Date column is required"),
  amountColumn: z.string().min(1, "Amount column is required"),
  descriptionColumn: z.string().min(1, "Description column is required"),
  active: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await createCsvTemplate(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
