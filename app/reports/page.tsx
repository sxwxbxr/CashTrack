"use client"

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Info,
  Loader2,
  Minus,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { MonthlyBreakdownChart } from "@/components/charts/monthly-breakdown-chart"
import { CategoryTrendChart } from "@/components/charts/category-trend-chart"
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart"
import { YearlyComparisonChart } from "@/components/charts/yearly-comparison-chart"
import { cn } from "@/lib/utils"
import type { ReportAnalytics, ReportPeriodKey } from "@/lib/reports/analytics"

const PERIOD_OPTIONS: Array<{ label: string; value: ReportPeriodKey }> = [
  { label: "Last 3 Months", value: "last-3-months" },
  { label: "Last 6 Months", value: "last-6-months" },
  { label: "Last 12 Months", value: "last-12-months" },
  { label: "Current Year", value: "current-year" },
]

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

interface SummaryConfig {
  icon: LucideIcon
  preferLower?: boolean
}

const SUMMARY_CONFIG: Record<string, SummaryConfig> = {
  "Total Income": { icon: TrendingUp },
  "Total Expenses": { icon: TrendingDown, preferLower: true },
  "Net Savings": { icon: Wallet },
  "Avg Monthly Spending": { icon: DollarSign, preferLower: true },
}

const INSIGHT_STYLES: Record<"positive" | "warning" | "info", { container: string; icon: string }> = {
  positive: { container: "border-l-4 border-emerald-500 bg-emerald-500/5", icon: "text-emerald-600" },
  warning: { container: "border-l-4 border-amber-500 bg-amber-500/5", icon: "text-amber-600" },
  info: { container: "border-l-4 border-sky-500 bg-sky-500/5", icon: "text-sky-600" },
}

const INSIGHT_ICONS = {
  positive: Sparkles,
  warning: AlertTriangle,
  info: Info,
} as const

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatChange(value: number | null, preferLower = false) {
  if (value === null || Number.isNaN(value)) {
    return { label: "No comparison", display: "—", className: "text-muted-foreground" }
  }

  const formatted = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
  if (value === 0) {
    return { label: "No change", display: formatted, className: "text-muted-foreground" }
  }

  const isPositive = preferLower ? value < 0 : value > 0
  return {
    label: isPositive ? "Improved" : "Declined",
    display: formatted,
    className: isPositive ? "text-emerald-600" : "text-red-600",
  }
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateRange(start: string, end: string) {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) {
    return `${start} – ${end}`
  }

  const inclusiveEnd = new Date(endDate.getTime() - 86_400_000)
  return `${dateFormatter.format(startDate)} – ${dateFormatter.format(inclusiveEnd)}`
}

