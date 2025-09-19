import type Database from "better-sqlite3"

import { withTransaction } from "@/lib/db"
import { recordSyncLog, type SyncEntityType } from "@/lib/db/sync-log"
import { listTransactions as listTransactionRecords, getTransactionById } from "@/lib/transactions/repository"
import type { Transaction } from "@/lib/transactions/types"
import { listCategories as listCategoryRecords, getCategoryById } from "@/lib/categories/repository"
import type { Category } from "@/lib/categories/types"
import { listAutomationRules as listAutomationRuleRecords, getAutomationRuleById } from "@/lib/categories/rule-repository"
import type { AutomationRule } from "@/lib/categories/types"
import { listSettingRows, setSettingRow, type SettingRow } from "@/lib/settings/repository"
import { listUsers, getUserById, type User } from "@/lib/users/repository"
import { markSyncCompleted } from "@/lib/settings/service"
import {
  automationRuleSchema,
  backupSnapshotSchema,
  categorySchema,
  settingRowSchema,
  syncPushPayloadSchema,
  transactionSchema,
  type BackupSnapshot,
  type SyncPushPayload,
  userSchema,
} from "@/lib/sync/schemas"

export interface SyncConflict {
  entityType: SyncEntityType | "user"
  entityId: string
  localUpdatedAt: string
  incomingUpdatedAt: string
}

export interface SyncResult {
  cursor: string
  transactions: Transaction[]
  categories: Category[]
  rules: AutomationRule[]
  settings: Array<{ key: string; value: unknown; updatedAt: string }>
  users: User[]
}

function parseSettingValue(row: SettingRow): { key: string; value: unknown; updatedAt: string } {
  try {
    return { key: row.key, value: JSON.parse(row.value), updatedAt: row.updatedAt }
  } catch {
    return { key: row.key, value: row.value, updatedAt: row.updatedAt }
  }
}

function compareTimestamps(a: string, b: string): number {
  if (a === b) return 0
  return a > b ? 1 : -1
}

async function fetchTransactionsSince(updatedSince?: string): Promise<Transaction[]> {
  const filters = updatedSince ? { updatedSince } : {}
  const options = { orderBy: "updatedAt" as const, orderDirection: "asc" as const }
  return listTransactionRecords(filters, options)
}

export async function pullChanges(since?: string): Promise<SyncResult> {
  const [transactions, categories, rules, settingsRows, users] = await Promise.all([
    fetchTransactionsSince(since),
    listCategoryRecords(since ? { updatedSince: since } : {}),
    listAutomationRuleRecords(since ? { updatedSince: since } : {}),
    listSettingRows(since),
    listUsers(),
  ])

  const cursor = new Date().toISOString()

  return {
    cursor,
    transactions,
    categories,
    rules,
    settings: settingsRows.map(parseSettingValue),
    users,
  }
}

function loadExistingTimestamp(
  db: Database,
  table: string,
  id: string,
): string | null {
  const row = db.prepare<{ updatedAt: string }>(`SELECT updatedAt FROM ${table} WHERE id = ?`).get(id)
  return row?.updatedAt ?? null
}

