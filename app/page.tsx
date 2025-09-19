import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart"
import { CategoryPieChart } from "@/components/charts/category-pie-chart"
import { Plus, TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getDashboardAnalytics } from "@/lib/transactions/analytics"

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

function formatAbsoluteCurrency(value: number): string {
  return currencyFormatter.format(Math.abs(value))
}

function formatChangeText(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "No previous month data"
  }
  const formatted = value.toFixed(1)
  const sign = value >= 0 ? "+" : ""
  return `${sign}${formatted}% from last month`
}

function formatRelativeDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }
  return formatDistanceToNow(parsed, { addSuffix: true })
}

export default async function DashboardPage() {
  const analytics = await getDashboardAnalytics()

  const incomeChangeText = formatChangeText(analytics.incomeChangePercent)
  const expenseChangeText = formatChangeText(analytics.expenseChangePercent)
  const budgetUsageText =
    analytics.budgetUsagePercent === null
      ? "Set category budgets to track progress"
      : `Spent ${Math.round(analytics.budgetUsagePercent)}% of monthly budget`

  const budgetAlert = analytics.budgetWarning
  const alertClassName = budgetAlert
    ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950"
    : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
  const alertIconClass = budgetAlert ? "text-orange-600" : "text-emerald-600"
  const alertTitle = budgetAlert ? "Budget Warning" : "On Track"
  const alertDescription = budgetAlert
    ? `You're at ${Math.round(budgetAlert.usagePercent)}% of your ${budgetAlert.categoryName} budget this month. Plan upcoming purchases carefully.`
    : "All categories are within budget so far this month. Keep up the great work!"

  return (
    <AppLayout
      title="Dashboard"
      description="Overview of your finances"
      action={
        <Button size="sm" asChild>
          <Link href="/transactions">
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <Alert className={alertClassName}>
          <AlertTriangle className={`h-4 w-4 ${alertIconClass}`} />
          <AlertTitle>{alertTitle}</AlertTitle>
          <AlertDescription>{alertDescription}</AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.balance)}</div>
              <p className="text-xs text-muted-foreground">
                Net {formatCurrency(analytics.monthlyNet)} this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.monthlyIncome)}</div>
              <p className="text-xs text-muted-foreground">{incomeChangeText}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.monthlyExpenses)}</div>
              <p className="text-xs text-muted-foreground">{expenseChangeText}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget Remaining</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.budgetRemaining)}</div>
              <p className="text-xs text-muted-foreground">{budgetUsageText}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending Trend</CardTitle>
              <CardDescription>
                Income vs expenses over the last {analytics.trend.length} months
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <SpendingTrendChart data={analytics.trend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Current month breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryPieChart data={analytics.categoryBreakdown} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add your first transaction to see it here.
                </p>
              ) : (
                <div className="space-y-4">
                  {analytics.recentTransactions.map((transaction) => {
                    const isIncome = transaction.amount >= 0
                    return (
                      <div key={transaction.id} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{transaction.description}</p>
                          {transaction.notes ? (
                            <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {transaction.categoryName}
                            {transaction.account ? ` • ${transaction.account}` : ""}
                            {" "}• {formatRelativeDate(transaction.date)}
                          </p>
                        </div>
                        <div className={`text-sm font-medium ${isIncome ? "text-green-600" : "text-red-600"}`}>
                          {isIncome ? "+" : "-"}
                          {formatAbsoluteCurrency(transaction.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Budget Overview</CardTitle>
              <CardDescription>Monthly spending by category</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.budgetOverview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Set category budgets to monitor your progress throughout the month.
                </p>
              ) : (
                <div className="space-y-4">
                  {analytics.budgetOverview.map((item) => {
                    const utilization = item.budget > 0 ? item.spent / item.budget : 1
                    const usagePercent = Math.min(Math.round(utilization * 100), 999)
                    const barWidth = `${Math.min(Math.max(utilization, 0), 1) * 100}%`
                    const progressClass = item.budget > 0 && utilization < 1 ? item.colorClass : "bg-red-500"

                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.spent)} / {formatCurrency(item.budget)}
                          </span>
                        </div>
                        <div className="w-full rounded-full bg-secondary h-2">
                          <div className={`h-2 rounded-full ${progressClass}`} style={{ width: barWidth }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.budget > 0
                            ? `${usagePercent}% of budget used`
                            : "No budget set"}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
