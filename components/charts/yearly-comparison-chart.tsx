"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

import { useTranslations } from "@/components/language-provider"

const CURRENT_YEAR_COLOR = "hsl(var(--primary))"
const PREVIOUS_YEAR_COLOR = "hsl(var(--chart-5))"

const DEFAULT_DATA = [
  { month: "Jan", previous: 2400, current: 2200 },
  { month: "Feb", previous: 2100, current: 2400 },
  { month: "Mar", previous: 2800, current: 2300 },
  { month: "Apr", previous: 2600, current: 2500 },
  { month: "May", previous: 2900, current: 2600 },
  { month: "Jun", previous: 3200, current: 2800 },
  { month: "Jul", previous: 2800, current: 2325 },
  { month: "Aug", previous: 3100, current: 2595 },
  { month: "Sep", previous: 2700, current: 2355 },
  { month: "Oct", previous: 2900, current: 2540 },
  { month: "Nov", previous: 3300, current: 2625 },
  { month: "Dec", previous: 3500, current: 2920 },
]

interface YearlyComparisonChartProps {
  data?: Array<{ month: string; current: number; previous: number }>
  currentLabel?: string
  previousLabel?: string
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function YearlyComparisonChart({
  data,
  currentLabel = "Current",
  previousLabel = "Previous",
}: YearlyComparisonChartProps) {
  const { t } = useTranslations()
  const usingFallback = !data
  const chartData = usingFallback ? DEFAULT_DATA : data
  const hasData = chartData.some((point) => point.current !== 0 || point.previous !== 0)
  const axisTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 }
  const resolvedCurrentLabel = t(currentLabel)
  const resolvedPreviousLabel = t(previousLabel)

  if (!usingFallback && !hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        {t("Year-over-year comparison becomes available once you have at least two years of spending data.")}
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
          tickFormatter={(value) => formatCurrency(Number(value))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className="text-sm" style={{ color: entry.color }}>
                          {`${t(entry.name ?? "")}:`}
                        </span>
                        <span className="font-bold">{formatCurrency(Number(entry.value ?? 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend formatter={(value: string) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{t(value)}</span>} />
        <Bar dataKey="previous" fill={PREVIOUS_YEAR_COLOR} name={resolvedPreviousLabel} radius={[4, 4, 0, 0]} />
        <Bar dataKey="current" fill={CURRENT_YEAR_COLOR} name={resolvedCurrentLabel} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
