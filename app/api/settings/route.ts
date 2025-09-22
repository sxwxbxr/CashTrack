import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAppSettings, updateAppSettings } from "@/lib/settings/service"
import { DATE_FORMATS } from "@/lib/settings/types"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

const backupFrequencyEnum = z.enum(["off", "daily", "weekly", "monthly"])
const dateFormatEnum = z.enum(DATE_FORMATS)

const currencySchema = z
  .string()
  .trim()
  .min(3)
  .max(3)
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase())

const updateSchema = z
  .object({
    allowLanSync: z.boolean().optional(),
    allowAutomaticBackups: z.boolean().optional(),
    autoBackupFrequency: backupFrequencyEnum.optional(),
    backupRetentionDays: z.coerce.number().int().min(7).max(365).optional(),
    currency: currencySchema.optional(),
    dateFormat: dateFormatEnum.optional(),
  })
  .strict()

type UpdatePayload = z.infer<typeof updateSchema>

export async function GET() {
  try {
    await requireSession({ allowPasswordReset: true })
    const settings = await getAppSettings()
    return NextResponse.json({ settings })
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

export async function PATCH(request: NextRequest) {
  try {
    await requireSession()
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const settings = await updateAppSettings(parsed.data as UpdatePayload)
    return NextResponse.json({ settings })
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
