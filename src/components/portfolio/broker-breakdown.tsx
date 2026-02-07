"use client"

import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
import type { DisplayHolding } from "@/lib/portfolio"
import type { OptionRecord } from "@/lib/types"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"
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
]

interface BrokerBreakdownProps {
  holdings: DisplayHolding[]
  options?: OptionRecord[]
}

interface BrokerData {
  name: string
  key: string
  holdingsCount: number
  optionsCount: number
  marketValue: number
  unrealisedPnl: number
  weightPct: number
}

export function BrokerBreakdown({ holdings, options = [] }: BrokerBreakdownProps) {
  const { brokers, chartData, chartConfig } = useMemo(() => {
    const groups = new Map<
      string,
      { marketValue: number; unrealisedPnl: number; count: number; optionsCount: number }
    >()
    let total = 0

    for (const h of holdings) {
      if (h.symbol === "CASH") continue
      const platform = h.platform ?? "Unknown"
      const existing = groups.get(platform) ?? {
        marketValue: 0,
        unrealisedPnl: 0,
        count: 0,
        optionsCount: 0,
      }
      existing.marketValue += h.marketValue
      existing.unrealisedPnl += h.unrealisedPnl
      existing.count += 1
      groups.set(platform, existing)
      total += h.marketValue
    }

    // Add options to broker aggregation
    for (const o of options) {
      const platform = o.platform ?? "IBKR"
      const existing = groups.get(platform) ?? {
        marketValue: 0,
        unrealisedPnl: 0,
        count: 0,
        optionsCount: 0,
      }
      existing.optionsCount += 1
      // Don't add to marketValue again (open long options already in holdings)
      groups.set(platform, existing)
    }

    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].marketValue - a[1].marketValue,
    )

    const brokerList: BrokerData[] = sorted.map(([name, data]) => ({
      name,
      key: name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      holdingsCount: data.count,
      optionsCount: data.optionsCount,
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
  }, [holdings, options])

  if (brokers.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Broker Breakdown</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 text-xs font-medium">Broker</th>
                  <th className="pb-2 text-right text-xs font-medium">Holdings</th>
                  <th className="pb-2 text-right text-xs font-medium">Options</th>
                  <th className="pb-2 text-right text-xs font-medium">Value</th>
                  <th className="pb-2 text-right text-xs font-medium">P&L</th>
                  <th className="pb-2 text-right text-xs font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.key} className="border-b last:border-0">
                    <td className="py-2 text-sm font-medium">{b.name}</td>
                    <td className="py-2 text-right tabular-nums text-sm">
                      {b.holdingsCount}
                    </td>
                    <td className="py-2 text-right tabular-nums text-sm">
                      {b.optionsCount}
                    </td>
                    <td className="py-2 text-right tabular-nums text-sm">
                      {formatCurrency(b.marketValue)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums text-sm ${pnlClassName(b.unrealisedPnl)}`}
                    >
                      {formatCurrency(b.unrealisedPnl)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-sm">
                      {formatPercent(b.weightPct).replace("+", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chartData.length > 0 && (
            <div>
              <ChartContainer
                config={chartConfig}
                className="mx-auto h-[180px] w-full max-w-[180px]"
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
                    innerRadius={45}
                    outerRadius={70}
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
                                className="fill-foreground text-base font-bold"
                              >
                                {brokers.length}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 16}
                                className="fill-muted-foreground text-[10px]"
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
            </div>
          )}
        </CardContent>
    </Card>
  )
}
