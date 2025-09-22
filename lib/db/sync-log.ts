import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { prepareStatement } from "./client"

export type SyncEntityType =
  | "transaction"
  | "category"
  | "account"
  | "automation_rule"
  | "user"
  | "setting"

const insertSyncLogStatement = () =>
  prepareStatement(
    `INSERT OR REPLACE INTO sync_log (id, entityType, entityId, updatedAt) VALUES (@id, @entityType, @entityId, @updatedAt)`
  )

export function recordSyncLog(db: Database, entityType: SyncEntityType, entityId: string, updatedAt: string): void {
  insertSyncLogStatement().run({
    id: `sync_${randomUUID()}`,
    entityType,
    entityId,
    updatedAt,
  })
}
