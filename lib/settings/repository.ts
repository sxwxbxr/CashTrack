import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "../db"
import { recordSyncLog } from "../db/sync-log"

const databaseReady = initDatabase()

export interface SettingRow {
  key: string
  value: string
  updatedAt: string
}

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

export async function getSettingRow(key: string, db?: Database): Promise<SettingRow | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT key, value, updatedAt FROM settings WHERE key = ?")
    .get(key) as SettingRow | undefined
  return row ?? null
}

export async function listSettingRows(updatedSince?: string, db?: Database): Promise<SettingRow[]> {
  const connection = await resolveDatabase(db)
  let sql = "SELECT key, value, updatedAt FROM settings"
  const params: unknown[] = []
  if (updatedSince) {
    sql += " WHERE updatedAt > ?"
    params.push(updatedSince)
  }
  sql += " ORDER BY updatedAt ASC"
  const rows = connection.prepare(sql).all(...params) as SettingRow[]
  return rows
}

interface SetSettingOptions {
  updatedAt?: string
  db?: Database
}

export async function setSettingRow(
  key: string,
  value: unknown,
  options: SetSettingOptions = {},
): Promise<SettingRow> {
  const serialize = JSON.stringify(value)
  const performUpsert = async (connection: Database) => {
    const timestamp = options.updatedAt ?? new Date().toISOString()
    connection
      .prepare(
        `INSERT INTO settings (key, value, updatedAt)
         VALUES (@key, @value, @updatedAt)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
      )
      .run({ key, value: serialize, updatedAt: timestamp })
    recordSyncLog(connection, "setting", key, timestamp)
    return { key, value: serialize, updatedAt: timestamp }
  }

  if (options.db) {
    return performUpsert(options.db)
  }

  return withTransaction((connection) => performUpsert(connection))
}

export async function deleteSettingRow(key: string, db?: Database): Promise<boolean> {
  const performDelete = (connection: Database) => {
    const result = connection.prepare("DELETE FROM settings WHERE key = ?").run(key)
    if (result.changes > 0) {
      const timestamp = new Date().toISOString()
      recordSyncLog(connection, "setting", key, timestamp)
      return true
    }
    return false
  }

  if (db) {
    return performDelete(db)
  }

  return withTransaction((connection) => performDelete(connection))
}
