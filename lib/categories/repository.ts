import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "../db"
import { recordSyncLog } from "../db/sync-log"
import type { Category } from "./types"

const databaseReady = initDatabase()

interface CategoryRow {
  id: string
  name: string
  icon: string
  color: string
  monthlyBudget: number
  createdAt: string
  updatedAt: string
}

export interface CategoryFilters {
  ids?: string[]
  names?: string[]
  search?: string
  updatedSince?: string
}

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    monthlyBudget: Number(row.monthlyBudget ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listCategories(filters: CategoryFilters = {}, db?: Database): Promise<Category[]> {
  const connection = await resolveDatabase(db)
  const clauses: string[] = []
  const parameters: unknown[] = []

  if (filters.ids?.length) {
    clauses.push(`id IN (${filters.ids.map(() => "?").join(", ")})`)
    parameters.push(...filters.ids)
  }

  if (filters.names?.length) {
    clauses.push(`name IN (${filters.names.map(() => "?").join(", ")})`)
    parameters.push(...filters.names)
  }

  if (filters.search) {
    clauses.push(`(name LIKE ? OR icon LIKE ?)`)
    const pattern = `%${filters.search.replace(/%/g, "%%")}%`
    parameters.push(pattern, pattern)
  }

  if (filters.updatedSince) {
    clauses.push(`updatedAt > ?`)
    parameters.push(filters.updatedSince)
  }

  let sql = "SELECT id, name, icon, color, monthlyBudget, createdAt, updatedAt FROM categories"
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`
  }
  sql += " ORDER BY name COLLATE NOCASE"

  const rows = connection.prepare(sql).all(...parameters) as CategoryRow[]
  return rows.map(mapRow)
}

export async function getCategoryById(id: string, db?: Database): Promise<Category | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT id, name, icon, color, monthlyBudget, createdAt, updatedAt FROM categories WHERE id = ?")
    .get(id) as CategoryRow | undefined
  return row ? mapRow(row) : null
}

export async function getCategoryByName(name: string, db?: Database): Promise<Category | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT id, name, icon, color, monthlyBudget, createdAt, updatedAt FROM categories WHERE name = ? COLLATE NOCASE")
    .get(name) as CategoryRow | undefined
  return row ? mapRow(row) : null
}

export interface CreateCategoryRecord {
  id: string
  name: string
  icon: string
  color: string
  monthlyBudget: number
}

export interface UpdateCategoryRecord {
  name?: string
  icon?: string
  color?: string
  monthlyBudget?: number
}

export async function insertCategory(record: CreateCategoryRecord, db?: Database): Promise<Category> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: CategoryRow = {
    ...record,
    monthlyBudget: record.monthlyBudget ?? 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      `INSERT INTO categories (id, name, icon, color, monthlyBudget, createdAt, updatedAt)
       VALUES (@id, @name, @icon, @color, @monthlyBudget, @createdAt, @updatedAt)`
    )
    .run(row)

  recordSyncLog(connection, "category", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateCategory(id: string, updates: UpdateCategoryRecord, db?: Database): Promise<Category | null> {
  const connection = await resolveDatabase(db)
  const existing = await getCategoryById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: CategoryRow = {
    ...existing,
    ...updates,
    monthlyBudget: updates.monthlyBudget ?? existing.monthlyBudget,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      `UPDATE categories
       SET name = @name,
           icon = @icon,
           color = @color,
           monthlyBudget = @monthlyBudget,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(updatedRow)

  recordSyncLog(connection, "category", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function deleteCategory(id: string, db?: Database): Promise<boolean> {
  const connection = await resolveDatabase(db)
  const result = connection.prepare("DELETE FROM categories WHERE id = ?").run(id)
  if (result.changes > 0) {
    const deletedAt = new Date().toISOString()
    recordSyncLog(connection, "category", id, deletedAt)
    return true
  }
  return false
}

export async function bulkUpsertCategories(records: CreateCategoryRecord[], db?: Database): Promise<Category[]> {
  if (records.length === 0) {
    return []
  }

  const upsertMany = (connection: Database) => {
    const statement = connection.prepare(
      `INSERT INTO categories (id, name, icon, color, monthlyBudget, createdAt, updatedAt)
       VALUES (@id, @name, @icon, @color, @monthlyBudget, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         color = excluded.color,
         monthlyBudget = excluded.monthlyBudget,
         updatedAt = excluded.updatedAt`
    )

    const results: Category[] = []
    for (const record of records) {
      const timestamp = new Date().toISOString()
      const row: CategoryRow = {
        ...record,
        monthlyBudget: record.monthlyBudget ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      statement.run(row)
      recordSyncLog(connection, "category", row.id, row.updatedAt)
      results.push(mapRow(row))
    }
    return results
  }

  if (db) {
    return upsertMany(db)
  }

  return withTransaction((connection) => upsertMany(connection))
}
