import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { getReportAnalytics, type ReportPeriodKey } from "@/lib/reports/analytics"
import { buildReportPdf } from "@/lib/reports/pdf"

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
    const pdfBytes = await buildReportPdf(report)
    const fileName = `cashtrack-report-${period}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
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
