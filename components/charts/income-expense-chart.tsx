"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

import { useTranslations } from "@/components/language-provider"
import { useAppSettings } from "@/components/settings-provider"
import { DEFAULT_CHART_COLORS } from "@/lib/colors"

const DEFAULT_DATA = [
  { month: "Jul", income: 4200, expenses: 2325 },
  { month: "Aug", income: 4200, expenses: 2595 },
  { month: "Sep", income: 4500, expenses: 2355 },
  { month: "Oct", income: 4200, expenses: 2540 },
  { month: "Nov", income: 4200, expenses: 2625 },
  { month: "Dec", income: 4800, expenses: 2920 },
]

interface IncomeExpenseChartProps {
  data?: Array<{ month: string; income: number; expenses: number }>
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const { t } = useTranslations()
  const { settings } = useAppSettings()
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: settings?.currency ?? "USD",
      }),
    [settings?.currency],
  )
  const usingFallback = !data
  const chartData = usingFallback ? DEFAULT_DATA : data
  const hasData = chartData.some((point) => point.income !== 0 || point.expenses !== 0)
  const axisTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 }

  if (!usingFallback && !hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        {t("Add transactions to compare income and expenses.")}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisTickStyle} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={axisTickStyle}
          tickFormatter={(value) => currencyFormatter.format(Number(value))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const incomeValue = payload.find((entry) => entry.dataKey === "income")?.value as number | undefined
              const expenseValue = payload.find((entry) => entry.dataKey === "expenses")?.value as number | undefined
              const net =
                typeof incomeValue === "number" && typeof expenseValue === "number"
                  ? incomeValue - expenseValue
                  : undefined

              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className="text-sm" style={{ color: entry.color }}>
                          {`${t(entry.name ?? "")}:`}
                        </span>
                        <span className="font-bold">{currencyFormatter.format(Number(entry.value ?? 0))}</span>
                      </div>
                    ))}
                    {typeof net === "number" && (
                      <div className="flex items-center justify-between gap-2 border-t pt-2">
                        <span className="text-sm font-medium">{t("Net:")}</span>
                        <span className={net >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>
                          {currencyFormatter.format(net)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend
          formatter={(value: string) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{t(value)}</span>}
        />
        <Bar dataKey="income" fill={DEFAULT_CHART_COLORS[0]} name={t("Income")} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill={DEFAULT_CHART_COLORS[1]} name={t("Expenses")} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
