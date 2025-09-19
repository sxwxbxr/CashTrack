import { NextRequest, NextResponse } from "next/server"
import { syncConnectedAccount } from "@/lib/settings/service"

type RouteContext = { params: { id: string } }

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = context.params

  if (!id) {
    return NextResponse.json({ error: "Account id is required" }, { status: 400 })
  }

  try {
    const result = await syncConnectedAccount(id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
