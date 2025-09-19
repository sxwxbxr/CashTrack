import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createBackup } from "@/lib/settings/service"

const backupTypeEnum = z.enum(["automatic", "manual"])

const createSchema = z
  .object({
    notes: z.string().optional(),
    size: z.coerce.number().optional(),
    type: backupTypeEnum.optional(),
  })
  .partial()

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => ({}))
    const parsed = createSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await createBackup(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
