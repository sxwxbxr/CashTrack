import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { removeConnectedAccount, updateConnectedAccount } from "@/lib/settings/service"

const currencyEnum = z.enum(["USD", "EUR", "GBP", "JPY", "CAD", "AUD"])
const accountTypeEnum = z.enum(["Checking", "Savings", "Credit Card", "Investment", "Loan", "Cash"])
const accountStatusEnum = z.enum(["connected", "disconnected", "error"])

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    institution: z.string().min(1).optional(),
    type: accountTypeEnum.optional(),
    status: accountStatusEnum.optional(),
    autoSync: z.boolean().optional(),
    currency: currencyEnum.optional(),
    balance: z.coerce.number().optional(),
  })
  .partial()

type RouteContext = { params: { id: string } }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = context.params

  if (!id) {
    return NextResponse.json({ error: "Account id is required" }, { status: 400 })
  }

  try {
    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await updateConnectedAccount(id, parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = context.params

  if (!id) {
    return NextResponse.json({ error: "Account id is required" }, { status: 400 })
  }

  try {
    const result = await removeConnectedAccount(id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
