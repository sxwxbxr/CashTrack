import { promises as fs } from "fs"
import path from "path"
import type { AutomationRule, Category } from "@/lib/categories/types"

const DATA_DIRECTORY = path.join(process.cwd(), "data")
const CATEGORIES_FILE = path.join(DATA_DIRECTORY, "categories.json")
const RULES_FILE = path.join(DATA_DIRECTORY, "automation-rules.json")

async function ensureDataFile(filePath: string, fallback: string) {
  try {
    await fs.access(filePath)
  } catch {
    await fs.mkdir(DATA_DIRECTORY, { recursive: true })
    await fs.writeFile(filePath, fallback, "utf8")
  }
}

export async function readCategories(): Promise<Category[]> {
  await ensureDataFile(CATEGORIES_FILE, "[]")
  const contents = await fs.readFile(CATEGORIES_FILE, "utf8")
  const parsed = JSON.parse(contents) as Category[]
  return parsed.map((category) => ({
    ...category,
    monthlyBudget: Number(category.monthlyBudget) || 0,
  }))
}

export async function writeCategories(categories: Category[]) {
  await ensureDataFile(CATEGORIES_FILE, "[]")
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), "utf8")
}

export async function readAutomationRules(): Promise<AutomationRule[]> {
  await ensureDataFile(RULES_FILE, "[]")
  const contents = await fs.readFile(RULES_FILE, "utf8")
  const parsed = JSON.parse(contents) as AutomationRule[]
  return parsed.map((rule) => ({
    ...rule,
    priority: Number(rule.priority) || 1,
    isActive: Boolean(rule.isActive),
  }))
}

export async function writeAutomationRules(rules: AutomationRule[]) {
  await ensureDataFile(RULES_FILE, "[]")
  await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2), "utf8")
}
