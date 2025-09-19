import { randomUUID } from "crypto"
import type Database from "better-sqlite3"

import { getDatabase, initDatabase, withTransaction } from "@/lib/db"
import { recordSyncLog } from "@/lib/db/sync-log"
import { matchesAutomationRule } from "@/lib/categories/rule-matcher"
import {
  getCategoryById,
  getCategoryByName,
  insertCategory,
  listCategories as listCategoryRecords,
  updateCategory as updateCategoryRecord,
  deleteCategory as deleteCategoryRecord,
} from "@/lib/categories/repository"
import {
  insertAutomationRule,
  listAutomationRules as listAutomationRuleRecords,
  updateAutomationRule as updateAutomationRuleRecord,
  deleteAutomationRule as deleteAutomationRuleRecord,
} from "@/lib/categories/rule-repository"
import type {
  AutomationRule,
  AutomationRuleWithStats,
  CategoryWithStats,
  CreateAutomationRuleInput,
  CreateCategoryInput,
  RuleListResult,
  RuleMatchType,
  UpdateAutomationRuleInput,
  UpdateCategoryInput,
} from "@/lib/categories/types"
import type { Transaction } from "@/lib/transactions/types"
import { listTransactions as listTransactionRecords } from "@/lib/transactions/repository"
import { reapplyAutomationRules } from "@/lib/transactions/service"

void initDatabase()

type CategoryListParams = {
  search?: string
}

type RuleListParams = {
  search?: string
}

type AutomationRuleMutationResult = {
  rule: AutomationRuleWithStats
  reprocessedCount: number
}

const RULE_TYPES: RuleMatchType[] = ["contains", "starts_with", "ends_with", "exact", "regex"]

function normalizeName(name: string): string {
  return name.trim()
}

function sanitizeBudget(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, Number(value))
}

async function getCategoryStats(categoryId: string, categoryName: string, db?: Database) {
  const connection = db ?? getDatabase()
  const row = connection
    .prepare(
      `SELECT
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent,
         COUNT(id) AS transactionCount
       FROM transactions
       WHERE categoryId = ? OR (categoryId IS NULL AND categoryName = ?)`
    )
    .get(categoryId, categoryName) as { spent: number | null; transactionCount: number | null } | undefined

  return {
    spent: Number(row?.spent ?? 0),
    transactionCount: Number(row?.transactionCount ?? 0),
  }
}

