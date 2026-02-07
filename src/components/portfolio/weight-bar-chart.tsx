"use client"

import { useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import type { DisplayHolding } from "@/lib/portfolio"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface WeightBarChartProps {
  holdings: DisplayHolding[]
}

const BAR_COLORS = [
  "oklch(0.65 0.19 250)",
  "oklch(0.62 0.17 280)",
  "oklch(0.60 0.20 220)",
  "oklch(0.58 0.15 200)",
  "oklch(0.56 0.18 260)",
  "oklch(0.64 0.14 190)",
  "oklch(0.55 0.16 240)",
  "oklch(0.63 0.13 170)",
]

const chartConfig: ChartConfig = {
  weight: { label: "Weight", color: "oklch(0.65 0.19 250)" },
}

export function WeightBarChart({ holdings }: WeightBarChartProps) {
  const data = useMemo(() => {
    return [...holdings]
      .filter((h) => h.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 15)
      .map((h) => ({
        symbol: h.symbol,
        weight: Number(h.weight.toFixed(2)),
      }))
  }, [holdings])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Portfolio by Weight</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={data}
            margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="symbol"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11 }}
              width={40}
            />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [`${value}%`, "Weight"]}
                />
              }
            />
            <Bar dataKey="weight" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.symbol}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
