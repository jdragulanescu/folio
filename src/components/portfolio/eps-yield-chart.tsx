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
  CardDescription,
} from "@/components/ui/card"

interface EpsYieldChartProps {
  holdings: DisplayHolding[]
}

const chartConfig: ChartConfig = {
  epsYield: { label: "Earnings Yield", color: "oklch(0.65 0.18 80)" },
}

export function EpsYieldChart({ holdings }: EpsYieldChartProps) {
  const data = useMemo(() => {
    return [...holdings]
      .filter(
        (h) =>
          h.eps != null &&
          h.currentPrice > 0 &&
          h.weight > 0.5,
      )
      .map((h) => {
        const epsYield = (h.eps! / h.currentPrice) * 100
        return {
          symbol: h.symbol,
          epsYield: Number(epsYield.toFixed(2)),
        }
      })
      .sort((a, b) => b.epsYield - a.epsYield)
      .slice(0, 15)
  }, [holdings])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Earnings Yield</CardTitle>
        <CardDescription>EPS / Price (inverse P/E)</CardDescription>
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
                  formatter={(value) => [`${value}%`, "Earnings Yield"]}
                />
              }
            />
            <Bar dataKey="epsYield" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry) => (
                <Cell
                  key={entry.symbol}
                  fill={
                    entry.epsYield >= 0
                      ? "oklch(0.65 0.18 80)"
                      : "oklch(0.60 0.20 25)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
