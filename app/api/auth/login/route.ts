import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyPassword } from "@/lib/auth/passwords"
import { getSession } from "@/lib/auth/session"
import { getUserByUsername } from "@/lib/users/repository"

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = loginSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const user = await getUserByUsername(parsed.data.username)
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isValid = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const session = await getSession()
    session.user = {
      id: user.id,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
    }
    await session.save()

    return NextResponse.json({ user: session.user })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
