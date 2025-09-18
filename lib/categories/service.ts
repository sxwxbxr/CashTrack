import { randomUUID } from "crypto"
import { readAutomationRules, readCategories, writeAutomationRules, writeCategories } from "@/lib/categories/storage"
import type {
  AutomationRule,
  AutomationRuleWithStats,
  Category,
  CategoryWithStats,
  CreateAutomationRuleInput,
  CreateCategoryInput,
  RuleListResult,
  RuleMatchType,
  UpdateAutomationRuleInput,
  UpdateCategoryInput,
} from "@/lib/categories/types"
import { readTransactions, writeTransactions } from "@/lib/transactions/storage"
import type { Transaction } from "@/lib/transactions/types"
import { matchesAutomationRule } from "@/lib/categories/rule-matcher"

type CategoryListParams = {
  search?: string
}

type RuleListParams = {
  search?: string
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

function computeCategoryStats(category: Category, transactions: Transaction[]): CategoryWithStats {
  const relevantTransactions = transactions.filter(
    (transaction) => transaction.category.toLowerCase() === category.name.toLowerCase(),
  )

  const spent = relevantTransactions.reduce((total, transaction) => {
    if (transaction.amount < 0) {
      return total + Math.abs(transaction.amount)
    }
    return total
  }, 0)

  return {
    ...category,
    spent,
    transactionCount: relevantTransactions.length,
  }
}

function computeRuleStats(
  rule: AutomationRule,
  categoriesById: Map<string, Category>,
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

export async function listCategories(params: CategoryListParams = {}): Promise<CategoryWithStats[]> {
  const { search } = params
  const [categories, transactions] = await Promise.all([readCategories(), readTransactions()])

  const normalizedSearch = search?.trim().toLowerCase()

  return categories
    .map((category) => computeCategoryStats(category, transactions))
    .filter((category) => {
      if (!normalizedSearch) {
        return true
      }
      return category.name.toLowerCase().includes(normalizedSearch)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryWithStats> {
  const name = normalizeName(input.name)
  if (!name) {
    throw new Error("Category name is required")
  }

  const categories = await readCategories()
  const nameExists = categories.some((category) => category.name.toLowerCase() === name.toLowerCase())
  if (nameExists) {
    throw new Error("A category with this name already exists")
  }

  const now = new Date().toISOString()
  const monthlyBudget = sanitizeBudget(input.monthlyBudget)

  const category: Category = {
    id: `cat_${randomUUID()}`,
    name,
    icon: input.icon,
    color: input.color,
    monthlyBudget,
    createdAt: now,
    updatedAt: now,
  }

  const nextCategories = [...categories, category].sort((a, b) => a.name.localeCompare(b.name))
  await writeCategories(nextCategories)

  const transactions = await readTransactions()
  return computeCategoryStats(category, transactions)
}

export async function updateCategory(id: string, updates: UpdateCategoryInput): Promise<CategoryWithStats> {
  const categories = await readCategories()
  const index = categories.findIndex((category) => category.id === id)
  if (index === -1) {
    throw new Error("Category not found")
  }

  const existing = categories[index]

  let name = existing.name
  if (typeof updates.name === "string") {
    const normalized = normalizeName(updates.name)
    if (!normalized) {
      throw new Error("Category name is required")
    }
    const duplicate = categories.some(
      (category) => category.id !== id && category.name.toLowerCase() === normalized.toLowerCase(),
    )
    if (duplicate) {
      throw new Error("A category with this name already exists")
    }
    name = normalized
  }

  const monthlyBudget =
    typeof updates.monthlyBudget === "number"
      ? sanitizeBudget(updates.monthlyBudget)
      : existing.monthlyBudget

  const updatedCategory: Category = {
    ...existing,
    ...updates,
    name,
    monthlyBudget,
    updatedAt: new Date().toISOString(),
  }

  const nextCategories = [...categories]
  nextCategories[index] = updatedCategory
  nextCategories.sort((a, b) => a.name.localeCompare(b.name))
  await writeCategories(nextCategories)

  if (name !== existing.name) {
    const transactions = await readTransactions()
    let hasChanges = false
    const updatedTransactions = transactions.map((transaction) => {
      if (transaction.category.toLowerCase() === existing.name.toLowerCase()) {
        hasChanges = true
        return {
          ...transaction,
          category: updatedCategory.name,
          updatedAt: new Date().toISOString(),
        }
      }
      return transaction
    })

    if (hasChanges) {
      await writeTransactions(updatedTransactions)
    }
  }

  const transactions = await readTransactions()
  return computeCategoryStats(updatedCategory, transactions)
}

export async function deleteCategory(id: string) {
  const categories = await readCategories()
  const category = categories.find((entry) => entry.id === id)
  if (!category) {
    throw new Error("Category not found")
  }

  const remainingCategories = categories.filter((entry) => entry.id !== id)
  await writeCategories(remainingCategories)

  const transactions = await readTransactions()
  let hasChanges = false
  const updatedTransactions = transactions.map((transaction) => {
    if (transaction.category.toLowerCase() === category.name.toLowerCase()) {
      hasChanges = true
      return {
        ...transaction,
        category: "Uncategorized",
        updatedAt: new Date().toISOString(),
      }
    }
    return transaction
  })

  if (hasChanges) {
    await writeTransactions(updatedTransactions)
  }

  const rules = await readAutomationRules()
  const filteredRules = rules.filter((rule) => rule.categoryId !== id)
  if (filteredRules.length !== rules.length) {
    await writeAutomationRules(filteredRules)
  }
}

export async function listAutomationRules(params: RuleListParams = {}): Promise<RuleListResult> {
  const { search } = params
  const [rules, categories, transactions] = await Promise.all([
    readAutomationRules(),
    readCategories(),
    readTransactions(),
  ])

  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const normalizedSearch = search?.trim().toLowerCase()

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
): Promise<AutomationRuleWithStats> {
  const [rules, categories, transactions] = await Promise.all([
    readAutomationRules(),
    readCategories(),
    readTransactions(),
  ])

  const category = categories.find((entry) => entry.id === input.categoryId)
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

  const now = new Date().toISOString()
  const rule: AutomationRule = {
    id: `rule_${randomUUID()}`,
    name,
    categoryId: input.categoryId,
    type,
    pattern,
    priority,
    isActive: Boolean(input.isActive),
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const nextRules = [...rules, rule]
  await writeAutomationRules(nextRules)

  return computeRuleStats(rule, new Map(categories.map((item) => [item.id, item])), transactions)
}

export async function updateAutomationRule(
  id: string,
  updates: UpdateAutomationRuleInput,
): Promise<AutomationRuleWithStats> {
  const [rules, categories, transactions] = await Promise.all([
    readAutomationRules(),
    readCategories(),
    readTransactions(),
  ])

  const index = rules.findIndex((rule) => rule.id === id)
  if (index === -1) {
    throw new Error("Rule not found")
  }

  const existing = rules[index]

  let categoryId = existing.categoryId
  if (typeof updates.categoryId === "string") {
    const category = categories.find((entry) => entry.id === updates.categoryId)
    if (!category) {
      throw new Error("Selected category does not exist")
    }
    categoryId = category.id
  }

  const type = updates.type && RULE_TYPES.includes(updates.type) ? updates.type : existing.type

  const priority =
    typeof updates.priority === "number"
      ? Math.max(1, Math.round(updates.priority))
      : existing.priority

  const pattern =
    typeof updates.pattern === "string" && updates.pattern.trim().length > 0
      ? updates.pattern.trim()
      : existing.pattern

  let name = existing.name
  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim()
    if (!trimmed) {
      throw new Error("Rule name is required")
    }
    name = trimmed
  }

  const updatedRule: AutomationRule = {
    ...existing,
    ...updates,
    categoryId,
    type,
    priority,
    pattern,
    name,
    description: updates.description?.trim() || existing.description,
    updatedAt: new Date().toISOString(),
  }

  const nextRules = [...rules]
  nextRules[index] = updatedRule
  await writeAutomationRules(nextRules)

  return computeRuleStats(updatedRule, new Map(categories.map((item) => [item.id, item])), transactions)
}

export async function deleteAutomationRule(id: string) {
  const rules = await readAutomationRules()
  const filtered = rules.filter((rule) => rule.id !== id)
  if (filtered.length === rules.length) {
    throw new Error("Rule not found")
  }
  await writeAutomationRules(filtered)
}
