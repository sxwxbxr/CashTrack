"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

import { useTranslations } from "@/components/language-provider"
import { DEFAULT_CHART_COLORS } from "@/lib/colors"

interface SpendingTrendChartProps {
  data: Array<{ month: string; income: number; expenses: number }>
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const { t } = useTranslations()
  const hasData = data.some((point) => point.income !== 0 || point.expenses !== 0)
  const axisTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 }

  if (!hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        {t("Add transactions to see your income and expense trends.")}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0.8} />
            <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[1]} stopOpacity={0.8} />
            <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[1]} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisTickStyle} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={axisTickStyle}
          tickFormatter={(value) => formatCurrency(Number(value))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) {
              return null
            }

            const incomePoint = payload.find((entry) => entry.dataKey === "income")
            const expensePoint = payload.find((entry) => entry.dataKey === "expenses")

            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="flex flex-col space-y-1">
                  <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                  <span className="font-medium text-muted-foreground">
                    {t("Income:")} {formatCurrency(Number(incomePoint?.value ?? 0))}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {t("Expenses:")} {formatCurrency(Number(expensePoint?.value ?? 0))}
                  </span>
                </div>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke={DEFAULT_CHART_COLORS[0]}
          fillOpacity={1}
          fill="url(#colorIncome)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke={DEFAULT_CHART_COLORS[1]}
          fillOpacity={1}
          fill="url(#colorExpenses)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
