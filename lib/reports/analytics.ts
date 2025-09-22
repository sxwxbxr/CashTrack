import { initDatabase, getDatabase } from "@/lib/db"
import type Database from "better-sqlite3"

import { tailwindBgClassToHex, DEFAULT_CHART_COLORS } from "@/lib/colors"

export type ReportPeriodKey = "last-3-months" | "last-6-months" | "last-12-months" | "current-year"

interface CategoryRow {
  id: string
  name: string
  color: string
  monthlyBudget: number
}

interface CategorySpendRow {
  categoryId: string | null
  categoryName: string
  spent: number
  transactions: number
}

interface CategorySpendPreviousRow {
  categoryId: string | null
  categoryName: string
  spent: number
}

interface MonthlySpendRow {
  month: string
  income: number
  expenses: number
}

interface CategoryMonthlySpendRow {
  month: string
  categoryId: string | null
  categoryName: string
  spent: number
}

interface YearlySpendRow {
  month: string
  expenses: number
}

interface AccountRow {
  id: string
  name: string
}

interface AccountActivityRow {
  name: string
  inflow: number
  outflow: number
  transactions: number
}

export interface SummaryMetric {
  label: string
  value: number
  change: number | null
  direction: "up" | "down" | "flat"
  helper?: string
}

export interface CategoryPerformance {
  id: string
  name: string
  spent: number
  budget: number
  change: number | null
  transactions: number
  colorClass: string
  colorHex: string
}

export interface ChartPoint {
  name: string
  value: number
  color: string
}

export interface ChartSeries {
  key: string
  label: string
  color?: string
}

export interface AccountSummary {
  id: string
  name: string
  inflow: number
  outflow: number
  net: number
  transactions: number
}

export interface ReportAnalytics {
  period: ReportPeriodKey
  label: string
  startDate: string
  endDate: string
  summary: SummaryMetric[]
  highlights: string[]
  categories: CategoryPerformance[]
  monthlyBreakdown: ChartPoint[]
  incomeExpense: Array<{ month: string; income: number; expenses: number }>
  categoryTrend: { data: Array<{ month: string; [key: string]: number }>; series: ChartSeries[] }
  yearlyComparison: Array<{ month: string; current: number; previous: number }>
  insights: Array<{ variant: "positive" | "warning" | "info"; title: string; description: string }>
  accounts: AccountSummary[]
}

const databaseReady = initDatabase()

const CHART_COLORS = DEFAULT_CHART_COLORS

const PERIOD_MONTHS: Record<Exclude<ReportPeriodKey, "current-year">, number> = {
  "last-3-months": 3,
  "last-6-months": 6,
  "last-12-months": 12,
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey
  }
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString(undefined, { month: "short" })
}

function normalizeCategoryColor(color: string | null | undefined): string {
  if (!color || typeof color !== "string") {
    return "bg-slate-500"
  }
  return color
}

function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) {
      return 0
    }
    return null
  }
  return ((current - previous) / previous) * 100
}

function getCategoryKey(categoryId: string | null, categoryName: string): string {
  return categoryId ? categoryId : `name:${categoryName.toLowerCase()}`
}

function createMonthKeys(start: Date, months: number): string[] {
  const keys: string[] = []
  for (let index = 0; index < months; index += 1) {
    keys.push(formatMonthKey(addMonths(start, index)))
  }
  return keys
}

async function resolveDatabase(): Promise<Database> {
  await databaseReady
  return getDatabase()
}

