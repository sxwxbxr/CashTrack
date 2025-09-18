"use client"

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
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
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Download,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

const PERIOD_OPTIONS = [
  { label: "Last 3 Months", value: "last-3-months" },
  { label: "Last 6 Months", value: "last-6-months" },
  { label: "Last 12 Months", value: "last-12-months" },
  { label: "Current Year", value: "current-year" },
  { label: "Custom Range", value: "custom" },
] as const

const CATEGORY_COLOR_CLASSES = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
] as const

const CHART_COLOR_PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
] as const

type ValueFormat = "currency" | "percentage" | "plain"
type TrendDirection = "up" | "down" | "neutral"
type InsightVariant = "positive" | "warning" | "info"
type PeriodKey = (typeof PERIOD_OPTIONS)[number]["value"]
type BudgetStatus = "ahead" | "on-track" | "behind"
type RecurringStatus = "due-soon" | "scheduled" | "auto"

type YearKey = "2024" | "2023" | "2022"

interface SummaryMetric {
  id: string
  label: string
  value: number
  format?: ValueFormat
  icon: LucideIcon
  valueClassName?: string
  change?: number
  changeDirection?: TrendDirection
  helper?: string
}

interface CategoryPerformance {
  category: string
  spent: number
  budget: number
  change: number
  transactions: number
  description?: string
}

interface BudgetHighlight {
  name: string
  description: string
  target: number
  current: number
  monthlyContribution: number
  status: BudgetStatus
  due: string
}

interface RecurringPayment {
  name: string
  amount: number
  schedule: string
  nextDate: string
  category: string
  status: RecurringStatus
}

interface Insight {
  variant: InsightVariant
  title: string
  description: string
}

interface PeriodData {
  label: string
  note?: string
  quickHighlights?: string[]
  summary: SummaryMetric[]
  categories: CategoryPerformance[]
  budgets: BudgetHighlight[]
  recurring: RecurringPayment[]
  insights: Insight[]
}

interface YearlyOverview {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  savingsRate: number
  highlight: string
  highlights: { label: string; value: string }[]
  quarters: { quarter: string; income: number; expenses: number; savings: number }[]
}

const BUDGET_GOALS: BudgetHighlight[] = [
  {
    name: "Emergency Fund",
    description: "Build 6 months of essential expenses.",
    target: 15000,
    current: 11250,
    monthlyContribution: 650,
    status: "on-track",
    due: "Dec 2024",
  },
  {
    name: "Vacation Savings",
    description: "Family trip to Portugal this summer.",
    target: 5000,
    current: 3200,
    monthlyContribution: 450,
    status: "behind",
    due: "Aug 2024",
  },
  {
    name: "Education Fund",
    description: "529 contributions for Ava's college.",
    target: 7200,
    current: 5100,
    monthlyContribution: 600,
    status: "ahead",
    due: "Dec 2024",
  },
  {
    name: "Home Office Refresh",
    description: "Workspace furniture and equipment.",
    target: 2500,
    current: 1450,
    monthlyContribution: 300,
    status: "on-track",
    due: "Oct 2024",
  },
]

const RECURRING_PAYMENTS: RecurringPayment[] = [
  {
    name: "Mortgage & HOA",
    amount: 1850,
    schedule: "Monthly",
    nextDate: "Jun 1, 2024",
    category: "Housing",
    status: "due-soon",
  },
  {
    name: "Electric & Gas Utilities",
    amount: 245,
    schedule: "Monthly",
    nextDate: "May 28, 2024",
    category: "Utilities",
    status: "due-soon",
  },
  {
    name: "Internet & Streaming Bundle",
    amount: 128,
    schedule: "Monthly",
    nextDate: "Jun 3, 2024",
    category: "Entertainment",
    status: "auto",
  },
  {
    name: "Car Insurance",
    amount: 480,
    schedule: "Quarterly",
    nextDate: "Jul 15, 2024",
    category: "Insurance",
    status: "scheduled",
  },
  {
    name: "Fitness Membership",
    amount: 59,
    schedule: "Monthly",
    nextDate: "Jun 5, 2024",
    category: "Wellness",
    status: "auto",
  },
]

