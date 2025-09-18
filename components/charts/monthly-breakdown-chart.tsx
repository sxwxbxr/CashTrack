"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const COLOR_PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
]

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
  const chartData = (data?.length ? data : DEFAULT_DATA).map((entry, index) => ({
    ...entry,
    color: entry.color ?? COLOR_PALETTE[index % COLOR_PALETTE.length],
  }))

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
                      <span className="font-bold">${payload[0].value?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
