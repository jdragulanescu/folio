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
import { buildPremiumByMonth } from "@/lib/options"
import type { OptionRecord } from "@/lib/types"

interface PremiumChartProps {
  allOptions: OptionRecord[]
  initialYear?: number
}

const chartConfig = {
  wheel: { label: "Wheel", color: "var(--chart-1)" },
  leaps: { label: "LEAPS", color: "var(--chart-2)" },
} satisfies ChartConfig

export function PremiumChart({ allOptions, initialYear }: PremiumChartProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const opt of allOptions) {
      years.add(new Date(opt.opened).getFullYear())
    }
    // Always include current year even if no data
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [allOptions])

  const [selectedYear, setSelectedYear] = useState(
    initialYear ?? availableYears[0] ?? new Date().getFullYear(),
  )

  const premiumByMonth = useMemo(
    () => buildPremiumByMonth(allOptions, selectedYear),
    [allOptions, selectedYear],
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monthly Premium</CardTitle>
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