const PERIOD_DATA: Record<PeriodKey, PeriodData> = {
  "last-6-months": {
    label: "Last 6 Months",
    note: "Review period: Nov 2023 – Apr 2024 compared with the previous six months.",
    quickHighlights: [
      "Housing & Utilities remain largest category ($4,350)",
      "Savings rate averaged 25.6%",
      "Shopping exceeded budget by $200",
    ],
    summary: [
      {
        id: "total-income",
        label: "Total Income",
        value: 25200,
        format: "currency",
        icon: TrendingUp,
        valueClassName: "text-green-600",
        change: 12.5,
        changeDirection: "up",
        helper: "Includes salary, bonus, and freelance work.",
      },
      {
        id: "total-expenses",
        label: "Total Expenses",
        value: 18750,
        format: "currency",
        icon: TrendingDown,
        valueClassName: "text-red-600",
        change: -8.2,
        changeDirection: "down",
        helper: "After refunds and reimbursements.",
      },
      {
        id: "net-savings",
        label: "Net Savings",
        value: 6450,
        format: "currency",
        icon: DollarSign,
        valueClassName: "text-blue-600",
        change: 18.4,
        changeDirection: "up",
        helper: "25.6% savings rate.",
      },
      {
        id: "avg-spend",
        label: "Avg Monthly Spending",
        value: 3125,
        format: "currency",
        icon: Wallet,
        change: -4.1,
        changeDirection: "down",
        helper: "Based on 6 months of data.",
      },
    ],
    categories: [
      {
        category: "Housing & Utilities",
        spent: 4350,
        budget: 4500,
        change: 2.3,
        transactions: 12,
        description: "Mortgage, insurance, energy, and services.",
      },
      {
        category: "Food & Dining",
        spent: 2700,
        budget: 3000,
        change: -15.2,
        transactions: 34,
        description: "Groceries, restaurants, and delivery.",
      },
      {
        category: "Transportation",
        spent: 1680,
        budget: 1800,
        change: -6.4,
        transactions: 18,
        description: "Fuel, maintenance, and ride share.",
      },
      {
        category: "Shopping",
        spent: 2100,
        budget: 1900,
        change: 8.1,
        transactions: 22,
        description: "Household and personal purchases.",
      },
      {
        category: "Entertainment",
        spent: 720,
        budget: 900,
        change: 12.5,
        transactions: 14,
        description: "Streaming, events, and hobbies.",
      },
    ],
    budgets: BUDGET_GOALS,
    recurring: RECURRING_PAYMENTS,
    insights: [
      {
        variant: "positive",
        title: "Dining discipline paying off",
        description:
          "Food & dining costs dropped 15% compared with the prior 6 months, keeping you well under budget.",
      },
      {
        variant: "warning",
        title: "Shopping trending over budget",
        description:
          "Discretionary shopping exceeded the allocation by $200. Consider pausing new purchases until next month.",
      },
      {
        variant: "info",
        title: "Plan upcoming renewals",
        description:
          "Car insurance renews in July. Gathering quotes now could reduce recurring expenses before the next billing cycle.",
      },
    ],
  },
  "last-3-months": {
    label: "Last 3 Months",
    note: "Review period: Feb – Apr 2024 compared with the prior quarter.",
    quickHighlights: [
      "Three consecutive surplus months",
      "Groceries 9% under plan",
      "Ride-share spend +6% vs last quarter",
    ],
    summary: [
      {
        id: "total-income",
        label: "Total Income",
        value: 13200,
        format: "currency",
        icon: TrendingUp,
        valueClassName: "text-green-600",
        change: 6.2,
        changeDirection: "up",
        helper: "Salary and bonus payments received.",
      },
      {
        id: "total-expenses",
        label: "Total Expenses",
        value: 9450,
        format: "currency",
        icon: TrendingDown,
        valueClassName: "text-red-600",
        change: -3.4,
        changeDirection: "down",
        helper: "Includes discretionary categories.",
      },
      {
        id: "net-savings",
        label: "Net Savings",
        value: 3750,
        format: "currency",
        icon: DollarSign,
        valueClassName: "text-blue-600",
        change: 11.8,
        changeDirection: "up",
        helper: "28.4% savings rate.",
      },
      {
        id: "avg-spend",
        label: "Avg Monthly Spending",
        value: 3150,
        format: "currency",
        icon: Wallet,
        change: -2.1,
        changeDirection: "down",
        helper: "Based on the last 3 months.",
      },
    ],
    categories: [
      {
        category: "Housing & Utilities",
        spent: 2180,
        budget: 2250,
        change: 1.6,
        transactions: 6,
        description: "Mortgage, insurance, energy, and services.",
      },
      {
        category: "Food & Dining",
        spent: 1380,
        budget: 1500,
        change: -9.4,
        transactions: 18,
        description: "Groceries, restaurants, and delivery.",
      },
      {
        category: "Transportation",
        spent: 820,
        budget: 900,
        change: -3.1,
        transactions: 9,
        description: "Fuel, maintenance, and ride share.",
      },
      {
        category: "Shopping",
        spent: 1080,
        budget: 950,
        change: 6.8,
        transactions: 12,
        description: "Household and personal purchases.",
      },
      {
        category: "Entertainment",
        spent: 360,
        budget: 450,
        change: 4.5,
        transactions: 8,
        description: "Streaming, events, and hobbies.",
      },
    ],
    budgets: BUDGET_GOALS,
    recurring: RECURRING_PAYMENTS,
    insights: [
      {
        variant: "positive",
        title: "Savings streak intact",
        description:
          "You posted a surplus in each of the last three months while keeping lifestyle spending in check.",
      },
      {
        variant: "warning",
        title: "Watch discretionary shopping",
        description:
          "Shopping outpaced the plan by 13%. Prioritize needs over wants to stay aligned with your budget.",
      },
      {
        variant: "info",
        title: "Transportation steady",
        description:
          "Ride-share use grew slightly. Scheduling preventative maintenance in July could keep costs predictable.",
      },
    ],
  },
  "last-12-months": {
    label: "Last 12 Months",
    note: "Review period: May 2023 – Apr 2024 compared with the prior year.",
    quickHighlights: [
      "Annual net savings up $1.6k vs last year",
      "Entertainment spend trimmed by 12%",
      "Housing share of spend dropped 2 pts",
    ],
    summary: [
      {
        id: "total-income",
        label: "Total Income",
        value: 50800,
        format: "currency",
        icon: TrendingUp,
        valueClassName: "text-green-600",
        change: 9.8,
        changeDirection: "up",
        helper: "Includes regular and supplemental income.",
      },
      {
        id: "total-expenses",
        label: "Total Expenses",
        value: 37800,
        format: "currency",
        icon: TrendingDown,
        valueClassName: "text-red-600",
        change: -6.1,
        changeDirection: "down",
        helper: "Reflects all household categories.",
      },
      {
        id: "net-savings",
        label: "Net Savings",
        value: 12600,
        format: "currency",
        icon: DollarSign,
        valueClassName: "text-blue-600",
        change: 14.3,
        changeDirection: "up",
        helper: "24.9% savings rate.",
      },
      {
        id: "avg-spend",
        label: "Avg Monthly Spending",
        value: 3150,
        format: "currency",
        icon: Wallet,
        change: -3.4,
        changeDirection: "down",
        helper: "Across the last 12 months.",
      },
    ],
    categories: [
      {
        category: "Housing & Utilities",
        spent: 8820,
        budget: 9000,
        change: 4.8,
        transactions: 24,
        description: "Mortgage, insurance, energy, and services.",
      },
      {
        category: "Food & Dining",
        spent: 5520,
        budget: 6000,
        change: -11.6,
        transactions: 68,
        description: "Groceries, restaurants, and delivery.",
      },
      {
        category: "Transportation",
        spent: 3290,
        budget: 3600,
        change: -5.2,
        transactions: 40,
        description: "Fuel, maintenance, and ride share.",
      },
      {
        category: "Shopping",
        spent: 4210,
        budget: 3800,
        change: 9.8,
        transactions: 50,
        description: "Household and personal purchases.",
      },
      {
        category: "Entertainment",
        spent: 1420,
        budget: 1800,
        change: 8.5,
        transactions: 32,
        description: "Streaming, events, and hobbies.",
      },
    ],
    budgets: BUDGET_GOALS,
    recurring: RECURRING_PAYMENTS,
    insights: [
      {
        variant: "positive",
        title: "Healthy savings growth",
        description:
          "Net savings improved by $1,580 compared with the prior year, keeping you on track for long-term goals.",
      },
      {
        variant: "warning",
        title: "Shopping continues to climb",
        description:
          "Shopping spend rose 9.8% year-over-year. Create spending limits for large purchases to keep it contained.",
      },
      {
        variant: "info",
        title: "Recurring costs stable",
        description:
          "Recurring bills average $2,680 per month. Monitor insurance renewal quotes to avoid increases.",
      },
    ],
  },
  "current-year": {
    label: "Current Year",
    note: "Year-to-date: Jan – May 2024 compared with the same period last year.",
    quickHighlights: [
      "Income up 5.6% year-to-date",
      "Recurring bills holding near $2.3k/mo",
      "Entertainment trending +6% vs last year",
    ],
    summary: [
      {
        id: "total-income",
        label: "Total Income",
        value: 20850,
        format: "currency",
        icon: TrendingUp,
        valueClassName: "text-green-600",
        change: 5.6,
        changeDirection: "up",
        helper: "Salary, bonus, and side income through May.",
      },
      {
        id: "total-expenses",
        label: "Total Expenses",
        value: 15250,
        format: "currency",
        icon: TrendingDown,
        valueClassName: "text-red-600",
        change: -4.8,
        changeDirection: "down",
        helper: "Includes seasonal home expenses.",
      },
      {
        id: "net-savings",
        label: "Net Savings",
        value: 5600,
        format: "currency",
        icon: DollarSign,
        valueClassName: "text-blue-600",
        change: 9.2,
        changeDirection: "up",
        helper: "25.8% savings rate.",
      },
      {
        id: "avg-spend",
        label: "Avg Monthly Spending",
        value: 3050,
        format: "currency",
        icon: Wallet,
        change: -3.2,
        changeDirection: "down",
        helper: "Through the first five months.",
      },
    ],
    categories: [
      {
        category: "Housing & Utilities",
        spent: 3620,
        budget: 3800,
        change: 2.1,
        transactions: 8,
        description: "Mortgage, insurance, energy, and services.",
      },
      {
        category: "Food & Dining",
        spent: 1980,
        budget: 2200,
        change: -10.6,
        transactions: 22,
        description: "Groceries, restaurants, and delivery.",
      },
      {
        category: "Transportation",
        spent: 1180,
        budget: 1250,
        change: -4.2,
        transactions: 12,
        description: "Fuel, maintenance, and ride share.",
      },
      {
        category: "Shopping",
        spent: 1560,
        budget: 1500,
        change: 5.9,
        transactions: 16,
        description: "Household and personal purchases.",
      },
      {
        category: "Entertainment",
        spent: 540,
        budget: 650,
        change: 6.1,
        transactions: 10,
        description: "Streaming, events, and hobbies.",
      },
    ],
    budgets: BUDGET_GOALS,
    recurring: RECURRING_PAYMENTS,
    insights: [
      {
        variant: "positive",
        title: "YTD savings ahead of plan",
        description:
          "Net savings are pacing $460 above your target. Keep contributions steady to maintain momentum through summer.",
      },
      {
        variant: "warning",
        title: "Shopping slightly elevated",
        description:
          "Retail spending is 4% higher than last year. Delay non-essential upgrades until July to stay aligned with goals.",
      },
      {
        variant: "info",
        title: "Utility costs steady",
        description:
          "Utility charges have remained flat for three months. Consider negotiating the internet bundle ahead of fall promos.",
      },
    ],
  },
  custom: {
    label: "Custom Range",
    note: "Custom range: Mar 1 – Apr 15, 2024 compared with the previous six weeks.",
    quickHighlights: [
      "Large appliance purchase on Mar 18",
      "Utilities trending 5% above seasonal average",
      "Dining out under budget for six weeks straight",
    ],
    summary: [
      {
        id: "total-income",
        label: "Total Income",
        value: 9800,
        format: "currency",
        icon: TrendingUp,
        valueClassName: "text-green-600",
        change: 4.2,
        changeDirection: "up",
        helper: "One-time project payment included.",
      },
      {
        id: "total-expenses",
        label: "Total Expenses",
        value: 7450,
        format: "currency",
        icon: TrendingDown,
        valueClassName: "text-red-600",
        change: -3.6,
        changeDirection: "down",
        helper: "Reflects the custom filtered dates.",
      },
      {
        id: "net-savings",
        label: "Net Savings",
        value: 2350,
        format: "currency",
        icon: DollarSign,
        valueClassName: "text-blue-600",
        change: 7.1,
        changeDirection: "up",
        helper: "24.0% savings rate.",
      },
      {
        id: "avg-spend",
        label: "Avg Monthly Spending",
        value: 3100,
        format: "currency",
        icon: Wallet,
        change: -1.9,
        changeDirection: "down",
        helper: "Custom range trendline.",
      },
    ],
    categories: [
      {
        category: "Housing & Utilities",
        spent: 1450,
        budget: 1500,
        change: 0.9,
        transactions: 3,
        description: "Mortgage, insurance, energy, and services.",
      },
      {
        category: "Food & Dining",
        spent: 980,
        budget: 1050,
        change: -8.2,
        transactions: 10,
        description: "Groceries, restaurants, and delivery.",
      },
      {
        category: "Transportation",
        spent: 510,
        budget: 540,
        change: -2.5,
        transactions: 6,
        description: "Fuel, maintenance, and ride share.",
      },
      {
        category: "Shopping",
        spent: 720,
        budget: 650,
        change: 6.5,
        transactions: 7,
        description: "Household and personal purchases.",
      },
      {
        category: "Entertainment",
        spent: 240,
        budget: 300,
        change: 3.2,
        transactions: 4,
        description: "Streaming, events, and hobbies.",
      },
    ],
    budgets: BUDGET_GOALS,
    recurring: RECURRING_PAYMENTS,
    insights: [
      {
        variant: "positive",
        title: "Custom range within limits",
        description:
          "The selected dates still delivered a surplus thanks to lower dining and transportation costs.",
      },
      {
        variant: "warning",
        title: "Spotlight on recent shopping",
        description:
          "A new appliance purchase drove shopping above plan. Schedule a budget review before the next big expense.",
      },
      {
        variant: "info",
        title: "Monitor utility usage",
        description:
          "Utilities ran 5% higher than seasonal norms. Smart thermostat adjustments could offset the increase.",
      },
    ],
  },
}

