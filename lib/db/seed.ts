import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import type Database from "better-sqlite3"

import { getDatabase, withTransaction } from "./client"
import { getDataDirectory } from "./paths"

const DEFAULT_USERNAME = "household"
const DEFAULT_PASSWORD = "cashtrack"

async function readJsonFile<T>(filename: string): Promise<T | null> {
  const fullPath = path.join(getDataDirectory(), filename)
  try {
    const contents = await fs.readFile(fullPath, "utf8")
    return JSON.parse(contents) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw error
  }
}

function insertSyncLog(db: Database, entityType: string, entityId: string, updatedAt: string) {
  const logId = `sync_${randomUUID()}`
  db.prepare(
    `INSERT OR REPLACE INTO sync_log (id, entityType, entityId, updatedAt) VALUES (?, ?, ?, ?)`
  ).run(logId, entityType, entityId, updatedAt)
}

export async function seedIfNeeded(): Promise<void> {
  const db = getDatabase()
  const row = db.prepare<{ count: number }>("SELECT COUNT(*) as count FROM users").get()

  if (row?.count && row.count > 0) {
    return
  }

  const [categoriesJson, transactionsJson, rulesJson, settingsJson] = await Promise.all([
    readJsonFile<Array<Record<string, unknown>>>("categories.json"),
    readJsonFile<Array<Record<string, unknown>>>("transactions.json"),
    readJsonFile<Array<Record<string, unknown>>>("automation-rules.json"),
    readJsonFile<Record<string, unknown>>("settings.json"),
  ])

  const now = new Date().toISOString()

  await withTransaction(async (transactionDb) => {
    const categoryInsert = transactionDb.prepare(
      `INSERT INTO categories (id, name, icon, color, monthlyBudget, createdAt, updatedAt)
       VALUES (@id, @name, @icon, @color, @monthlyBudget, @createdAt, @updatedAt)`
    )

    const categories = Array.isArray(categoriesJson) ? categoriesJson : []
    const categoryIdByName = new Map<string, string>()

    categories.forEach((raw) => {
      if (!raw || typeof raw !== "object") {
        return
      }

      const id = String(raw.id ?? randomUUID())
      const name = String(raw.name ?? "Uncategorized")
      const category = {
        id,
        name,
        icon: String(raw.icon ?? "📁"),
        color: String(raw.color ?? "bg-slate-500"),
        monthlyBudget: Number(raw.monthlyBudget ?? 0),
        createdAt: String(raw.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? now),
      }

      categoryInsert.run(category)
      categoryIdByName.set(name.toLowerCase(), id)
      insertSyncLog(transactionDb, "category", id, category.updatedAt)
    })

    const transactionInsert = transactionDb.prepare(
      `INSERT INTO transactions (
        id,
        date,
        description,
        categoryId,
        categoryName,
        amount,
        account,
        status,
        type,
        notes,
        createdAt,
        updatedAt
      ) VALUES (@id, @date, @description, @categoryId, @categoryName, @amount, @account, @status, @type, @notes, @createdAt, @updatedAt)`
    )

    const transactions = Array.isArray(transactionsJson) ? transactionsJson : []
    transactions.forEach((raw) => {
      if (!raw || typeof raw !== "object") {
        return
      }

      const id = String(raw.id ?? `txn_${randomUUID()}`)
      const categoryName = String(raw.category ?? "Uncategorized")
      const normalizedName = categoryName.toLowerCase()
      const categoryId = categoryIdByName.get(normalizedName) ?? null
      const updatedAt = String(raw.updatedAt ?? now)

      const transaction = {
        id,
        date: String(raw.date ?? now.slice(0, 10)),
        description: String(raw.description ?? ""),
        categoryId,
        categoryName,
        amount: Number(raw.amount ?? 0),
        account: String(raw.account ?? "Unknown"),
        status: String(raw.status ?? "completed"),
        type: String(raw.type ?? "expense"),
        notes: raw.notes ? String(raw.notes) : null,
        createdAt: String(raw.createdAt ?? now),
        updatedAt,
      }

      transactionInsert.run(transaction)
      insertSyncLog(transactionDb, "transaction", id, transaction.updatedAt)
    })

    const ruleInsert = transactionDb.prepare(
      `INSERT INTO automation_rules (
        id,
        name,
        categoryId,
        type,
        pattern,
        priority,
        isActive,
        description,
        createdAt,
        updatedAt
      ) VALUES (@id, @name, @categoryId, @type, @pattern, @priority, @isActive, @description, @createdAt, @updatedAt)`
    )

    const rules = Array.isArray(rulesJson) ? rulesJson : []
    rules.forEach((raw) => {
      if (!raw || typeof raw !== "object") {
        return
      }

      const id = String(raw.id ?? `rule_${randomUUID()}`)
      const updatedAt = String(raw.updatedAt ?? now)
      const rule = {
        id,
        name: String(raw.name ?? "Rule"),
        categoryId: String(raw.categoryId ?? ""),
        type: String(raw.type ?? "contains"),
        pattern: String(raw.pattern ?? ""),
        priority: Number(raw.priority ?? 0),
        isActive: raw.isActive === undefined ? 1 : raw.isActive ? 1 : 0,
        description: raw.description ? String(raw.description) : null,
        createdAt: String(raw.createdAt ?? now),
        updatedAt,
      }

      ruleInsert.run(rule)
      insertSyncLog(transactionDb, "automation_rule", id, rule.updatedAt)
    })

    const settings = settingsJson && typeof settingsJson === "object" ? settingsJson : {}
    const settingsInsert = transactionDb.prepare(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)`
    )

    Object.entries(settings).forEach(([key, value]) => {
      const serialized = JSON.stringify(value)
      settingsInsert.run(key, serialized, now)
      insertSyncLog(transactionDb, "setting", key, now)
    })

    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 12)
    const userId = `usr_${randomUUID()}`
    transactionDb
      .prepare(
        `INSERT INTO users (id, username, passwordHash, mustChangePassword, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, DEFAULT_USERNAME, passwordHash, 1, now, now)
    insertSyncLog(transactionDb, "user", userId, now)
  })
}
