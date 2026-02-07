"use client"

import { useMemo, useState } from "react"
import { Label, Pie, PieChart } from "recharts"
import type { DisplayHolding } from "@/lib/portfolio"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"
import { Button } from "@/components/ui/button"
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
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.15 250)",
  "oklch(0.65 0.18 330)",
  "oklch(0.70 0.14 110)",
]

interface BrokerBreakdownProps {
  holdings: DisplayHolding[]
}

interface BrokerData {
  name: string
  key: string
  holdingsCount: number
  marketValue: number
  unrealisedPnl: number
  weightPct: number
}

export function BrokerBreakdown({ holdings }: BrokerBreakdownProps) {
  const [expanded, setExpanded] = useState(false)

  const { brokers, chartData, chartConfig } = useMemo(() => {
    const groups = new Map<
      string,
      { marketValue: number; unrealisedPnl: number; count: number }
    >()
    let total = 0

    for (const h of holdings) {
      const platform = h.platform ?? "Unknown"
      const existing = groups.get(platform) ?? {
        marketValue: 0,
        unrealisedPnl: 0,
        count: 0,
      }
      existing.marketValue += h.marketValue
      existing.unrealisedPnl += h.unrealisedPnl
      existing.count += 1
      groups.set(platform, existing)
      total += h.marketValue
    }

    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].marketValue - a[1].marketValue,
    )

    const brokerList: BrokerData[] = sorted.map(([name, data]) => ({
      name,
      key: name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      holdingsCount: data.count,
      marketValue: data.marketValue,
      unrealisedPnl: data.unrealisedPnl,
      weightPct: total !== 0 ? (data.marketValue / total) * 100 : 0,
    }))

    const config: ChartConfig = {}
    const chart: { name: string; value: number; fill: string }[] = []

    for (let i = 0; i < brokerList.length; i++) {
      const b = brokerList[i]
      const color = CHART_COLORS[i % CHART_COLORS.length]
      config[b.key] = { label: b.name, color }
      chart.push({ name: b.key, value: b.marketValue, fill: `var(--color-${b.key})` })
    }

    return {
      brokers: brokerList,
      chartData: chart,
      chartConfig: config,
    }
  }, [holdings])

  if (brokers.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Broker Breakdown</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Hide" : "View"}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Broker summary table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Broker</th>
                  <th className="pb-2 text-right font-medium">Holdings</th>
                  <th className="pb-2 text-right font-medium">Value</th>
                  <th className="pb-2 text-right font-medium">P&L</th>
                  <th className="pb-2 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.key} className="border-b last:border-0">
                    <td className="py-2 font-medium">{b.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {b.holdingsCount}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(b.marketValue)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${pnlClassName(b.unrealisedPnl)}`}
                    >
                      {formatCurrency(b.unrealisedPnl)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPercent(b.weightPct).replace("+", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Broker allocation donut chart */}
          {chartData.length > 0 && (
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[200px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
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
                              className="fill-foreground text-lg font-bold"
                            >
                              {brokers.length}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 18}
                              className="fill-muted-foreground text-xs"
                            >
                              {brokers.length === 1 ? "Broker" : "Brokers"}
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      )}
    </Card>
  )
}
