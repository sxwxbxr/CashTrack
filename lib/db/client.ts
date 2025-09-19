import path from "path"
import Database from "better-sqlite3"

import { getDataDirectory } from "./paths"

let database: Database.Database | null = null
const statementCache = new Map<string, Database.Statement>()

function createConnection(): Database.Database {
  const dataDirectory = getDataDirectory()
  const dbPath = path.join(dataDirectory, "cashtrack.db")
  const connection = new Database(dbPath)
  connection.pragma("journal_mode = WAL")
  connection.pragma("foreign_keys = ON")
  return connection
}

export function getDatabase(): Database.Database {
  if (!database) {
    database = createConnection()
  }
  return database
}

export function prepareStatement(sql: string): Database.Statement {
  let statement = statementCache.get(sql)
  if (statement) {
    return statement
  }

  const db = getDatabase()
  statement = db.prepare(sql)
  statementCache.set(sql, statement)
  return statement
}

export async function withTransaction<T>(handler: (db: Database.Database) => Promise<T> | T): Promise<T> {
  const db = getDatabase()
  db.prepare("BEGIN IMMEDIATE").run()
  try {
    const result = await handler(db)
    db.prepare("COMMIT").run()
    return result
  } catch (error) {
    db.prepare("ROLLBACK").run()
    throw error
  }
}
