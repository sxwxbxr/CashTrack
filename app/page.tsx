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
import { getTranslator, type Translator } from "@/lib/i18n/server"
import { getAppSettings } from "@/lib/settings/service"

function formatChangeText(t: Translator, value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return t("No previous month data")
  }
  const formatted = value.toFixed(1)
  const sign = value >= 0 ? "+" : ""
  return t("{{sign}}{{value}}% from last month", { values: { sign, value: formatted } })
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
  const settings = await getAppSettings()
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: settings.currency,
    minimumFractionDigits: 2,
  })

  const formatCurrency = (value: number): string => currencyFormatter.format(value)
  const formatAbsoluteCurrency = (value: number): string => currencyFormatter.format(Math.abs(value))
  const t = getTranslator()

  const incomeChangeText = formatChangeText(t, analytics.incomeChangePercent)
  const expenseChangeText = formatChangeText(t, analytics.expenseChangePercent)
  const budgetUsageText =
    analytics.budgetUsagePercent === null
      ? t("Set category budgets to track progress")
      : t("Spent {{percent}}% of monthly budget", {
          values: { percent: Math.round(analytics.budgetUsagePercent).toString() },
        })

  const budgetAlert = analytics.budgetWarning
  const alertClassName = budgetAlert
    ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950"
    : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
  const alertIconClass = budgetAlert ? "text-orange-600" : "text-emerald-600"
  const alertTitle = budgetAlert ? t("Budget Warning") : t("On Track")
  const alertDescription = budgetAlert
    ? t("You're at {{usage}}% of your {{category}} budget this month. Plan upcoming purchases carefully.", {
        values: {
          usage: Math.round(budgetAlert.usagePercent).toString(),
          category: budgetAlert.categoryName,
        },
      })
    : t("All categories are within budget so far this month. Keep up the great work!")

  return (
    <AppLayout
      title={t("Dashboard")}
      description={t("Overview of your finances")}
      action={
        <Button size="sm" asChild>
          <Link href="/transactions">
            <Plus className="mr-2 h-4 w-4" />
            {t("Add Transaction")}
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
              <CardTitle className="text-sm font-medium">{t("Total Balance")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.balance)}</div>
              <p className="text-xs text-muted-foreground">
                {t("Net {{amount}} this month", { values: { amount: formatCurrency(analytics.monthlyNet) } })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("Monthly Income")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.monthlyIncome)}</div>
              <p className="text-xs text-muted-foreground">{incomeChangeText}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("Monthly Expenses")}</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.monthlyExpenses)}</div>
              <p className="text-xs text-muted-foreground">{expenseChangeText}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("Budget Remaining")}</CardTitle>
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
              <CardTitle>{t("Spending Trend")}</CardTitle>
              <CardDescription>
                {t("Income vs expenses over the last {{months}} months", {
                  values: { months: analytics.trend.length.toString() },
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <SpendingTrendChart data={analytics.trend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Spending by Category")}</CardTitle>
              <CardDescription>{t("Current month breakdown")}</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryPieChart data={analytics.categoryBreakdown} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>{t("Recent Transactions")}</CardTitle>
              <CardDescription>{t("Your latest financial activity")}</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("Add your first transaction to see it here.")}</p>
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
              <CardTitle>{t("Budget Overview")}</CardTitle>
              <CardDescription>{t("Monthly spending by category")}</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.budgetOverview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("Set category budgets to monitor your progress throughout the month.")}
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
                            ? t("{{value}}% of budget used", { values: { value: usagePercent.toString() } })
                            : t("No budget set")}
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
