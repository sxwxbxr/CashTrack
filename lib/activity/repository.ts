import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { getDatabase, initDatabase } from "@/lib/db"

interface ActivityRow {
  id: string
  userId: string
  username: string
  action: string
  entityType: string
  entityId: string | null
  details: string | null
  createdAt: string
}

export interface ActivityRecord {
  id: string
  userId: string
  username: string
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export interface CreateActivityInput {
  userId: string
  username: string
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown> | null
  createdAt?: string
}

export interface ActivityQueryOptions {
  userId?: string
  actionPrefix?: string
  limit?: number
  since?: string
}

const databaseReady = initDatabase()

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function mapRow(row: ActivityRow): ActivityRecord {
  let parsedDetails: Record<string, unknown> | null = null

  if (row.details) {
    try {
      parsedDetails = JSON.parse(row.details) as Record<string, unknown>
    } catch {
      parsedDetails = { raw: row.details }
    }
  }

  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    details: parsedDetails,
    createdAt: row.createdAt,
  }
}

function buildQuery(filters: ActivityQueryOptions = {}) {
  const clauses: string[] = []
  const parameters: unknown[] = []

  if (filters.userId) {
    clauses.push("userId = ?")
    parameters.push(filters.userId)
  }

  if (filters.actionPrefix) {
    clauses.push("action LIKE ?")
    parameters.push(`${filters.actionPrefix.replace(/%/g, "%%")}%%`)
  }

  if (filters.since) {
    clauses.push("createdAt >= ?")
    parameters.push(filters.since)
  }

  return { clauses, parameters }
}

export async function recordActivity(input: CreateActivityInput, db?: Database): Promise<ActivityRecord> {
  const connection = await resolveDatabase(db)
  const now = input.createdAt ?? new Date().toISOString()
  const row: ActivityRow = {
    id: `act_${randomUUID()}`,
    userId: input.userId,
    username: input.username,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ? JSON.stringify(input.details) : null,
    createdAt: now,
  }

  connection
    .prepare(
      `INSERT INTO user_activity (id, userId, username, action, entityType, entityId, details, createdAt)
       VALUES (@id, @userId, @username, @action, @entityType, @entityId, @details, @createdAt)`
    )
    .run(row)

  return mapRow(row)
}

export async function listRecentActivity(
  filters: ActivityQueryOptions = {},
): Promise<ActivityRecord[]> {
  const connection = await resolveDatabase()
  const { clauses, parameters } = buildQuery(filters)

  let sql =
    "SELECT id, userId, username, action, entityType, entityId, details, createdAt FROM user_activity"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }

  sql += " ORDER BY datetime(createdAt) DESC"

  if (typeof filters.limit === "number") {
    sql += " LIMIT ?"
    parameters.push(filters.limit)
  }

  const rows = connection.prepare(sql).all(...parameters) as ActivityRow[]
  return rows.map(mapRow)
}

export async function pruneActivity(before: string): Promise<number> {
  const connection = await resolveDatabase()
  const statement = connection.prepare("DELETE FROM user_activity WHERE createdAt < ?")
  const result = statement.run(before)
  return result.changes ?? 0
}
