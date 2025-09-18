"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const data = [
  { month: "Jan", "2023": 2400, "2024": 2200 },
  { month: "Feb", "2023": 2100, "2024": 2400 },
  { month: "Mar", "2023": 2800, "2024": 2300 },
  { month: "Apr", "2023": 2600, "2024": 2500 },
  { month: "May", "2023": 2900, "2024": 2600 },
  { month: "Jun", "2023": 3200, "2024": 2800 },
  { month: "Jul", "2023": 2800, "2024": 2325 },
  { month: "Aug", "2023": 3100, "2024": 2595 },
  { month: "Sep", "2023": 2700, "2024": 2355 },
  { month: "Oct", "2023": 2900, "2024": 2540 },
  { month: "Nov", "2023": 3300, "2024": 2625 },
  { month: "Dec", "2023": 3500, "2024": 2920 },
]

export function YearlyComparisonChart() {
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
                          {entry.dataKey}:
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
        <Bar dataKey="2023" fill="hsl(var(--chart-1))" name="2023" radius={[4, 4, 0, 0]} />
        <Bar dataKey="2024" fill="hsl(var(--chart-2))" name="2024" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
