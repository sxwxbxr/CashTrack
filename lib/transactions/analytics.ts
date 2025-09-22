import { initDatabase, getDatabase } from "@/lib/db"
import { listTransactions as listTransactionRecords } from "@/lib/transactions/repository"

void initDatabase()

const TREND_MONTHS = 6
const DEFAULT_CATEGORY_COLOR = "bg-slate-500"
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
]

interface SummaryRow {
  balance: number | null
  currentIncome: number | null
  currentExpenses: number | null
  previousIncome: number | null
  previousExpenses: number | null
}

interface CategoryRow {
  id: string
  name: string
  color: string
  monthlyBudget: number
}

interface SpendingRow {
  categoryId: string | null
  categoryName: string
  spent: number | null
}

interface TrendRow {
  month: string
  income: number | null
  expenses: number | null
}

export interface CategoryBreakdownPoint {
  name: string
  value: number
  color: string
}

export interface BudgetOverviewItem {
  id: string
  name: string
  colorClass: string
  budget: number
  spent: number
  usage: number
}

export interface DashboardTransaction {
  id: string
  date: string
  description: string
  categoryName: string
  amount: number
  account: string
  notes: string | null
}

export interface DashboardAnalytics {
  balance: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyNet: number
  incomeChangePercent: number | null
  expenseChangePercent: number | null
  budgetTotal: number
  budgetRemaining: number
  budgetUsagePercent: number | null
  budgetRemainingPercent: number | null
  budgetWarning: { categoryName: string; usagePercent: number } | null
  trend: Array<{ month: string; income: number; expenses: number }>
  categoryBreakdown: CategoryBreakdownPoint[]
  budgetOverview: BudgetOverviewItem[]
  recentTransactions: DashboardTransaction[]
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
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

function computePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) {
      return 0
    }
    return null
  }
  return ((current - previous) / previous) * 100
}

