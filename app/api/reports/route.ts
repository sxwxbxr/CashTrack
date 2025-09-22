import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { getReportAnalytics, type ReportPeriodKey } from "@/lib/reports/analytics"

const querySchema = z.object({
  period: z.enum(["last-3-months", "last-6-months", "last-12-months", "current-year"]).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const period: ReportPeriodKey = parsed.data.period ?? "last-3-months"
    const report = await getReportAnalytics(period)
    return NextResponse.json({ report })
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
