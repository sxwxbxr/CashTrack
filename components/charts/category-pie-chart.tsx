"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

import { useTranslations } from "@/components/language-provider"

interface CategoryPieChartProps {
  data: Array<{ name: string; value: number; color: string }>
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const { t } = useTranslations()
  const hasData = data.some((entry) => entry.value > 0)

  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        {t("Add categorized expenses to see your spending breakdown.")}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) {
              return null
            }

            const point = payload[0]

            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="flex flex-col space-y-1">
                  <span className="text-[0.70rem] uppercase text-muted-foreground">{point.name}</span>
                  <span className="font-medium text-muted-foreground">{formatCurrency(Number(point.value ?? 0))}</span>
                </div>
              </div>
            )
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
