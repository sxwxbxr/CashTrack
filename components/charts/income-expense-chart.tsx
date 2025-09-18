"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const data = [
  { month: "Jul", income: 4200, expenses: 2325 },
  { month: "Aug", income: 4200, expenses: 2595 },
  { month: "Sep", income: 4500, expenses: 2355 },
  { month: "Oct", income: 4200, expenses: 2540 },
  { month: "Nov", income: 4200, expenses: 2625 },
  { month: "Dec", income: 4800, expenses: 2920 },
]

export function IncomeExpenseChart() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
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
                  <div className="grid grid-cols-1 gap-2">
                    <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className="text-sm" style={{ color: entry.color }}>
                          {entry.name}:
                        </span>
                        <span className="font-bold">${entry.value}</span>
                      </div>
                    ))}
                    {payload.length === 2 && (
                      <div className="flex items-center justify-between gap-2 border-t pt-2">
                        <span className="text-sm font-medium">Net:</span>
                        <span className="font-bold text-green-600">
                          ${(payload[0].value as number) - (payload[1].value as number)}
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
        <Legend />
        <Bar dataKey="income" fill="hsl(var(--chart-1))" name="Income" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="hsl(var(--chart-2))" name="Expenses" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
