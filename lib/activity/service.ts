import type { SessionUser } from "@/lib/auth/session"

import { CreateActivityInput, listRecentActivity, recordActivity } from "./repository"

export async function recordUserAction(
  user: SessionUser | undefined,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown> | null,
) {
  if (!user) {
    return
  }

  const payload: CreateActivityInput = {
    userId: user.id,
    username: user.username,
    action,
    entityType,
    entityId: entityId ?? null,
    details: details ?? null,
  }

  await recordActivity(payload)
}

export async function getRecentActivity(limit = 20) {
  return listRecentActivity({ limit })
}
