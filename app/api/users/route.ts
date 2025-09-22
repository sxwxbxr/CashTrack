import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { hashPassword } from "@/lib/auth/passwords"
import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { insertUser, listUsers } from "@/lib/users/repository"
import { recordUserAction } from "@/lib/activity/service"

const createSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores, or dashes"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  mustChangePassword: z.boolean().optional().default(true),
})

function sanitizeUser(user: { id: string; username: string; mustChangePassword: boolean; createdAt: string; updatedAt: string }) {
  return {
    id: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.user?.username !== "household") {
      return NextResponse.json({ error: "Only the household account can manage users" }, { status: 403 })
    }

    const users = await listUsers()
    return NextResponse.json({ users: users.map(sanitizeUser) })
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.user?.username !== "household") {
      return NextResponse.json({ error: "Only the household account can create users" }, { status: 403 })
    }

    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const passwordHash = await hashPassword(parsed.data.password)
    const user = await insertUser({
      id: `usr_${randomUUID()}`,
      username: parsed.data.username,
      passwordHash,
      mustChangePassword: parsed.data.mustChangePassword,
    })

    await recordUserAction(session.user, "user.create", "user", user.id, {
      username: user.username,
      mustChangePassword: user.mustChangePassword,
    })

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 })
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
