import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { deleteUser, getUserById, setUserMustChangePassword } from "@/lib/users/repository"
import { recordUserAction } from "@/lib/activity/service"
import { sanitizeUser } from "@/lib/users/serialization"

const updateSchema = z.object({
  mustChangePassword: z.boolean(),
})

interface RouteParams {
  params: { userId: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession()
    if (session.user?.username !== "household") {
      return NextResponse.json({ error: "Only the household account can update users" }, { status: 403 })
    }

    const userId = params.userId
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const updated = await setUserMustChangePassword(userId, parsed.data.mustChangePassword)
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await recordUserAction(session.user, "user.update", "user", updated.id, {
      username: updated.username,
      mustChangePassword: updated.mustChangePassword,
    })

    return NextResponse.json({ user: sanitizeUser(updated) })
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

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession()
    if (session.user?.username !== "household") {
      return NextResponse.json({ error: "Only the household account can remove users" }, { status: 403 })
    }

    const userId = params.userId
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const existing = await getUserById(userId)
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (existing.username === "household") {
      return NextResponse.json({ error: "Cannot remove the shared household account" }, { status: 400 })
    }

    const removed = await deleteUser(userId)
    if (!removed) {
      return NextResponse.json({ error: "Unable to remove account" }, { status: 500 })
    }

    await recordUserAction(session.user, "user.delete", "user", existing.id, {
      username: existing.username,
    })

    return NextResponse.json({ user: sanitizeUser(existing) })
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