const YEARLY_OVERVIEW: Record<YearKey, YearlyOverview> = {
  "2024": {
    totalIncome: 50800,
    totalExpenses: 37250,
    totalSavings: 13550,
    savingsRate: 26.6,
    highlight: "Trending 7% higher savings than 2023 year-to-date.",
    highlights: [
      { label: "Best Month", value: "April ($1,240 net)" },
      { label: "Top Category", value: "Housing & Utilities (28%)" },
      { label: "Avg Monthly Net", value: "$1,129" },
    ],
    quarters: [
      { quarter: "Q1", income: 12600, expenses: 9450, savings: 3150 },
      { quarter: "Q2", income: 12400, expenses: 9300, savings: 3100 },
      { quarter: "Q3", income: 13000, expenses: 9700, savings: 3300 },
      { quarter: "Q4", income: 12800, expenses: 8800, savings: 4000 },
    ],
  },
  "2023": {
    totalIncome: 47800,
    totalExpenses: 36450,
    totalSavings: 11350,
    savingsRate: 23.7,
    highlight: "Savings rate improved 2.4 pts compared with 2022.",
    highlights: [
      { label: "Best Month", value: "November ($1,180 net)" },
      { label: "Top Category", value: "Food & Dining (18%)" },
      { label: "Avg Monthly Net", value: "$946" },
    ],
    quarters: [
      { quarter: "Q1", income: 11600, expenses: 8650, savings: 2950 },
      { quarter: "Q2", income: 11700, expenses: 9100, savings: 2600 },
      { quarter: "Q3", income: 12200, expenses: 9500, savings: 2700 },
      { quarter: "Q4", income: 12300, expenses: 9200, savings: 3100 },
    ],
  },
  "2022": {
    totalIncome: 45200,
    totalExpenses: 35420,
    totalSavings: 9780,
    savingsRate: 21.6,
    highlight: "Baseline year after reorganizing budgets.",
    highlights: [
      { label: "Best Month", value: "July ($980 net)" },
      { label: "Top Category", value: "Transportation (15%)" },
      { label: "Avg Monthly Net", value: "$815" },
    ],
    quarters: [
      { quarter: "Q1", income: 10800, expenses: 8400, savings: 2400 },
      { quarter: "Q2", income: 11050, expenses: 8850, savings: 2200 },
      { quarter: "Q3", income: 11600, expenses: 9050, savings: 2550 },
      { quarter: "Q4", income: 11750, expenses: 9120, savings: 2630 },
    ],
  },
}

