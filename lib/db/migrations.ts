import { getDatabase } from "./client"
import {
  CREATE_ACCOUNTS_TABLE,
  CREATE_AUTOMATION_RULES_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_RECURRING_TRANSACTIONS_TABLE,
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

function ensureRecurringTransactionColumns() {
  const db = getDatabase()
  const columns = db.prepare("PRAGMA table_info(recurring_transactions)").all() as Array<{ name: string }>
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has("accountAmount")) {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN accountAmount REAL NOT NULL DEFAULT 0")
    db.exec("UPDATE recurring_transactions SET accountAmount = ABS(amount)")
  }

  if (!columnNames.has("originalAmount")) {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN originalAmount REAL NOT NULL DEFAULT 0")
    db.exec("UPDATE recurring_transactions SET originalAmount = ABS(amount)")
  }

  if (!columnNames.has("currency")) {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
  }

  if (!columnNames.has("exchangeRate")) {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN exchangeRate REAL NOT NULL DEFAULT 1")
  }
}

function ensureLatestSchema() {
  ensureAccountCurrencyColumn()
  ensureTransactionColumns()
  ensureRecurringTransactionColumns()
  ensureIndexes()
}

function ensureAccountCurrencyColumn() {
  const db = getDatabase()
  const columns = db.prepare("PRAGMA table_info(accounts)").all() as Array<{ name: string }>
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has("currency")) {
    db.exec("ALTER TABLE accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
  }
}

function ensureTransactionColumns() {
  const db = getDatabase()
  const columns = db.prepare("PRAGMA table_info(transactions)").all() as Array<{ name: string }>
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has("transferGroupId")) {
    db.exec("ALTER TABLE transactions ADD COLUMN transferGroupId TEXT")
  }

  if (!columnNames.has("transferDirection")) {
    db.exec("ALTER TABLE transactions ADD COLUMN transferDirection TEXT")
  }

  if (!columnNames.has("accountAmount")) {
    db.exec("ALTER TABLE transactions ADD COLUMN accountAmount REAL NOT NULL DEFAULT 0")
    db.exec("UPDATE transactions SET accountAmount = amount")
  }

  if (!columnNames.has("originalAmount")) {
    db.exec("ALTER TABLE transactions ADD COLUMN originalAmount REAL NOT NULL DEFAULT 0")
    db.exec("UPDATE transactions SET originalAmount = amount")
  }

  if (!columnNames.has("currency")) {
    db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
  }

  if (!columnNames.has("exchangeRate")) {
    db.exec("ALTER TABLE transactions ADD COLUMN exchangeRate REAL NOT NULL DEFAULT 1")
  }
}

export function runMigrations(force = false): void {
  if (hasRunMigrations && !force) {
    return
  }

  const db = getDatabase()
  const createStatements = [
    CREATE_USERS_TABLE,
    CREATE_CATEGORIES_TABLE,
    CREATE_ACCOUNTS_TABLE,
    CREATE_TRANSACTIONS_TABLE,
    CREATE_RECURRING_TRANSACTIONS_TABLE,
    CREATE_AUTOMATION_RULES_TABLE,
    CREATE_SYNC_LOG_TABLE,
    CREATE_SETTINGS_TABLE,
    CREATE_USER_ACTIVITY_TABLE,
  ]

  for (const statement of createStatements) {
    db.exec(statement)
  }

  ensureLatestSchema()
  hasRunMigrations = true
}

export function refreshSchema(): void {
  runMigrations(true)
}
