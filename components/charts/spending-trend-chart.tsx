"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

interface SpendingTrendChartProps {
  data: Array<{ month: string; income: number; expenses: number }>
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const hasData = data.some((point) => point.income !== 0 || point.expenses !== 0)

  if (!hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        Add transactions to see your income and expense trends.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs fill-muted-foreground" />
        <YAxis
          axisLine={false}
          tickLine={false}
          className="text-xs fill-muted-foreground"
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
                    Income: {formatCurrency(Number(incomePoint?.value ?? 0))}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    Expenses: {formatCurrency(Number(expensePoint?.value ?? 0))}
                  </span>
                </div>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="hsl(var(--chart-1))"
          fillOpacity={1}
          fill="url(#colorIncome)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="hsl(var(--chart-2))"
          fillOpacity={1}
          fill="url(#colorExpenses)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
