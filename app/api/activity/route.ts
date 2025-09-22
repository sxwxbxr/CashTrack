import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { listRecentActivity } from "@/lib/activity/repository"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"

const querySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .optional()
    .refine((value) => value === undefined || (Number.isFinite(value) && value > 0 && value <= 200), {
      message: "Limit must be between 1 and 200",
    }),
})

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.user?.username !== "household") {
      return NextResponse.json({ error: "Only the household account can view activity" }, { status: 403 })
    }

    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const limit = parsed.data.limit ?? 50
    const activities = await listRecentActivity({ limit })
    return NextResponse.json({ activities })
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