const DEFAULT_PERIOD: PeriodKey = "last-6-months"
const DEFAULT_YEAR: YearKey = "2024"

const changeBadgeStyles: Record<TrendDirection, string> = {
  up: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
  down: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  neutral: "bg-muted text-muted-foreground border-muted",
}

const budgetStatusStyles: Record<BudgetStatus, { label: string; className: string }> = {
  ahead: {
    label: "Ahead",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  },
  "on-track": {
    label: "On Track",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  },
  behind: {
    label: "Needs Attention",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  },
}

const recurringStatusStyles: Record<RecurringStatus, { label: string; className: string }> = {
  "due-soon": {
    label: "Due Soon",
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  },
  auto: {
    label: "Auto-pay",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  },
}

const insightStyleMap: Record<InsightVariant, { container: string; badge: string; title: string; description: string; icon: LucideIcon }> = {
  positive: {
    container: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900",
    badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
    title: "text-green-800 dark:text-green-200",
    description: "text-green-700 dark:text-green-300",
    icon: Sparkles,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
    title: "text-amber-800 dark:text-amber-200",
    description: "text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
  },
  info: {
    container: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
    title: "text-blue-800 dark:text-blue-200",
    description: "text-blue-700 dark:text-blue-300",
    icon: Info,
  },
}

