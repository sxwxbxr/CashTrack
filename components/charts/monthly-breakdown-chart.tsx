"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

import { useTranslations } from "@/components/language-provider"
import { useAppSettings } from "@/components/settings-provider"
import { DEFAULT_CHART_COLORS } from "@/lib/colors"

const COLOR_PALETTE = DEFAULT_CHART_COLORS

const DEFAULT_DATA = [
  { name: "Bills & Utilities", value: 4350, color: COLOR_PALETTE[0] },
  { name: "Food & Dining", value: 2700, color: COLOR_PALETTE[1] },
  { name: "Shopping", value: 2100, color: COLOR_PALETTE[2] },
  { name: "Transportation", value: 1680, color: COLOR_PALETTE[3] },
  { name: "Entertainment", value: 720, color: COLOR_PALETTE[4] },
  { name: "Healthcare", value: 450, color: COLOR_PALETTE[5] },
]

interface MonthlyBreakdownChartProps {
  data?: { name: string; value: number; color?: string }[]
}

export function MonthlyBreakdownChart({ data }: MonthlyBreakdownChartProps) {
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
  const source = usingFallback ? DEFAULT_DATA : data
  const chartData = source.map((entry, index) => ({
    ...entry,
    color: entry.color ?? COLOR_PALETTE[index % COLOR_PALETTE.length],
  }))

  if (!usingFallback) {
    const hasData = source.some((entry) => Number(entry.value) > 0)
    if (!hasData) {
      return (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          {t("Add categorized expenses to see your spending breakdown.")}
        </div>
      )
    }
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">{payload[0].name}</span>
                      <span className="font-bold">{currencyFormatter.format(Number(payload[0].value ?? 0))}</span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend formatter={(value: string) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