function mapCategoryWithStats(
  categories: Awaited<ReturnType<typeof listCategoryRecords>>,
  statsById: Map<string, { spent: number; transactionCount: number }>,
): CategoryWithStats[] {
  return categories
    .map((category) => {
      const stats = statsById.get(category.id)
      return {
        ...category,
        spent: stats?.spent ?? 0,
        transactionCount: stats?.transactionCount ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function buildStatsMap(rows: Array<{ id: string; spent: number; transactionCount: number }>) {
  return new Map(rows.map((row) => [row.id, { spent: Number(row.spent ?? 0), transactionCount: Number(row.transactionCount ?? 0) }]))
}

export async function listCategories(params: CategoryListParams = {}): Promise<CategoryWithStats[]> {
  const categories = await listCategoryRecords(params.search ? { search: params.search } : {})
  if (categories.length === 0) {
    return []
  }

  const db = getDatabase()
  const placeholders = categories.map(() => "?").join(", ")
  const stats = db
    .prepare(
      `SELECT categories.id AS id,
              COALESCE(SUM(CASE WHEN transactions.amount < 0 THEN ABS(transactions.amount) ELSE 0 END), 0) AS spent,
              COUNT(transactions.id) AS transactionCount
         FROM categories
         LEFT JOIN transactions
           ON transactions.categoryId = categories.id
              OR (transactions.categoryId IS NULL AND transactions.categoryName = categories.name)
        WHERE categories.id IN (${placeholders})
        GROUP BY categories.id`
    )
    .all(...categories.map((category) => category.id)) as Array<{
    id: string
    spent: number
    transactionCount: number
  }>

  const statsMap = buildStatsMap(stats)
  return mapCategoryWithStats(categories, statsMap)
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryWithStats> {
  const name = normalizeName(input.name)
  if (!name) {
    throw new Error("Category name is required")
  }

  const existing = await getCategoryByName(name)
  if (existing) {
    throw new Error("A category with this name already exists")
  }

  const category = await insertCategory({
    id: `cat_${randomUUID()}`,
    name,
    icon: input.icon,
    color: input.color,
    monthlyBudget: sanitizeBudget(input.monthlyBudget),
  })

  const stats = await getCategoryStats(category.id, category.name)
  return { ...category, ...stats }
}

export async function updateCategory(id: string, updates: UpdateCategoryInput): Promise<CategoryWithStats> {
  return withTransaction(async (db) => {
    const existing = await getCategoryById(id, db)
    if (!existing) {
      throw new Error("Category not found")
    }

    let name = existing.name
    if (typeof updates.name === "string") {
      const normalized = normalizeName(updates.name)
      if (!normalized) {
        throw new Error("Category name is required")
      }
      const duplicate = await getCategoryByName(normalized, db)
      if (duplicate && duplicate.id !== id) {
        throw new Error("A category with this name already exists")
      }
      name = normalized
    }

    const monthlyBudget =
      typeof updates.monthlyBudget === "number" ? sanitizeBudget(updates.monthlyBudget) : existing.monthlyBudget

    const updatedCategory = await updateCategoryRecord(
      id,
      {
        name,
        icon: updates.icon,
        color: updates.color,
        monthlyBudget,
      },
      db,
    )

    if (!updatedCategory) {
      throw new Error("Category not found")
    }

    if (name !== existing.name) {
      const affected = db
        .prepare(
          `SELECT id FROM transactions WHERE categoryId = ? OR (categoryId IS NULL AND categoryName = ?)`
        )
        .all(existing.id, existing.name) as Array<{ id: string }>

      if (affected.length > 0) {
        const timestamp = new Date().toISOString()
        const placeholders = affected.map(() => "?").join(", ")
        db
          .prepare(
            `UPDATE transactions
             SET categoryId = ?, categoryName = ?, updatedAt = ?
             WHERE id IN (${placeholders})`
          )
          .run(updatedCategory.id, updatedCategory.name, timestamp, ...affected.map((row) => row.id))

        for (const row of affected) {
          recordSyncLog(db, "transaction", row.id, timestamp)
        }
      }
    }

    const stats = await getCategoryStats(updatedCategory.id, updatedCategory.name, db)
    return { ...updatedCategory, ...stats }
  })
}

export async function deleteCategory(id: string) {
  await withTransaction(async (db) => {
    const category = await getCategoryById(id, db)
    if (!category) {
      throw new Error("Category not found")
    }

    const affected = db
      .prepare(
        `SELECT id FROM transactions WHERE categoryId = ? OR (categoryId IS NULL AND categoryName = ?)`
      )
      .all(category.id, category.name) as Array<{ id: string }>

    if (affected.length > 0) {
      const timestamp = new Date().toISOString()
      const placeholders = affected.map(() => "?").join(", ")
      db
        .prepare(
          `UPDATE transactions
           SET categoryId = NULL, categoryName = 'Uncategorized', updatedAt = ?
           WHERE id IN (${placeholders})`
        )
        .run(timestamp, ...affected.map((row) => row.id))

      for (const row of affected) {
        recordSyncLog(db, "transaction", row.id, timestamp)
      }
    }

    const rules = await listAutomationRuleRecords({ categoryIds: [id] }, db)
    for (const rule of rules) {
      await deleteAutomationRuleRecord(rule.id, db)
    }

    const deleted = await deleteCategoryRecord(id, db)
    if (!deleted) {
      throw new Error("Category not found")
    }
  })
}

function computeRuleStats(
  rule: AutomationRule,
  categoriesById: Map<string, { id: string; name: string }>,
  transactions: Transaction[],
): AutomationRuleWithStats {
  const category = categoriesById.get(rule.categoryId)
  const matchCount = transactions.reduce((count, transaction) => {
    if (!rule.isActive) {
      return count
    }
    if (!transaction.description) {
      return count
    }
    if (matchesAutomationRule(rule, transaction.description)) {
      return count + 1
    }
    return count
  }, 0)

  return {
    ...rule,
    categoryName: category?.name ?? "Uncategorized",
    matchCount,
  }
}

export async function listAutomationRules(params: RuleListParams = {}): Promise<RuleListResult> {
  const [rules, categories, transactions] = await Promise.all([
    listAutomationRuleRecords({}, undefined),
    listCategoryRecords({}, undefined),
    listTransactionRecords(),
  ])

  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const normalizedSearch = params.search?.trim().toLowerCase()

  const rulesWithStats = rules
    .map((rule) => computeRuleStats(rule, categoriesById, transactions))
    .filter((rule) => {
      if (!normalizedSearch) {
        return true
      }
      return (
        rule.name.toLowerCase().includes(normalizedSearch) ||
        rule.categoryName.toLowerCase().includes(normalizedSearch)
      )
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.name.localeCompare(b.name)
    })

  return { rules: rulesWithStats }
}

export async function createAutomationRule(
  input: CreateAutomationRuleInput,
): Promise<AutomationRuleMutationResult> {
  const category = await getCategoryById(input.categoryId)
  if (!category) {
    throw new Error("Selected category does not exist")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Rule name is required")
  }

  const type = RULE_TYPES.includes(input.type) ? input.type : "contains"
  const pattern = input.pattern.trim()
  if (!pattern) {
    throw new Error("Pattern is required")
  }

  const priority = Number.isFinite(input.priority) ? Math.max(1, Math.round(input.priority)) : 1

  const rule = await insertAutomationRule({
    id: `rule_${randomUUID()}`,
    name,
    categoryId: input.categoryId,
    type,
    pattern,
    priority,
    isActive: Boolean(input.isActive),
    description: input.description?.trim() || undefined,
  })

  const reprocessedCount = await reapplyAutomationRules()

  const transactions = await listTransactionRecords()
  const ruleWithStats = computeRuleStats(rule, new Map([[category.id, category]]), transactions)

  return { rule: ruleWithStats, reprocessedCount }
}

export async function updateAutomationRule(
  id: string,
  updates: UpdateAutomationRuleInput,
): Promise<AutomationRuleMutationResult> {
  const existing = await listAutomationRuleRecords({ ids: [id] })
  const rule = existing[0]
  if (!rule) {
    throw new Error("Rule not found")
  }

  let categoryId = rule.categoryId
  if (typeof updates.categoryId === "string") {
    const category = await getCategoryById(updates.categoryId)
    if (!category) {
      throw new Error("Selected category does not exist")
    }
    categoryId = category.id
  }

  const type = updates.type && RULE_TYPES.includes(updates.type) ? updates.type : rule.type
  const priority =
    typeof updates.priority === "number" ? Math.max(1, Math.round(updates.priority)) : rule.priority
  const pattern =
    typeof updates.pattern === "string" && updates.pattern.trim().length > 0
      ? updates.pattern.trim()
      : rule.pattern
  const name = typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : rule.name

  const updatedRule = await updateAutomationRuleRecord(
    id,
    {
      categoryId,
      type,
      priority,
      pattern,
      name,
      description: updates.description?.trim() ?? rule.description,
      isActive: updates.isActive ?? rule.isActive,
    },
  )

  if (!updatedRule) {
    throw new Error("Rule not found")
  }

  const reprocessedCount = await reapplyAutomationRules()
  const transactions = await listTransactionRecords()
  const categories = await listCategoryRecords()
  const ruleWithStats = computeRuleStats(updatedRule, new Map(categories.map((item) => [item.id, item])), transactions)

  return { rule: ruleWithStats, reprocessedCount }
}

export async function deleteAutomationRule(id: string) {
  const deleted = await deleteAutomationRuleRecord(id)
  if (!deleted) {
    throw new Error("Rule not found")
  }
}
