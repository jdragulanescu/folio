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

// Chart colour palette using CSS custom properties
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.15 250)",
  "oklch(0.65 0.18 330)",
  "oklch(0.70 0.14 110)",
  "oklch(0.60 0.20 50)",
  "oklch(0.50 0.12 200)",
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

/**
 * Group holdings by a field, merge small slices into "Other",
 * and produce chart data with colours.
 */
function buildChartData(
  holdings: DisplayHolding[],
  field: "sector" | "strategy",
): { data: SliceData[]; config: ChartConfig; totalValue: number } {
  // Aggregate market value by group
  const groups = new Map<string, number>()
  let totalValue = 0

  for (const h of holdings) {
    const key = h[field] ?? "Unassigned"
    groups.set(key, (groups.get(key) ?? 0) + h.marketValue)
    totalValue += h.marketValue
  }

  if (totalValue === 0) {
    return { data: [], config: {}, totalValue: 0 }
  }

  // Sort by value descending
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])

  // Merge small slices into "Other"
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

  // Build config and data
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
          <CardTitle>{title}</CardTitle>
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
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-[250px]"
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
              innerRadius={60}
              strokeWidth={5}
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
                          className="fill-foreground text-xl font-bold"
                        >
                          {center.primary}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 20}
                          className="fill-muted-foreground text-xs"
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
    <div className="grid grid-cols-1 gap-4">
      <AllocationDonut
        title="Sector Allocation"
        holdings={holdings}
        field="sector"
        centerLabel={(totalValue) => ({
          primary: formatCompact(totalValue),
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
    </div>
  )
}