function normalizeCategoryColor(color: string | null | undefined): string {
  if (!color || typeof color !== "string") {
    return DEFAULT_CATEGORY_COLOR
  }
  return color
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const db = getDatabase()
  const now = new Date()
  const currentStartDate = startOfMonth(now)
  const nextMonthStart = addMonths(currentStartDate, 1)
  const previousMonthStart = addMonths(currentStartDate, -1)

  const currentStart = formatDate(currentStartDate)
  const nextStart = formatDate(nextMonthStart)
  const previousStart = formatDate(previousMonthStart)

  const summaryRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(amount), 0) AS balance,
         COALESCE(SUM(CASE WHEN date >= @currentStart AND date < @nextStart AND amount > 0 THEN amount ELSE 0 END), 0) AS currentIncome,
         COALESCE(SUM(CASE WHEN date >= @currentStart AND date < @nextStart AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS currentExpenses,
         COALESCE(SUM(CASE WHEN date >= @previousStart AND date < @currentStart AND amount > 0 THEN amount ELSE 0 END), 0) AS previousIncome,
         COALESCE(SUM(CASE WHEN date >= @previousStart AND date < @currentStart AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS previousExpenses
       FROM transactions`
    )
    .get({ currentStart, nextStart, previousStart }) as SummaryRow | undefined

  const balance = Number(summaryRow?.balance ?? 0)
  const monthlyIncome = Number(summaryRow?.currentIncome ?? 0)
  const monthlyExpenses = Number(summaryRow?.currentExpenses ?? 0)
  const previousIncome = Number(summaryRow?.previousIncome ?? 0)
  const previousExpenses = Number(summaryRow?.previousExpenses ?? 0)

  const monthlyNet = monthlyIncome - monthlyExpenses
  const incomeChangePercent = computePercentChange(monthlyIncome, previousIncome)
  const expenseChangePercent = computePercentChange(monthlyExpenses, previousExpenses)

  const budgetRow = db
    .prepare("SELECT COALESCE(SUM(monthlyBudget), 0) AS totalBudget FROM categories")
    .get() as { totalBudget: number | null } | undefined
  const budgetTotal = Number(budgetRow?.totalBudget ?? 0)
  const budgetRemaining = budgetTotal - monthlyExpenses
  const budgetUsagePercent = budgetTotal > 0 ? (monthlyExpenses / budgetTotal) * 100 : null
  const budgetRemainingPercent = budgetTotal > 0 ? (budgetRemaining / budgetTotal) * 100 : null

  const categories = db
    .prepare(
      "SELECT id, name, color, monthlyBudget FROM categories ORDER BY name COLLATE NOCASE ASC"
    )
    .all() as CategoryRow[]

  const spendingRows = db
    .prepare(
      `SELECT
         categoryId,
         categoryName,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent
       FROM transactions
       WHERE date >= @currentStart AND date < @nextStart
       GROUP BY categoryId, categoryName`
    )
    .all({ currentStart, nextStart }) as SpendingRow[]

  const spendingById = new Map<string, number>()
  const spendingByName = new Map<string, number>()

  for (const row of spendingRows) {
    const spent = Number(row.spent ?? 0)
    const normalizedName = (row.categoryName || "Uncategorized").toLowerCase()
    spendingByName.set(normalizedName, (spendingByName.get(normalizedName) ?? 0) + spent)
    if (row.categoryId) {
      spendingById.set(row.categoryId, spent)
    }
  }

  const budgetOverviewBase: BudgetOverviewItem[] = categories.map((category) => {
    const normalizedName = category.name.toLowerCase()
    const spent = spendingById.get(category.id) ?? spendingByName.get(normalizedName) ?? 0
    const budget = Number(category.monthlyBudget ?? 0)
    const usage = budget > 0 ? spent / budget : 0
    return {
      id: category.id,
      name: category.name,
      colorClass: normalizeCategoryColor(category.color),
      budget,
      spent,
      usage,
    }
  })

  const uncategorizedSpent = spendingByName.get("uncategorized") ?? 0
  if (uncategorizedSpent > 0) {
    budgetOverviewBase.push({
      id: "uncategorized",
      name: "Uncategorized",
      colorClass: DEFAULT_CATEGORY_COLOR,
      budget: 0,
      spent: uncategorizedSpent,
      usage: 0,
    })
  }

  let budgetOverview = budgetOverviewBase.filter((entry) => entry.budget > 0)
  if (budgetOverview.length === 0) {
    budgetOverview = budgetOverviewBase.filter((entry) => entry.spent > 0)
  }
  budgetOverview = budgetOverview
    .sort((a, b) => {
      if (b.usage !== a.usage) {
        return b.usage - a.usage
      }
      return b.spent - a.spent
    })

  const budgetWarningCandidate = budgetOverview
    .filter((entry) => entry.budget > 0)
    .sort((a, b) => b.usage - a.usage)[0]
  const budgetWarning =
    budgetWarningCandidate && budgetWarningCandidate.usage >= 0.8
      ? {
          categoryName: budgetWarningCandidate.name,
          usagePercent: budgetWarningCandidate.usage * 100,
        }
      : null

  const categoryBreakdown = spendingRows
    .filter((row) => Number(row.spent ?? 0) > 0)
    .sort((a, b) => Number(b.spent ?? 0) - Number(a.spent ?? 0))
    .slice(0, CHART_COLORS.length)
    .map((row, index) => ({
      name: row.categoryName || "Uncategorized",
      value: Number(row.spent ?? 0),
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))

  const trendStartDate = addMonths(currentStartDate, -1 * (TREND_MONTHS - 1))
  const trendRows = db
    .prepare(
      `SELECT
         SUBSTR(date, 1, 7) AS month,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
       FROM transactions
       WHERE date >= @start
       GROUP BY SUBSTR(date, 1, 7)
       ORDER BY month ASC`
    )
    .all({ start: formatDate(trendStartDate) }) as TrendRow[]

  const trendMap = new Map<string, { income: number; expenses: number }>()
  for (const row of trendRows) {
    const key = row.month
    if (!key) continue
    trendMap.set(key, {
      income: Number(row.income ?? 0),
      expenses: Number(row.expenses ?? 0),
    })
  }

  const trend: Array<{ month: string; income: number; expenses: number }> = []
  for (let index = 0; index < TREND_MONTHS; index += 1) {
    const monthDate = addMonths(trendStartDate, index)
    const key = formatMonthKey(monthDate)
    const metrics = trendMap.get(key) ?? { income: 0, expenses: 0 }
    trend.push({
      month: formatMonthLabel(key),
      income: metrics.income,
      expenses: metrics.expenses,
    })
  }

  const recentTransactions = await listTransactionRecords(
    {},
    {
      orderBy: "date",
      orderDirection: "desc",
      limit: 5,
    },
  )

  const simplifiedTransactions: DashboardTransaction[] = recentTransactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    categoryName: transaction.categoryName,
    amount: transaction.amount,
    account: transaction.account,
    notes: transaction.notes ?? null,
  }))

  return {
    balance,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
    incomeChangePercent,
    expenseChangePercent,
    budgetTotal,
    budgetRemaining,
    budgetUsagePercent,
    budgetRemainingPercent,
    budgetWarning,
    trend,
    categoryBreakdown,
    budgetOverview,
    recentTransactions: simplifiedTransactions,
  }
}
