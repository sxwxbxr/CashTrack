import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { AuthenticationError, PasswordChangeRequiredError, requireSession } from "@/lib/auth/session"
import { backupSnapshotSchema } from "@/lib/sync/schemas"
import { importSnapshot } from "@/lib/sync/service"
import { getAppSettings } from "@/lib/settings/service"

export async function POST(request: NextRequest) {
  try {
    await requireSession()
    const contentType = request.headers.get("content-type") ?? ""
    let snapshotRaw: unknown

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file")
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Backup file is required" }, { status: 400 })
      }
      const text = await file.text()
      snapshotRaw = JSON.parse(text)
    } else {
      snapshotRaw = await request.json()
    }

    const snapshot = backupSnapshotSchema.parse(snapshotRaw)
    await importSnapshot(snapshot)
    const settings = await getAppSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON backup" }, { status: 400 })
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
