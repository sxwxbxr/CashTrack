import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "../db"
import { recordSyncLog } from "../db/sync-log"
import type { AutomationRule } from "./types"

const databaseReady = initDatabase()

interface AutomationRuleRow {
  id: string
  name: string
  categoryId: string
  type: string
  pattern: string
  priority: number
  isActive: number
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface AutomationRuleFilters {
  ids?: string[]
  categoryIds?: string[]
  activeOnly?: boolean
  updatedSince?: string
}

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function mapRow(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    type: row.type as AutomationRule["type"],
    pattern: row.pattern,
    priority: Number(row.priority ?? 0),
    isActive: Boolean(row.isActive),
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listAutomationRules(filters: AutomationRuleFilters = {}, db?: Database): Promise<AutomationRule[]> {
  const connection = await resolveDatabase(db)
  const clauses: string[] = []
  const parameters: unknown[] = []

  if (filters.ids?.length) {
    clauses.push(`id IN (${filters.ids.map(() => "?").join(", ")})`)
    parameters.push(...filters.ids)
  }

  if (filters.categoryIds?.length) {
    clauses.push(`categoryId IN (${filters.categoryIds.map(() => "?").join(", ")})`)
    parameters.push(...filters.categoryIds)
  }

  if (filters.activeOnly) {
    clauses.push(`isActive = 1`)
  }

  if (filters.updatedSince) {
    clauses.push(`updatedAt > ?`)
    parameters.push(filters.updatedSince)
  }

  let sql = "SELECT id, name, categoryId, type, pattern, priority, isActive, description, createdAt, updatedAt FROM automation_rules"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }
  sql += " ORDER BY priority DESC, name COLLATE NOCASE"

  const rows = connection.prepare(sql).all(...parameters) as AutomationRuleRow[]
  return rows.map(mapRow)
}

export async function getAutomationRuleById(id: string, db?: Database): Promise<AutomationRule | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare(
      "SELECT id, name, categoryId, type, pattern, priority, isActive, description, createdAt, updatedAt FROM automation_rules WHERE id = ?"
    )
    .get(id) as AutomationRuleRow | undefined
  return row ? mapRow(row) : null
}

export interface CreateAutomationRuleRecord {
  id: string
  name: string
  categoryId: string
  type: string
  pattern: string
  priority: number
  isActive: boolean
  description?: string | null
}

export interface UpdateAutomationRuleRecord {
  name?: string
  categoryId?: string
  type?: string
  pattern?: string
  priority?: number
  isActive?: boolean
  description?: string | null
}

export async function insertAutomationRule(record: CreateAutomationRuleRecord, db?: Database): Promise<AutomationRule> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: AutomationRuleRow = {
    id: record.id,
    name: record.name,
    categoryId: record.categoryId,
    type: record.type,
    pattern: record.pattern,
    priority: Number(record.priority ?? 0),
    isActive: record.isActive ? 1 : 0,
    description: record.description ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      `INSERT INTO automation_rules (id, name, categoryId, type, pattern, priority, isActive, description, createdAt, updatedAt)
       VALUES (@id, @name, @categoryId, @type, @pattern, @priority, @isActive, @description, @createdAt, @updatedAt)`
    )
    .run(row)

  recordSyncLog(connection, "automation_rule", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateAutomationRule(
  id: string,
  updates: UpdateAutomationRuleRecord,
  db?: Database
): Promise<AutomationRule | null> {
  const connection = await resolveDatabase(db)
  const existing = await getAutomationRuleById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: AutomationRuleRow = {
    ...existing,
    ...updates,
    categoryId: updates.categoryId ?? existing.categoryId,
    type: updates.type ?? existing.type,
    pattern: updates.pattern ?? existing.pattern,
    priority: updates.priority ?? existing.priority,
    isActive: updates.isActive === undefined ? (existing.isActive ? 1 : 0) : updates.isActive ? 1 : 0,
    description: updates.description ?? existing.description ?? null,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      `UPDATE automation_rules
       SET name = @name,
           categoryId = @categoryId,
           type = @type,
           pattern = @pattern,
           priority = @priority,
           isActive = @isActive,
           description = @description,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(updatedRow)

  recordSyncLog(connection, "automation_rule", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function deleteAutomationRule(id: string, db?: Database): Promise<boolean> {
  const connection = await resolveDatabase(db)
  const result = connection.prepare("DELETE FROM automation_rules WHERE id = ?").run(id)
  if (result.changes > 0) {
    const deletedAt = new Date().toISOString()
    recordSyncLog(connection, "automation_rule", id, deletedAt)
    return true
  }
  return false
}

export async function bulkUpsertAutomationRules(
  records: CreateAutomationRuleRecord[],
  db?: Database
): Promise<AutomationRule[]> {
  if (records.length === 0) {
    return []
  }

  const upsertMany = (connection: Database) => {
    const statement = connection.prepare(
      `INSERT INTO automation_rules (id, name, categoryId, type, pattern, priority, isActive, description, createdAt, updatedAt)
       VALUES (@id, @name, @categoryId, @type, @pattern, @priority, @isActive, @description, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         categoryId = excluded.categoryId,
         type = excluded.type,
         pattern = excluded.pattern,
         priority = excluded.priority,
         isActive = excluded.isActive,
         description = excluded.description,
         updatedAt = excluded.updatedAt`
    )

    const results: AutomationRule[] = []
    for (const record of records) {
      const timestamp = new Date().toISOString()
      const row: AutomationRuleRow = {
        id: record.id,
        name: record.name,
        categoryId: record.categoryId,
        type: record.type,
        pattern: record.pattern,
        priority: Number(record.priority ?? 0),
        isActive: record.isActive ? 1 : 0,
        description: record.description ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      statement.run(row)
      recordSyncLog(connection, "automation_rule", row.id, row.updatedAt)
      results.push(mapRow(row))
    }
    return results
  }

  if (db) {
    return upsertMany(db)
  }

  return withTransaction((connection) => upsertMany(connection))
}
