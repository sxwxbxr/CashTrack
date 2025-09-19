import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createConnectedAccount } from "@/lib/settings/service"

const currencyEnum = z.enum(["USD", "EUR", "GBP", "JPY", "CAD", "AUD"])
const accountTypeEnum = z.enum(["Checking", "Savings", "Credit Card", "Investment", "Loan", "Cash"])

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  institution: z.string().min(1, "Institution is required"),
  type: accountTypeEnum,
  currency: currencyEnum,
  autoSync: z.boolean().optional(),
  balance: z.coerce.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await createConnectedAccount(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
