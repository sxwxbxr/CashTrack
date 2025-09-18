"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const data = [
  { month: "Jul", food: 450, transport: 280, entertainment: 120, shopping: 350, bills: 725 },
  { month: "Aug", food: 520, transport: 310, entertainment: 95, shopping: 420, bills: 750 },
  { month: "Sep", food: 380, transport: 290, entertainment: 180, shopping: 280, bills: 725 },
  { month: "Oct", food: 410, transport: 320, entertainment: 150, shopping: 380, bills: 780 },
  { month: "Nov", food: 480, transport: 270, entertainment: 200, shopping: 450, bills: 725 },
  { month: "Dec", food: 550, transport: 300, entertainment: 250, shopping: 520, bills: 800 },
]

export function CategoryTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
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
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="food"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          name="Food & Dining"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="transport"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          name="Transportation"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="entertainment"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2}
          name="Entertainment"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="shopping"
          stroke="hsl(var(--chart-4))"
          strokeWidth={2}
          name="Shopping"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="bills"
          stroke="hsl(var(--chart-5))"
          strokeWidth={2}
          name="Bills & Utilities"
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
