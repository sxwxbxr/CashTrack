"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

import { useTranslations } from "@/components/language-provider"

const COLOR_PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
]

interface CategoryTrendChartProps {
  data: Array<{ month: string; [key: string]: number }>
  series: Array<{ key: string; label: string }>
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function CategoryTrendChart({ data, series }: CategoryTrendChartProps) {
  const { t } = useTranslations()
  const axisTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 }
  if (!series.length) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        {t("Select categories to generate a spending trend.")}
      </div>
    )
  }

  const hasData = data.some((point) =>
    series.some((item) => Number(point[item.key] ?? 0) !== 0),
  )

  if (!hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        {t("Not enough data to build a category trend yet.")}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
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
                          {`${entry.name}:`}
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
        <Legend formatter={(value: string) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>} />
        {series.map((item, index) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            stroke={COLOR_PALETTE[index % COLOR_PALETTE.length]}
            strokeWidth={2}
            name={item.label}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
