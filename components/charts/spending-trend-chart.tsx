"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

const data = [
  { month: "Jan", income: 4000, expenses: 2400 },
  { month: "Feb", income: 3000, expenses: 1398 },
  { month: "Mar", income: 2000, expenses: 2800 },
  { month: "Apr", income: 2780, expenses: 3908 },
  { month: "May", income: 1890, expenses: 4800 },
  { month: "Jun", income: 2390, expenses: 3800 },
  { month: "Jul", income: 3490, expenses: 4300 },
]

export function SpendingTrendChart() {
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
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                      <span className="font-bold text-muted-foreground">Income: ${payload[0].value}</span>
                      <span className="font-bold text-muted-foreground">Expenses: ${payload[1].value}</span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
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