export async function getReportAnalytics(period: ReportPeriodKey): Promise<ReportAnalytics> {
  const db = await resolveDatabase()
  const now = new Date()
  let start = startOfMonth(now)
  let end = addMonths(start, 1)
  let previousStart: Date
  let previousEnd: Date
  let monthsInPeriod = 1
  let label = ""

  if (period === "current-year") {
    start = new Date(now.getFullYear(), 0, 1)
    end = new Date(now.getFullYear() + 1, 0, 1)
    previousStart = new Date(now.getFullYear() - 1, 0, 1)
    previousEnd = start
    monthsInPeriod = Math.max(1, now.getMonth() + 1)
    label = `${start.getFullYear()} Year to Date`
  } else {
    const months = PERIOD_MONTHS[period]
    monthsInPeriod = months
    start = startOfMonth(addMonths(now, -(months - 1)))
    end = addMonths(start, months)
    previousStart = addMonths(start, -months)
    previousEnd = start
    label = period.replace(/-/g, " ")
  }

  const monthKeys = createMonthKeys(start, monthsInPeriod)

  const summaryRow = db
    .prepare(
      `SELECT
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'`,
    )
    .get({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }) as
    | { income: number | null; expenses: number | null }
    | undefined

  const previousSummaryRow = db
    .prepare(
      `SELECT
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'`,
    )
    .get({ start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) }) as
    | { income: number | null; expenses: number | null }
    | undefined

  const totalIncome = Number(summaryRow?.income ?? 0)
  const totalExpenses = Number(summaryRow?.expenses ?? 0)
  const previousIncome = Number(previousSummaryRow?.income ?? 0)
  const previousExpenses = Number(previousSummaryRow?.expenses ?? 0)
  const netSavings = totalIncome - totalExpenses
  const previousNetSavings = previousIncome - previousExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : null

  const summary: SummaryMetric[] = [
    {
      label: "Total Income",
      value: totalIncome,
      change: calculateChange(totalIncome, previousIncome),
      direction: totalIncome >= previousIncome ? "up" : "down",
    },
    {
      label: "Total Expenses",
      value: totalExpenses,
      change: calculateChange(totalExpenses, previousExpenses),
      direction: totalExpenses <= previousExpenses ? "down" : "up",
    },
    {
      label: "Net Savings",
      value: netSavings,
      change: calculateChange(netSavings, previousNetSavings),
      direction: netSavings >= previousNetSavings ? "up" : "down",
      helper: savingsRate !== null ? `Savings rate ${savingsRate.toFixed(1)}%` : undefined,
    },
    {
      label: "Avg Monthly Spending",
      value: monthsInPeriod > 0 ? totalExpenses / monthsInPeriod : totalExpenses,
      change: null,
      direction: "flat",
    },
  ]

  const categories = db
    .prepare(
      "SELECT id, name, color, monthlyBudget FROM categories ORDER BY name COLLATE NOCASE ASC",
    )
    .all() as CategoryRow[]

  const categoryMap = new Map<string, CategoryRow>()
  categories.forEach((category) => {
    categoryMap.set(getCategoryKey(category.id, category.name), category)
  })

  const categorySpendRows = db
    .prepare(
      `SELECT
         categoryId,
         categoryName,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent,
         SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS transactions
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY categoryId, categoryName`,
    )
    .all({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }) as CategorySpendRow[]

  const previousCategorySpendRows = db
    .prepare(
      `SELECT
         categoryId,
         categoryName,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY categoryId, categoryName`,
    )
    .all({ start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) }) as CategorySpendPreviousRow[]

  const previousCategoryMap = new Map<string, number>()
  previousCategorySpendRows.forEach((row) => {
    previousCategoryMap.set(getCategoryKey(row.categoryId, row.categoryName), Number(row.spent ?? 0))
  })

  const combinedKeys = new Set<string>()
  categoryMap.forEach((_value, key) => combinedKeys.add(key))
  categorySpendRows.forEach((row) => combinedKeys.add(getCategoryKey(row.categoryId, row.categoryName)))

  const categoryPerformances: CategoryPerformance[] = []
  combinedKeys.forEach((key) => {
    const base = categoryMap.get(key)
    const spendRow = categorySpendRows.find((row) => getCategoryKey(row.categoryId, row.categoryName) === key)
    const previousSpent = previousCategoryMap.get(key) ?? 0
    const name = base?.name ?? spendRow?.categoryName ?? "Uncategorized"
    const spent = Number(spendRow?.spent ?? 0)
    const transactions = Number(spendRow?.transactions ?? 0)
    const monthlyBudget = Number(base?.monthlyBudget ?? 0)
    const budget = monthlyBudget * (monthsInPeriod > 0 ? monthsInPeriod : 1)
    const colorClass = normalizeCategoryColor(base?.color)
    const colorHex = tailwindBgClassToHex(colorClass)
    const change = calculateChange(spent, previousSpent)

    categoryPerformances.push({
      id: base?.id ?? key,
      name,
      spent,
      budget,
      change,
      transactions,
      colorClass,
      colorHex,
    })
  })

  categoryPerformances.sort((a, b) => b.spent - a.spent)

  const highlights: string[] = []
  const topCategory = categoryPerformances[0]
  if (topCategory) {
    highlights.push(`${topCategory.name} is your largest category at $${topCategory.spent.toFixed(2)}`)
  }
  if (savingsRate !== null) {
    highlights.push(`Savings rate: ${savingsRate.toFixed(1)}%`)
  }
  const totalTransactionsRow = db
    .prepare("SELECT COUNT(*) as count FROM transactions WHERE date >= ? AND date < ?")
    .get(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as { count: number } | undefined
  highlights.push(`Logged ${Number(totalTransactionsRow?.count ?? 0)} transactions this period`)

  const monthlyRows = db
    .prepare(
      `SELECT
         SUBSTR(date, 1, 7) AS month,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY SUBSTR(date, 1, 7)`
    )
    .all({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }) as MonthlySpendRow[]

  const monthlyMap = new Map<string, { income: number; expenses: number }>()
  monthlyRows.forEach((row) => {
    if (row.month) {
      monthlyMap.set(row.month, { income: Number(row.income ?? 0), expenses: Number(row.expenses ?? 0) })
    }
  })

  const incomeExpense = monthKeys.map((key) => {
    const entry = monthlyMap.get(key) ?? { income: 0, expenses: 0 }
    return { month: formatMonthLabel(key), income: entry.income, expenses: entry.expenses }
  })

  const categoryMonthlyRows = db
    .prepare(
      `SELECT
         SUBSTR(date, 1, 7) AS month,
         categoryId,
         categoryName,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY SUBSTR(date, 1, 7), categoryId, categoryName`
    )
    .all({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }) as CategoryMonthlySpendRow[]

  const trendSeries: ChartSeries[] = categoryPerformances.slice(0, 5).map((category) => ({
    key: getCategoryKey(category.id === category.name ? null : category.id, category.name),
    label: category.name,
    color: category.colorHex,
  }))

  const trendData = monthKeys.map((key) => {
    const row: Record<string, number | string> = { month: formatMonthLabel(key) }
    trendSeries.forEach((series) => {
      const match = categoryMonthlyRows.find(
        (entry) => entry.month === key && getCategoryKey(entry.categoryId, entry.categoryName) === series.key,
      )
      row[series.key] = Number(match?.spent ?? 0)
    })
    return row as { month: string; [key: string]: number }
  })

  const monthlyBreakdown = categoryPerformances
    .filter((category) => category.spent > 0)
    .slice(0, CHART_COLORS.length)
    .map((category, index) => ({
      name: category.name,
      value: category.spent,
      color: category.colorHex || CHART_COLORS[index % CHART_COLORS.length],
    }))

  const currentYearStart = new Date(start.getFullYear(), 0, 1)
  const nextYearStart = new Date(start.getFullYear() + 1, 0, 1)
  const previousYearStart = new Date(start.getFullYear() - 1, 0, 1)

  const currentYearRows = db
    .prepare(
      `SELECT SUBSTR(date, 1, 7) AS month, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY SUBSTR(date, 1, 7)`
    )
    .all({ start: currentYearStart.toISOString().slice(0, 10), end: nextYearStart.toISOString().slice(0, 10) }) as YearlySpendRow[]

  const previousYearRows = db
    .prepare(
      `SELECT SUBSTR(date, 1, 7) AS month, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY SUBSTR(date, 1, 7)`
    )
    .all({ start: previousYearStart.toISOString().slice(0, 10), end: currentYearStart.toISOString().slice(0, 10) }) as YearlySpendRow[]

  const currentYearMap = new Map<string, number>()
  currentYearRows.forEach((row) => {
    if (row.month) {
      currentYearMap.set(row.month, Number(row.expenses ?? 0))
    }
  })

  const previousYearMap = new Map<string, number>()
  previousYearRows.forEach((row) => {
    if (row.month) {
      previousYearMap.set(row.month, Number(row.expenses ?? 0))
    }
  })

  const yearlyComparison: Array<{ month: string; current: number; previous: number }> = []
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const monthDate = new Date(Date.UTC(start.getFullYear(), monthIndex, 1))
    const key = formatMonthKey(monthDate)
    yearlyComparison.push({
      month: monthDate.toLocaleDateString(undefined, { month: "short" }),
      current: currentYearMap.get(key) ?? 0,
      previous:
        previousYearMap.get(`${start.getFullYear() - 1}-${String(monthIndex + 1).padStart(2, "0")}`) ?? 0,
    })
  }

  const accountRows = db
    .prepare("SELECT id, name FROM accounts ORDER BY name COLLATE NOCASE")
    .all() as AccountRow[]

  const activityRows = db
    .prepare(
      `SELECT
         account AS name,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS outflow,
         COUNT(id) AS transactions
       FROM transactions
       WHERE date >= @start AND date < @end
         AND type != 'transfer'
       GROUP BY account`
    )
    .all({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }) as AccountActivityRow[]

  const accountMap = new Map<string, { id: string; name: string; inflow: number; outflow: number; transactions: number }>()

  accountRows.forEach((account) => {
    const key = account.name.toLowerCase()
    accountMap.set(key, { id: account.id, name: account.name, inflow: 0, outflow: 0, transactions: 0 })
  })

  activityRows.forEach((row) => {
    const name = (row.name ?? "Unspecified").trim() || "Unspecified"
    const key = name.toLowerCase()
    const inflow = Number(row.inflow ?? 0)
    const outflow = Number(row.outflow ?? 0)
    const transactions = Number(row.transactions ?? 0)
    const existing = accountMap.get(key)

    if (existing) {
      existing.inflow = inflow
      existing.outflow = outflow
      existing.transactions = transactions
    } else {
      accountMap.set(key, {
        id: `account:${key}`,
        name,
        inflow,
        outflow,
        transactions,
      })
    }
  })

  const accounts: AccountSummary[] = Array.from(accountMap.values()).map((entry) => ({
    ...entry,
    net: entry.inflow - entry.outflow,
  }))

  accounts.sort((a, b) => {
    const activityA = a.inflow + a.outflow
    const activityB = b.inflow + b.outflow
    if (activityA === activityB) {
      return a.name.localeCompare(b.name)
    }
    return activityB - activityA
  })

  const overBudget = categoryPerformances.filter((category) => category.budget > 0 && category.spent > category.budget)

  const insights: Array<{ variant: "positive" | "warning" | "info"; title: string; description: string }> = []
  if (savingsRate !== null) {
    insights.push({
      variant: savingsRate >= 0 ? "positive" : "warning",
      title: savingsRate >= 0 ? "You saved money" : "Spending exceeded income",
      description:
        savingsRate >= 0
          ? `Saved ${savingsRate.toFixed(1)}% of income during this period.`
          : `Spending outpaced income by ${Math.abs(savingsRate).toFixed(1)}%. Review discretionary purchases.`,
    })
  }

  if (overBudget.length > 0) {
    const topOver = overBudget[0]
    const overPercent = topOver.budget > 0 ? ((topOver.spent - topOver.budget) / topOver.budget) * 100 : 0
    insights.push({
      variant: "warning",
      title: `${topOver.name} exceeded budget`,
      description: `Spent ${overPercent.toFixed(1)}% over the planned $${topOver.budget.toFixed(2)} budget.`,
    })
  }

  if (topCategory) {
    insights.push({
      variant: "info",
      title: `${topCategory.name} dominates spending`,
      description: `${topCategory.transactions} transactions totaled $${topCategory.spent.toFixed(2)} in this category.`,
    })
  }

  return {
    period,
    label,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    summary,
    highlights,
    categories: categoryPerformances,
    monthlyBreakdown,
    incomeExpense,
    categoryTrend: { data: trendData, series: trendSeries },
    yearlyComparison,
    insights,
    accounts,
  }
}
