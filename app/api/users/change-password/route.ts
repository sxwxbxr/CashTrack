import { NextResponse } from "next/server"
import { z } from "zod"

import { hashPassword, verifyPassword } from "@/lib/auth/passwords"
import { requireSession } from "@/lib/auth/session"
import { getUserById, updateUserPassword } from "@/lib/users/repository"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = changePasswordSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const session = await requireSession({ allowPasswordReset: true })
    const user = await getUserById(session.user.id)
    if (!user) {
      await session.destroy()
      return NextResponse.json({ error: "Session expired" }, { status: 401 })
    }

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
    }

    const passwordHash = await hashPassword(parsed.data.newPassword)
    const updated = await updateUserPassword(user.id, { passwordHash, mustChangePassword: false })
    if (!updated) {
      return NextResponse.json({ error: "Unable to update password" }, { status: 500 })
    }

    session.user = {
      id: updated.id,
      username: updated.username,
      mustChangePassword: updated.mustChangePassword,
    }
    await session.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
