"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeProfit, isShortStrategy } from "@/lib/options-shared"
import type { OptionRecord } from "@/lib/types"

interface PremiumChartProps {
  allOptions: OptionRecord[]
  initialYear?: number
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const chartConfig = {
  premium: { label: "Premium", color: "var(--chart-1)" },
} satisfies ChartConfig

export function PremiumChart({ allOptions, initialYear }: PremiumChartProps) {
  const shortOptions = useMemo(
    () => allOptions.filter((o) => isShortStrategy(o.strategy_type)),
    [allOptions],
  )

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const opt of shortOptions) {
      if (opt.close_date) {
        years.add(new Date(opt.close_date).getFullYear())
      }
    }
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [shortOptions])

  const [selectedYear, setSelectedYear] = useState(
    initialYear ?? availableYears[0] ?? new Date().getFullYear(),
  )

  const chartData = useMemo(() => {
    // Initialize all 12 months
    const months = MONTH_NAMES.map((name) => ({
      month: name,
      premium: 0,
    }))

    for (const opt of shortOptions) {
      if (!opt.close_date) continue
      const closeDate = new Date(opt.close_date)
      if (closeDate.getFullYear() !== selectedYear) continue

      const profit = computeProfit(opt)
      if (profit == null) continue

      const monthIdx = closeDate.getMonth()
      months[monthIdx].premium += profit
    }

    return months.map((m) => ({
      month: m.month,
      premium: Math.round(m.premium * 100) / 100,
    }))
  }, [shortOptions, selectedYear])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monthly Short Premium</CardTitle>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `$${v}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="premium"
              fill="var(--color-premium)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