async function applyTransactionRecords(
  db: Database,
  records: SyncPushPayload["transactions"],
): Promise<{ applied: Transaction[]; conflicts: SyncConflict[] }> {
  if (!records?.length) {
    return { applied: [], conflicts: [] }
  }

  const statement = db.prepare(
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
     ) VALUES (@id, @date, @description, @categoryId, @categoryName, @amount, @account, @status, @type, @notes, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date,
       description = excluded.description,
       categoryId = excluded.categoryId,
       categoryName = excluded.categoryName,
       amount = excluded.amount,
       account = excluded.account,
       status = excluded.status,
       type = excluded.type,
       notes = excluded.notes,
       updatedAt = excluded.updatedAt`
  )

  const applied: Transaction[] = []
  const conflicts: SyncConflict[] = []

  for (const record of records) {
    const parsed = transactionSchema.parse(record)
    const existingUpdatedAt = loadExistingTimestamp(db, "transactions", parsed.id)
    if (existingUpdatedAt && compareTimestamps(existingUpdatedAt, parsed.updatedAt) === 1) {
      conflicts.push({
        entityType: "transaction",
        entityId: parsed.id,
        localUpdatedAt: existingUpdatedAt,
        incomingUpdatedAt: parsed.updatedAt,
      })
      continue
    }

    statement.run({
      ...parsed,
      categoryId: parsed.categoryId ?? null,
      notes: parsed.notes ?? null,
    })
    recordSyncLog(db, "transaction", parsed.id, parsed.updatedAt)
    const final = await getTransactionById(parsed.id, db)
    if (final) {
      applied.push(final)
    }
  }

  return { applied, conflicts }
}

async function applyCategoryRecords(
  db: Database,
  records: SyncPushPayload["categories"],
): Promise<{ applied: Category[]; conflicts: SyncConflict[] }> {
  if (!records?.length) {
    return { applied: [], conflicts: [] }
  }

  const statement = db.prepare(
    `INSERT INTO categories (id, name, icon, color, monthlyBudget, createdAt, updatedAt)
     VALUES (@id, @name, @icon, @color, @monthlyBudget, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       color = excluded.color,
       monthlyBudget = excluded.monthlyBudget,
       updatedAt = excluded.updatedAt`
  )

  const applied: Category[] = []
  const conflicts: SyncConflict[] = []

  for (const record of records) {
    const parsed = categorySchema.parse(record)
    const existingUpdatedAt = loadExistingTimestamp(db, "categories", parsed.id)
    if (existingUpdatedAt && compareTimestamps(existingUpdatedAt, parsed.updatedAt) === 1) {
      conflicts.push({
        entityType: "category",
        entityId: parsed.id,
        localUpdatedAt: existingUpdatedAt,
        incomingUpdatedAt: parsed.updatedAt,
      })
      continue
    }

    statement.run({
      ...parsed,
      monthlyBudget: Number(parsed.monthlyBudget ?? 0),
    })
    recordSyncLog(db, "category", parsed.id, parsed.updatedAt)
    const final = await getCategoryById(parsed.id, db)
    if (final) {
      applied.push(final)
    }
  }

  return { applied, conflicts }
}

async function applyAutomationRuleRecords(
  db: Database,
  records: SyncPushPayload["rules"],
): Promise<{ applied: AutomationRule[]; conflicts: SyncConflict[] }> {
  if (!records?.length) {
    return { applied: [], conflicts: [] }
  }

  const statement = db.prepare(
    `INSERT INTO automation_rules (id, name, categoryId, type, pattern, priority, isActive, description, createdAt, updatedAt)
     VALUES (@id, @name, @categoryId, @type, @pattern, @priority, @isActive, @description, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       categoryId = excluded.categoryId,
       type = excluded.type,
       pattern = excluded.pattern,
       priority = excluded.priority,
       isActive = excluded.isActive,
       description = excluded.description,
       updatedAt = excluded.updatedAt`
  )

  const applied: AutomationRule[] = []
  const conflicts: SyncConflict[] = []

  for (const record of records) {
    const parsed = automationRuleSchema.parse(record)
    const existingUpdatedAt = loadExistingTimestamp(db, "automation_rules", parsed.id)
    if (existingUpdatedAt && compareTimestamps(existingUpdatedAt, parsed.updatedAt) === 1) {
      conflicts.push({
        entityType: "automation_rule",
        entityId: parsed.id,
        localUpdatedAt: existingUpdatedAt,
        incomingUpdatedAt: parsed.updatedAt,
      })
      continue
    }

    statement.run({
      ...parsed,
      priority: Number(parsed.priority ?? 0),
      isActive: parsed.isActive ? 1 : 0,
      description: parsed.description ?? null,
    })
    recordSyncLog(db, "automation_rule", parsed.id, parsed.updatedAt)
    const final = await getAutomationRuleById(parsed.id, db)
    if (final) {
      applied.push(final)
    }
  }

  return { applied, conflicts }
}

async function applySettingRecords(
  db: Database,
  records: SyncPushPayload["settings"],
): Promise<{ applied: Array<{ key: string; value: unknown; updatedAt: string }>; conflicts: SyncConflict[] }> {
  if (!records?.length) {
    return { applied: [], conflicts: [] }
  }

  const applied: Array<{ key: string; value: unknown; updatedAt: string }> = []
  const conflicts: SyncConflict[] = []

  for (const record of records) {
    const parsed = settingRowSchema.parse(record)
    const existing = db
      .prepare<{ updatedAt: string }>("SELECT updatedAt FROM settings WHERE key = ?")
      .get(parsed.key)

    if (existing?.updatedAt && compareTimestamps(existing.updatedAt, parsed.updatedAt) === 1) {
      conflicts.push({
        entityType: "setting",
        entityId: parsed.key,
        localUpdatedAt: existing.updatedAt,
        incomingUpdatedAt: parsed.updatedAt,
      })
      continue
    }

    await setSettingRow(parsed.key, parsed.value, { db, updatedAt: parsed.updatedAt })
    applied.push({ key: parsed.key, value: parsed.value, updatedAt: parsed.updatedAt })
  }

  return { applied, conflicts }
}

async function applyUserRecords(
  db: Database,
  records: SyncPushPayload["users"],
): Promise<{ applied: User[]; conflicts: SyncConflict[] }> {
  if (!records?.length) {
    return { applied: [], conflicts: [] }
  }

  const statement = db.prepare(
    `INSERT INTO users (id, username, passwordHash, mustChangePassword, createdAt, updatedAt)
     VALUES (@id, @username, @passwordHash, @mustChangePassword, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       passwordHash = excluded.passwordHash,
       mustChangePassword = excluded.mustChangePassword,
       updatedAt = excluded.updatedAt`
  )

  const applied: User[] = []
  const conflicts: SyncConflict[] = []

  for (const record of records) {
    const parsed = userSchema.parse(record)
    const existingUpdatedAt = loadExistingTimestamp(db, "users", parsed.id)
    if (existingUpdatedAt && compareTimestamps(existingUpdatedAt, parsed.updatedAt) === 1) {
      conflicts.push({
        entityType: "user",
        entityId: parsed.id,
        localUpdatedAt: existingUpdatedAt,
        incomingUpdatedAt: parsed.updatedAt,
      })
      continue
    }

    statement.run({
      ...parsed,
      mustChangePassword: parsed.mustChangePassword ? 1 : 0,
    })
    recordSyncLog(db, "user", parsed.id, parsed.updatedAt)
    const final = await getUserById(parsed.id, db)
    if (final) {
      applied.push(final)
    }
  }

  return { applied, conflicts }
}

export async function applySyncPayload(payload: SyncPushPayload) {
  const validated = syncPushPayloadSchema.parse(payload)

  let result: SyncResult | null = null
  const conflicts: SyncConflict[] = []

  await withTransaction(async (db) => {
    const [transactionResult, categoryResult, ruleResult, settingResult, userResult] = await Promise.all([
      applyTransactionRecords(db, validated.transactions),
      applyCategoryRecords(db, validated.categories),
      applyAutomationRuleRecords(db, validated.rules),
      applySettingRecords(db, validated.settings),
      applyUserRecords(db, validated.users),
    ])

    conflicts.push(
      ...transactionResult.conflicts,
      ...categoryResult.conflicts,
      ...ruleResult.conflicts,
      ...settingResult.conflicts,
      ...userResult.conflicts,
    )

    result = {
      cursor: new Date().toISOString(),
      transactions: transactionResult.applied,
      categories: categoryResult.applied,
      rules: ruleResult.applied,
      settings: settingResult.applied,
      users: userResult.applied,
    }
  })

  if (!result) {
    throw new Error("Failed to apply sync payload")
  }

  if (conflicts.length === 0) {
    await markSyncCompleted(result.cursor)
  }

  return { result, conflicts }
}

export async function exportSnapshot(): Promise<BackupSnapshot> {
  const [transactions, categories, rules, settingsRows, users] = await Promise.all([
    listTransactionRecords({}, { orderBy: "updatedAt", orderDirection: "asc" }),
    listCategoryRecords({}, undefined),
    listAutomationRuleRecords({}, undefined),
    listSettingRows(),
    listUsers(),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    rules,
    settings: settingsRows.map(parseSettingValue),
    users,
  }
}

export async function importSnapshot(snapshot: BackupSnapshot) {
  const validated = backupSnapshotSchema.parse(snapshot)

  await withTransaction(async (db) => {
    db.exec(
      `DELETE FROM transactions;
       DELETE FROM categories;
       DELETE FROM automation_rules;
       DELETE FROM settings;
       DELETE FROM users;
       DELETE FROM sync_log;`,
    )

    await applyCategoryRecords(db, validated.categories)
    await applyTransactionRecords(db, validated.transactions)
    await applyAutomationRuleRecords(db, validated.rules)
    await applySettingRecords(db, validated.settings)
    await applyUserRecords(db, validated.users)
  })

  await markSyncCompleted(new Date().toISOString())
}
