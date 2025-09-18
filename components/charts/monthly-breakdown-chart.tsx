"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const data = [
  { name: "Bills & Utilities", value: 4350, color: "hsl(var(--chart-1))" },
  { name: "Food & Dining", value: 2700, color: "hsl(var(--chart-2))" },
  { name: "Shopping", value: 2100, color: "hsl(var(--chart-3))" },
  { name: "Transportation", value: 1680, color: "hsl(var(--chart-4))" },
  { name: "Entertainment", value: 720, color: "hsl(var(--chart-5))" },
  { name: "Healthcare", value: 450, color: "hsl(var(--destructive))" },
]

export function MonthlyBreakdownChart() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
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
