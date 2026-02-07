"use client"

import { useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/format"
import type { MonthlyPremium } from "@/lib/options"

interface PremiumChartSummaryProps {
  premiumByMonth: MonthlyPremium[]
}

const chartConfig = {
  wheel: { label: "Wheel", color: "var(--chart-1)" },
  leaps: { label: "LEAPS", color: "var(--chart-2)" },
} satisfies ChartConfig

export function PremiumChartSummary({
  premiumByMonth,
}: PremiumChartSummaryProps) {
  const totalPremium = useMemo(
    () =>
      premiumByMonth.reduce((sum, pm) => sum + pm.wheel + pm.leaps, 0),
    [premiumByMonth],
  )

  const chartData = useMemo(
    () =>
      premiumByMonth.map((pm) => ({
        month: pm.month,
        wheel: pm.wheel,
        leaps: pm.leaps,
      })),
    [premiumByMonth],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Options Premium
        </CardTitle>
        <p className="text-2xl font-bold">{formatCurrency(totalPremium)}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="wheel"
              stackId="premium"
              fill="var(--color-wheel)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="leaps"
              stackId="premium"
              fill="var(--color-leaps)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
