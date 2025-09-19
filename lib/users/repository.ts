import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "../db"
import { recordSyncLog } from "../db/sync-log"

export interface UserRow {
  id: string
  username: string
  passwordHash: string
  mustChangePassword: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  username: string
  passwordHash: string
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserRecord {
  id: string
  username: string
  passwordHash: string
  mustChangePassword?: boolean
}

export interface UpdatePasswordRecord {
  passwordHash: string
  mustChangePassword?: boolean
}

const databaseReady = initDatabase()

async function resolveDatabase(db?: Database): Promise<Database> {
  if (db) {
    return db
  }
  await databaseReady
  return getDatabase()
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    mustChangePassword: Boolean(row.mustChangePassword),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getUserById(id: string, db?: Database): Promise<User | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare("SELECT id, username, passwordHash, mustChangePassword, createdAt, updatedAt FROM users WHERE id = ?")
    .get(id) as UserRow | undefined
  return row ? mapRow(row) : null
}

export async function getUserByUsername(username: string, db?: Database): Promise<User | null> {
  const connection = await resolveDatabase(db)
  const row = connection
    .prepare(
      "SELECT id, username, passwordHash, mustChangePassword, createdAt, updatedAt FROM users WHERE username = ? COLLATE NOCASE"
    )
    .get(username) as UserRow | undefined
  return row ? mapRow(row) : null
}

export async function insertUser(record: CreateUserRecord, db?: Database): Promise<User> {
  const connection = await resolveDatabase(db)
  const timestamp = new Date().toISOString()
  const row: UserRow = {
    id: record.id,
    username: record.username,
    passwordHash: record.passwordHash,
    mustChangePassword: record.mustChangePassword ? 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  connection
    .prepare(
      `INSERT INTO users (id, username, passwordHash, mustChangePassword, createdAt, updatedAt)
       VALUES (@id, @username, @passwordHash, @mustChangePassword, @createdAt, @updatedAt)`
    )
    .run(row)

  recordSyncLog(connection, "user", row.id, row.updatedAt)
  return mapRow(row)
}

export async function updateUserPassword(
  id: string,
  updates: UpdatePasswordRecord,
  db?: Database
): Promise<User | null> {
  const connection = await resolveDatabase(db)
  const existing = await getUserById(id, connection)
  if (!existing) {
    return null
  }

  const updatedRow: UserRow = {
    ...existing,
    passwordHash: updates.passwordHash,
    mustChangePassword: updates.mustChangePassword === undefined ? (existing.mustChangePassword ? 1 : 0) : updates.mustChangePassword ? 1 : 0,
    updatedAt: new Date().toISOString(),
  }

  connection
    .prepare(
      `UPDATE users
       SET passwordHash = @passwordHash,
           mustChangePassword = @mustChangePassword,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(updatedRow)

  recordSyncLog(connection, "user", updatedRow.id, updatedRow.updatedAt)
  return mapRow(updatedRow)
}

export async function setUserMustChangePassword(id: string, mustChange: boolean, db?: Database): Promise<User | null> {
  const connection = await resolveDatabase(db)
  const existing = await getUserById(id, connection)
  if (!existing) {
    return null
  }
  return updateUserPassword(id, { passwordHash: existing.passwordHash, mustChangePassword: mustChange }, connection)
}

export async function listUsers(db?: Database): Promise<User[]> {
  const connection = await resolveDatabase(db)
  const rows = connection
    .prepare("SELECT id, username, passwordHash, mustChangePassword, createdAt, updatedAt FROM users ORDER BY createdAt ASC")
    .all() as UserRow[]
  return rows.map(mapRow)
}

export async function bulkUpsertUsers(records: CreateUserRecord[], db?: Database): Promise<User[]> {
  if (records.length === 0) {
    return []
  }

  const upsertMany = (connection: Database) => {
    const statement = connection.prepare(
      `INSERT INTO users (id, username, passwordHash, mustChangePassword, createdAt, updatedAt)
       VALUES (@id, @username, @passwordHash, @mustChangePassword, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         passwordHash = excluded.passwordHash,
         mustChangePassword = excluded.mustChangePassword,
         updatedAt = excluded.updatedAt`
    )

    const results: User[] = []
    for (const record of records) {
      const timestamp = new Date().toISOString()
      const row: UserRow = {
        id: record.id,
        username: record.username,
        passwordHash: record.passwordHash,
        mustChangePassword: record.mustChangePassword ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      statement.run(row)
      recordSyncLog(connection, "user", row.id, row.updatedAt)
      results.push(mapRow(row))
    }
    return results
  }

  if (db) {
    return upsertMany(db)
  }

  return withTransaction((connection) => upsertMany(connection))
}
