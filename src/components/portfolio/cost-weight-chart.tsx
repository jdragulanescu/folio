"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
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

interface CostWeightChartProps {
  holdings: DisplayHolding[]
}

const chartConfig: ChartConfig = {
  weightOnCost: { label: "Weight on Cost", color: "oklch(0.65 0.17 162)" },
}

export function CostWeightChart({ holdings }: CostWeightChartProps) {
  const data = useMemo(() => {
    return [...holdings]
      .filter((h) => h.totalCost > 0 && h.weight > 0.5)
      .sort((a, b) => {
        const aWoc = a.marketValue / a.totalCost
        const bWoc = b.marketValue / b.totalCost
        return bWoc - aWoc
      })
      .slice(0, 15)
      .map((h) => {
        const woc = (h.marketValue / h.totalCost) * 100
        return {
          symbol: h.symbol,
          weightOnCost: Number(woc.toFixed(1)),
        }
      })
  }, [holdings])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Weight on Cost</CardTitle>
        <CardDescription>Market value as % of cost basis</CardDescription>
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
            <ReferenceLine
              y={100}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: "Break-even", position: "right", fontSize: 10, fill: "var(--color-muted-foreground)" }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [`${value}%`, "Weight on Cost"]}
                />
              }
            />
            <Bar
              dataKey="weightOnCost"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              fill="var(--color-weightOnCost)"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
