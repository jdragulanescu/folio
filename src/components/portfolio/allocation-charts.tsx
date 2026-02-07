"use client"

import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
import type { DisplayHolding } from "@/lib/portfolio"
import { formatCompact } from "@/lib/format"
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

const CHART_COLORS = [
  "oklch(0.65 0.19 250)",
  "oklch(0.62 0.17 162)",
  "oklch(0.68 0.18 80)",
  "oklch(0.58 0.20 330)",
  "oklch(0.60 0.15 200)",
  "oklch(0.70 0.14 110)",
  "oklch(0.55 0.16 280)",
  "oklch(0.63 0.20 50)",
  "oklch(0.50 0.12 220)",
  "oklch(0.66 0.13 140)",
]

const MIN_SLICE_PCT = 3

interface AllocationChartsProps {
  holdings: DisplayHolding[]
}

interface SliceData {
  name: string
  value: number
  fill: string
}

function buildChartData(
  holdings: DisplayHolding[],
  field: "sector" | "strategy",
): { data: SliceData[]; config: ChartConfig; totalValue: number } {
  const groups = new Map<string, number>()
  let totalValue = 0

  for (const h of holdings) {
    if (h.symbol === "CASH" || h.marketValue <= 0) continue
    const key = h[field] ?? "Unassigned"
    groups.set(key, (groups.get(key) ?? 0) + h.marketValue)
    totalValue += h.marketValue
  }

  if (totalValue === 0) {
    return { data: [], config: {}, totalValue: 0 }
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])

  const mainSlices: [string, number][] = []
  let otherValue = 0

  for (const [name, value] of sorted) {
    const pct = (value / totalValue) * 100
    if (pct < MIN_SLICE_PCT) {
      otherValue += value
    } else {
      mainSlices.push([name, value])
    }
  }

  if (otherValue > 0) {
    mainSlices.push(["Other", otherValue])
  }

  const config: ChartConfig = {}
  const data: SliceData[] = []

  for (let i = 0; i < mainSlices.length; i++) {
    const [name, value] = mainSlices[i]
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "_")
    const color = CHART_COLORS[i % CHART_COLORS.length]

    config[key] = { label: name, color }
    data.push({ name: key, value, fill: `var(--color-${key})` })
  }

  return { data, config, totalValue }
}

function AllocationDonut({
  title,
  holdings,
  field,
  centerLabel,
}: {
  title: string
  holdings: DisplayHolding[]
  field: "sector" | "strategy"
  centerLabel: (totalValue: number, groupCount: number) => {
    primary: string
    secondary: string
  }
}) {
  const { data, config, totalValue } = useMemo(
    () => buildChartData(holdings, field),
    [holdings, field],
  )

  const groupCount = data.length

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  const center = centerLabel(totalValue, groupCount)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="mx-auto h-[220px] w-full max-w-[220px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              strokeWidth={3}
              stroke="var(--color-card)"
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-lg font-bold"
                        >
                          {center.primary}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 18}
                          className="fill-muted-foreground text-[10px]"
                        >
                          {center.secondary}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function AllocationCharts({ holdings }: AllocationChartsProps) {
  return (
    <>
      <AllocationDonut
        title="Sector Allocation"
        holdings={holdings}
        field="sector"
        centerLabel={(totalValue) => ({
          primary: formatCompact(totalValue, "USD"),
          secondary: "Total Value",
        })}
      />
      <AllocationDonut
        title="Strategy Allocation"
        holdings={holdings}
        field="strategy"
        centerLabel={(_totalValue, groupCount) => ({
          primary: String(groupCount),
          secondary: groupCount === 1 ? "Strategy" : "Strategies",
        })}
      />
    </>
  )
}
