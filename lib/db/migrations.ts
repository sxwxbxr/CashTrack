import { getDatabase } from "./client"
import {
  CREATE_ACCOUNTS_TABLE,
  CREATE_AUTOMATION_RULES_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_SYNC_LOG_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_USER_ACTIVITY_TABLE,
  CREATE_USERS_TABLE,
} from "./schema"

let hasRunMigrations = false

function ensureIndexes() {
  const db = getDatabase()
  const statements = [
    "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_updatedAt ON transactions(updatedAt)",
    "CREATE INDEX IF NOT EXISTS idx_automation_rules_category_priority ON automation_rules(categoryId, priority DESC)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entityType, entityId)",
    "CREATE INDEX IF NOT EXISTS idx_user_activity_createdAt ON user_activity(createdAt DESC)",
    "CREATE INDEX IF NOT EXISTS idx_user_activity_userId ON user_activity(userId)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name)",
  ]

  for (const statement of statements) {
    db.exec(statement)
  }
}

export function runMigrations(): void {
  if (hasRunMigrations) {
    return
  }

  const db = getDatabase()
  const createStatements = [
    CREATE_USERS_TABLE,
    CREATE_CATEGORIES_TABLE,
    CREATE_ACCOUNTS_TABLE,
    CREATE_TRANSACTIONS_TABLE,
    CREATE_AUTOMATION_RULES_TABLE,
    CREATE_SYNC_LOG_TABLE,
    CREATE_SETTINGS_TABLE,
    CREATE_USER_ACTIVITY_TABLE,
  ]

  for (const statement of createStatements) {
    db.exec(statement)
  }

  ensureIndexes()
  hasRunMigrations = true
}