function formatCurrency(
  value: number,
  { minimumFractionDigits = 2, maximumFractionDigits = 2 }: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits })}`
}

function formatPercentage(value: number, fractionDigits = 1) {
  return `${value.toFixed(fractionDigits)}%`
}

function formatValue(value: number, format: ValueFormat = "currency") {
  switch (format) {
    case "percentage":
      return formatPercentage(value)
    case "plain":
      return value.toLocaleString()
    case "currency":
    default:
      return formatCurrency(value)
  }
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>(DEFAULT_PERIOD)
  const [selectedYear, setSelectedYear] = useState<YearKey>(DEFAULT_YEAR)

  const periodData = PERIOD_DATA[selectedPeriod] ?? PERIOD_DATA[DEFAULT_PERIOD]
  const yearData = YEARLY_OVERVIEW[selectedYear] ?? YEARLY_OVERVIEW[DEFAULT_YEAR]

  const categoriesWithColor = useMemo(() => {
    const total = periodData.categories.reduce((acc, category) => acc + category.spent, 0)
    return periodData.categories.map((category, index) => {
      const colorClass = CATEGORY_COLOR_CLASSES[index % CATEGORY_COLOR_CLASSES.length]
      const chartColor = CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length]
      const percentage = total > 0 ? (category.spent / total) * 100 : 0
      return { ...category, colorClass, chartColor, percentage }
    })
  }, [periodData])

  const monthlyChartData = useMemo(
    () =>
      categoriesWithColor.map((category) => ({
        name: category.category,
        value: category.spent,
        color: category.chartColor,
      })),
    [categoriesWithColor],
  )

  const recurringTotal = useMemo(
    () => periodData.recurring.reduce((sum, payment) => sum + payment.amount, 0),
    [periodData],
  )

  const handleExport = (format: "pdf" | "csv") => {
    toast.success("Export requested", {
      description: `${periodData.label} report (${format.toUpperCase()}) will be generated shortly.`,
    })
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
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Time Period</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value as YearKey)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["2024", "2023", "2022"] as YearKey[]).map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {periodData.note && <p className="text-xs text-muted-foreground">{periodData.note}</p>}
            {periodData.quickHighlights && (
              <div className="flex flex-wrap gap-2">
                {periodData.quickHighlights.map((highlight) => (
                  <Badge
                    key={highlight}
                    variant="outline"
                    className="border-dashed bg-muted/40 text-xs font-medium text-muted-foreground"
                  >
                    {highlight}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {periodData.summary.map((metric) => {
            const Icon = metric.icon
            const direction = metric.changeDirection ?? "neutral"
            const changeValue = Math.abs(metric.change ?? 0).toFixed(1)
            const changePrefix = direction === "down" ? "-" : direction === "neutral" ? "±" : "+"
            return (
              <Card key={metric.id}>
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {metric.change !== undefined && (
                    <Badge variant="outline" className={cn("flex items-center gap-1 border-0", changeBadgeStyles[direction])}>
                      {direction === "down" ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      <span>{`${changePrefix}${changeValue}%`}</span>
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", metric.valueClassName)}>{formatValue(metric.value, metric.format)}</div>
                  {metric.helper && <p className="text-xs text-muted-foreground">{metric.helper}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>

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
                  <MonthlyBreakdownChart data={monthlyChartData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top Categories</CardTitle>
                  <CardDescription>Highest spending categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoriesWithColor.map((item) => (
                      <div key={item.category} className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-1 h-3 w-3 rounded-full", item.colorClass)} />
                          <div>
                            <p className="text-sm font-medium leading-tight">{item.category}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(item.spent)}</div>
                          <div className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}% of total</div>
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

        <div className="grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Category performance</CardTitle>
              <CardDescription>Budget adherence for each major category</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriesWithColor.map((category) => {
                    const variance = category.budget - category.spent
                    const variancePositive = variance >= 0
                    const barWidth = category.budget > 0 ? Math.min((category.spent / category.budget) * 100, 100) : 0
                    return (
                      <TableRow key={category.category}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-tight">{category.category}</p>
                            <p className="text-xs text-muted-foreground">
                              {category.transactions} transactions • {formatCurrency(category.budget, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}{" "}
                              budget
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[220px]">
                          <div className="text-sm font-medium">{formatCurrency(category.spent)}</div>
                          <div className="mt-2 h-2 w-full rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-2 rounded-full",
                                category.spent > category.budget
                                  ? "bg-red-500"
                                  : category.spent / category.budget < 0.6
                                    ? "bg-emerald-500"
                                    : "bg-primary",
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "text-sm font-medium",
                              variancePositive ? "text-green-600" : "text-red-600",
                            )}
                          >
                            {variancePositive ? "+" : "-"}
                            {formatCurrency(Math.abs(variance), {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">Remaining from budget</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex items-center gap-1 border-0",
                              category.change >= 0
                                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
                            )}
                          >
                            {category.change >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {`${category.change >= 0 ? "+" : "-"}${Math.abs(category.change).toFixed(1)}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="space-y-4 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Goal tracking</CardTitle>
                <CardDescription>Progress toward savings objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {periodData.budgets.map((budget, index) => {
                    const status = budgetStatusStyles[budget.status]
                    const progress = budget.target > 0 ? Math.min((budget.current / budget.target) * 100, 100) : 0
                    return (
                      <div key={budget.name} className={cn("space-y-2", index > 0 && "border-t pt-4")}> 
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{budget.name}</p>
                            <p className="text-xs text-muted-foreground">{budget.description}</p>
                          </div>
                          <Badge variant="outline" className={cn("border-0", status.className)}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {formatCurrency(budget.current, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} saved
                          </span>
                          <span>
                            {formatCurrency(budget.target, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} goal
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              budget.status === "behind"
                                ? "bg-amber-500"
                                : budget.status === "ahead"
                                  ? "bg-emerald-500"
                                  : "bg-primary",
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Contributing {formatCurrency(budget.monthlyContribution, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          /mo • Target {budget.due}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming recurring charges</CardTitle>
                <CardDescription>
                  Charges scheduled this cycle total {formatCurrency(recurringTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {periodData.recurring.map((payment) => {
                    const status = recurringStatusStyles[payment.status]
                    return (
                      <div
                        key={payment.name}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-background/60 p-3 dark:bg-muted/20"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-tight">{payment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.category} • {payment.schedule}
                          </p>
                          <p className="text-xs text-muted-foreground">Next charge {payment.nextDate}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(payment.amount)}</div>
                          <Badge variant="outline" className={cn("mt-2 border-0", status.className)}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedYear} snapshot</CardTitle>
            <CardDescription>{yearData.highlight}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Total Income</p>
                <p className="text-lg font-semibold">{formatCurrency(yearData.totalIncome)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-semibold">{formatCurrency(yearData.totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Total Savings</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-300">
                  {formatCurrency(yearData.totalSavings)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Savings rate</span>
                <span className="text-green-600 dark:text-green-300">{formatPercentage(yearData.savingsRate)}</span>
              </div>
              <Progress value={Math.min(yearData.savingsRate, 100)} className="mt-2 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">Goal: 30% yearly savings rate</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {yearData.highlights.map((item) => (
                <div key={item.label} className="rounded-md border bg-background/40 p-3 dark:bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground uppercase">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Income</TableHead>
                    <TableHead>Expenses</TableHead>
                    <TableHead>Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearData.quarters.map((quarter) => (
                    <TableRow key={quarter.quarter}>
                      <TableCell className="font-medium">{quarter.quarter}</TableCell>
                      <TableCell>{formatCurrency(quarter.income)}</TableCell>
                      <TableCell>{formatCurrency(quarter.expenses)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-300">
                        {formatCurrency(quarter.savings)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial insights</CardTitle>
            <CardDescription>{periodData.label} summary insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {periodData.insights.map((insight) => {
                const style = insightStyleMap[insight.variant]
                const Icon = style.icon
                return (
                  <div key={insight.title} className={cn("rounded-lg border p-4", style.container)}>
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-1 rounded-full p-2", style.badge)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", style.title)}>{insight.title}</p>
                        <p className={cn("mt-1 text-sm", style.description)}>{insight.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

