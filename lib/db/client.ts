import path from "path"
import Database from "better-sqlite3"

import { getDataDirectory } from "./paths"

let database: Database.Database | null = null
const statementCache = new Map<string, Database.Statement>()

function isMissingNativeBindingError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return (
    message.includes("could not locate the bindings file") ||
    message.includes("was not properly installed") ||
    message.includes("a dynamic link library (dll) initialization routine failed") ||
    message.includes("the specified module could not be found") ||
    (message.includes("cannot find module") && message.includes("better_sqlite3"))
  )
}

function createFriendlyBindingError(original: Error): Error {
  const runtime = `Node.js ${process.versions.node} (${process.platform}-${process.arch})`
  const message =
    "CashTrack can't open its local database because the native better-sqlite3 module failed to load. " +
    `The current runtime is ${runtime}. ` +
    "Reinstall the dependencies with `pnpm install` and then try again. " +
    "If the issue persists, rebuild the driver with `pnpm rebuild better-sqlite3`. " +
    "Windows users may need to install the \"Desktop development with C++\" workload from the Visual Studio Build Tools. " +
    `Original error: ${original.message}`

  const friendlyError = new Error(message)
  ;(friendlyError as { cause?: unknown }).cause = original
  return friendlyError
}

function createConnection(): Database.Database {
  const dataDirectory = getDataDirectory()
  const dbPath = path.join(dataDirectory, "cashtrack.db")
  try {
    const connection = new Database(dbPath)
    connection.pragma("journal_mode = WAL")
    connection.pragma("foreign_keys = ON")
    return connection
  } catch (error) {
    if (isMissingNativeBindingError(error)) {
      const friendlyError = createFriendlyBindingError(error)
      console.error("Failed to load better-sqlite3 native bindings", error)
      throw friendlyError
    }
    throw error
  }
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
