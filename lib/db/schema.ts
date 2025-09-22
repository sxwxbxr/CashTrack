export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    mustChangePassword INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`

export const CREATE_CATEGORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    monthlyBudget REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`

export const CREATE_ACCOUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`

export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    categoryId TEXT,
    categoryName TEXT NOT NULL,
    amount REAL NOT NULL,
    account TEXT NOT NULL,
    status TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
  )
`

export const CREATE_AUTOMATION_RULES_TABLE = `
  CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    categoryId TEXT NOT NULL,
    type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE CASCADE
  )
`

export const CREATE_SYNC_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`

export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`

export const CREATE_USER_ACTIVITY_TABLE = `
  CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT,
    details TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`
