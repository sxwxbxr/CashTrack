import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSettings, updateSettingsSections } from "@/lib/settings/service"

const currencyEnum = z.enum(["USD", "EUR", "GBP", "JPY", "CAD", "AUD"])
const dateFormatEnum = z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"])
const themeEnum = z.enum(["light", "dark", "system"])
const startOfWeekEnum = z.enum(["Sunday", "Monday"])
const backupFrequencyEnum = z.enum(["off", "daily", "weekly", "monthly"])

const generalSchema = z
  .object({
    currency: currencyEnum.optional(),
    dateFormat: dateFormatEnum.optional(),
    theme: themeEnum.optional(),
    fiscalYearStartMonth: z.string().min(1).optional(),
    startOfWeek: startOfWeekEnum.optional(),
    language: z.string().min(1).optional(),
    autoCategorizeTransactions: z.boolean().optional(),
    showRoundedTotals: z.boolean().optional(),
  })
  .partial()

const notificationsSchema = z
  .object({
    budgetAlerts: z.boolean().optional(),
    weeklyReports: z.boolean().optional(),
    monthlyReports: z.boolean().optional(),
    transactionReminders: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
    productUpdates: z.boolean().optional(),
  })
  .partial()

const privacySchema = z
  .object({
    dataEncryption: z.boolean().optional(),
    autoBackup: z.boolean().optional(),
    shareAnalytics: z.boolean().optional(),
    rememberDevices: z.boolean().optional(),
    requireMfa: z.boolean().optional(),
  })
  .partial()

const backupsSchema = z
  .object({
    autoBackupFrequency: backupFrequencyEnum.optional(),
    retentionDays: z.coerce.number().int().min(7).max(365).optional(),
  })
  .partial()

const updateSchema = z.object({
  general: generalSchema.optional(),
  notifications: notificationsSchema.optional(),
  privacy: privacySchema.optional(),
  backups: backupsSchema.optional(),
})

type UpdatePayload = z.infer<typeof updateSchema>

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const settings = await updateSettingsSections(parsed.data as UpdatePayload)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