interface ReportsResponse {
  report?: ReportAnalytics
  error?: unknown
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriodKey>("last-3-months")
  const [report, setReport] = useState<ReportAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/reports?period=${period}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as ReportsResponse
          const message = typeof body.error === "string" ? body.error : "Unable to load report"
          throw new Error(message)
        }

        const body = (await response.json()) as ReportsResponse
        if (!body.report) {
          throw new Error("No analytics were returned")
        }

        if (isMounted) {
          setReport(body.report)
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return
        }

        const message = fetchError instanceof Error ? fetchError.message : "Unable to load report"
        if (isMounted) {
          setError(message)
        }
        toast.error("Unable to load report", { description: message })
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [period, refreshToken])

  const handleRefresh = () => {
    setRefreshToken((token) => token + 1)
  }

  const handlePeriodChange = (value: string) => {
    setPeriod(value as ReportPeriodKey)
  }

  const categoryRows = useMemo(() => {
    if (!report) return []
    return report.categories.map((category) => {
      const budget = Number(category.budget ?? 0)
      const spent = Number(category.spent ?? 0)
      const transactions = Number(category.transactions ?? 0)
      const usagePercent = budget > 0 ? (spent / budget) * 100 : null
      const overBudget = budget > 0 && spent > budget
      const change = category.change
      return { category, budget, spent, transactions, usagePercent, overBudget, change }
    })
  }, [report])

  const currentYearLabels = useMemo(() => {
    if (!report) {
      return { current: "Current", previous: "Previous" }
    }
    const startDate = parseIsoDate(report.startDate)
    if (!startDate) {
      return { current: "Current", previous: "Previous" }
    }
    const currentYear = startDate.getUTCFullYear()
    return { current: currentYear.toString(), previous: (currentYear - 1).toString() }
  }, [report])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Monitor how your household spending trends evolve over time and identify opportunities to save more.
              </p>
            </div>
            {report && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="rounded-full">
                  {report.label}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateRange(report.startDate, report.endDate)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">{error}</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Try refreshing the report or selecting a different time period.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!report && loading && (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading analytics…
          </div>
        )}

        {report && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {report.summary.map((metric) => {
                const config = SUMMARY_CONFIG[metric.label] ?? { icon: Info }
                const changeDetails = formatChange(metric.change, config.preferLower)
                const DirectionIcon =
                  metric.direction === "up" ? ArrowUpRight : metric.direction === "down" ? ArrowDownRight : Minus
                const MetricIcon = config.icon

                return (
                  <Card key={metric.label} className="shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                        {metric.helper && <CardDescription className="text-xs">{metric.helper}</CardDescription>}
                      </div>
                      <MetricIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-2xl font-semibold tracking-tight">{formatCurrency(metric.value)}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn("inline-flex items-center gap-1 font-medium", changeDetails.className)}>
                          <DirectionIcon className="h-3 w-3" />
                          {changeDetails.display}
                        </span>
                        <span className="text-muted-foreground">{changeDetails.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Spending breakdown</CardTitle>
                  <CardDescription>Compare categories, monthly trends, and income versus expenses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="categories" className="space-y-4">
                    <TabsList className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <TabsTrigger value="categories">Top categories</TabsTrigger>
                      <TabsTrigger value="trend">Category trend</TabsTrigger>
                      <TabsTrigger value="income-expense">Income vs expenses</TabsTrigger>
                      <TabsTrigger value="yearly">Yearly comparison</TabsTrigger>
                    </TabsList>
                    <TabsContent value="categories" className="mt-0">
                      <MonthlyBreakdownChart data={report.monthlyBreakdown} />
                    </TabsContent>
                    <TabsContent value="trend" className="mt-0">
                      <CategoryTrendChart data={report.categoryTrend.data} series={report.categoryTrend.series} />
                    </TabsContent>
                    <TabsContent value="income-expense" className="mt-0">
                      <IncomeExpenseChart data={report.incomeExpense} />
                    </TabsContent>
                    <TabsContent value="yearly" className="mt-0">
                      <YearlyComparisonChart
                        data={report.yearlyComparison}
                        currentLabel={currentYearLabels.current}
                        previousLabel={currentYearLabels.previous}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Highlights</CardTitle>
                  <CardDescription>Quick takeaways for this period.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.highlights.length > 0 ? (
                    <ul className="space-y-3 text-sm">
                      {report.highlights.map((highlight, index) => (
                        <li key={`${highlight}-${index}`} className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Once more transactions are categorized, you will see personalized highlights here.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Category performance</CardTitle>
                <CardDescription>
                  Track spending relative to your budgets and compare activity with the previous period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="w-[220px]">Budget usage</TableHead>
                        <TableHead className="text-right">Transactions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                            Add categorized expenses to see how you are tracking against your plans.
                          </TableCell>
                        </TableRow>
                      )}
                      {categoryRows.map(({ category, budget, spent, transactions, usagePercent, overBudget, change }) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className={cn("h-2.5 w-2.5 rounded-full", category.colorClass)} />
                              <div className="flex flex-col">
                                <span className="font-medium">{category.name}</span>
                                {overBudget && <Badge variant="destructive">Over budget</Badge>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(spent)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {budget > 0 ? formatCurrency(budget) : "—"}
                          </TableCell>
                          <TableCell>
                            {usagePercent !== null ? (
                              <div className="space-y-1">
                                <Progress value={Math.min(usagePercent, 100)} />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{Math.round(usagePercent)}%</span>
                                  <span className={overBudget ? "text-red-600" : "text-emerald-600"}>
                                    {overBudget
                                      ? `Over by ${formatCurrency(spent - budget)}`
                                      : `Remaining ${formatCurrency(Math.max(budget - spent, 0))}`}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No budget set</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-col items-end gap-1 text-sm">
                              <span>{integerFormatter.format(transactions)}</span>
                              {change !== null && (
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    change > 0 ? "text-red-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground",
                                  )}
                                >
                                  {`${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {report.insights.length > 0 ? (
                report.insights.map((insight, index) => {
                  const style = INSIGHT_STYLES[insight.variant]
                  const InsightIcon = INSIGHT_ICONS[insight.variant]

                  return (
                    <Card key={`${insight.title}-${index}`} className={cn("shadow-sm", style.container)}>
                      <CardHeader className="space-y-2 pb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <InsightIcon className={cn("h-4 w-4", style.icon)} />
                          <span>{insight.title}</span>
                        </div>
                        <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                          {insight.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )
                })
              ) : (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    Insights will appear here once CashTrack has enough history to spot meaningful patterns.
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
