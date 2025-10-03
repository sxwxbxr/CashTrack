import { getDatabase } from "./client"
import { refreshSchema, runMigrations } from "./migrations"
import { seedIfNeeded } from "./seed"

let initialized = false
let initializingPromise: Promise<void> | null = null

export async function initDatabase(): Promise<void> {
  if (initialized) {
    return
  }

  if (initializingPromise) {
    return initializingPromise
  }

  initializingPromise = (async () => {
    runMigrations()
    await seedIfNeeded()
    initialized = true
  })()

  try {
    await initializingPromise
  } finally {
    initializingPromise = null
  }
}

export { getDatabase, withTransaction, prepareStatement } from "./client"
export function recoverFromSchemaError(): void {
  refreshSchema()
}
