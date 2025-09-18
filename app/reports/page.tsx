"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { MonthlyBreakdownChart } from "@/components/charts/monthly-breakdown-chart"
import { CategoryTrendChart } from "@/components/charts/category-trend-chart"
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart"
import { YearlyComparisonChart } from "@/components/charts/yearly-comparison-chart"

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("last-6-months")
  const [selectedYear, setSelectedYear] = useState("2024")

  const handleExport = (format: "pdf" | "csv") => {
    console.log(`Exporting report as ${format}`)
    // Implementation would go here
  }

  return (
    <AppLayout
      title="Reports & Analytics"
      description="Detailed insights into your spending patterns"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Period Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Time Period:</span>
              </div>
              <div className="flex gap-2">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    <SelectItem value="last-6-months">Last 6 Months</SelectItem>
                    <SelectItem value="last-12-months">Last 12 Months</SelectItem>
                    <SelectItem value="current-year">Current Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">$25,200.00</div>
              <p className="text-xs text-muted-foreground">+12.5% from previous period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">$18,750.00</div>
              <p className="text-xs text-muted-foreground">-8.2% from previous period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">$6,450.00</div>
              <p className="text-xs text-muted-foreground">25.6% savings rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Monthly Spending</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$3,125.00</div>
              <p className="text-xs text-muted-foreground">Based on 6 months</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Tabs */}
        <Tabs defaultValue="monthly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monthly">Monthly Breakdown</TabsTrigger>
            <TabsTrigger value="trends">Category Trends</TabsTrigger>
            <TabsTrigger value="income-expense">Income vs Expense</TabsTrigger>
            <TabsTrigger value="yearly">Yearly Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Spending Breakdown</CardTitle>
                  <CardDescription>Spending by category for the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <MonthlyBreakdownChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top Categories</CardTitle>
                  <CardDescription>Highest spending categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { category: "Bills & Utilities", amount: 4350, percentage: 23.2, color: "bg-red-500" },
                      { category: "Food & Dining", amount: 2700, percentage: 14.4, color: "bg-blue-500" },
                      { category: "Transportation", amount: 1680, percentage: 9.0, color: "bg-green-500" },
                      { category: "Shopping", amount: 2100, percentage: 11.2, color: "bg-yellow-500" },
                      { category: "Entertainment", amount: 720, percentage: 3.8, color: "bg-purple-500" },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="font-medium">{item.category}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${item.amount.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{item.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Category Spending Trends</CardTitle>
                <CardDescription>How your spending in each category has changed over time</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryTrendChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income-expense" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Monthly comparison of income and expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <IncomeExpenseChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="yearly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Year-over-Year Comparison</CardTitle>
                <CardDescription>Compare spending patterns across different years</CardDescription>
              </CardHeader>
              <CardContent>
                <YearlyComparisonChart />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Insights</CardTitle>
            <CardDescription>AI-powered insights based on your spending patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-800 dark:text-green-200">Great Progress!</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your food spending decreased by 15% compared to last month. Keep up the good work!
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Budget Alert</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  You're spending 20% more on entertainment this month. Consider reviewing your entertainment budget.
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">Savings Opportunity</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Based on your patterns, you could save an additional $200/month by reducing dining out frequency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
