"use client"

import { useMemo } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format"
import { isShortStrategy, computeProfit, computeDaysHeld, computeReturnPct, computeCollateral } from "@/lib/options-shared"
import type { OptionRecord } from "@/lib/types"

interface YearlyStatsTableProps {
  options: OptionRecord[]
}

interface YearlyStats {
  year: number
  avgProfitYield: number
  avgDaysHeld: number
  avgReturn: number
  avgCollateral: number
  avgIv: number
  avgDelta: number
  totalProfit: number
  count: number
}

const CLOSED_STATUSES: OptionRecord["status"][] = ["Closed", "Expired", "Assigned", "Rolled"]

export function YearlyStatsTable({ options }: YearlyStatsTableProps) {
  const yearlyStats = useMemo(() => {
    const closedShort = options.filter(
      (o) => isShortStrategy(o.strategy_type) && CLOSED_STATUSES.includes(o.status),
    )

    const byYear = new Map<number, OptionRecord[]>()
    for (const opt of closedShort) {
      const year = new Date(opt.opened).getFullYear()
      const group = byYear.get(year) ?? []
      group.push(opt)
      byYear.set(year, group)
    }

    const stats: YearlyStats[] = []
    for (const [year, opts] of byYear) {
      const count = opts.length

      const profitYields = opts
        .filter((o) => {
          const coll = computeCollateral(o)
          return coll != null && coll > 0 && computeProfit(o) != null
        })
        .map((o) => (computeProfit(o)! / computeCollateral(o)!) * 100)
      const avgProfitYield =
        profitYields.length > 0
          ? profitYields.reduce((a, b) => a + b, 0) / profitYields.length
          : 0

      const daysArr = opts.filter((o) => o.close_date != null).map((o) => computeDaysHeld(o))
      const avgDaysHeld =
        daysArr.length > 0 ? daysArr.reduce((a, b) => a + b, 0) / daysArr.length : 0

      const returns = opts.map((o) => computeReturnPct(o)).filter((v): v is number => v != null)
      const avgReturn =
        returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0

      const collaterals = opts.map((o) => computeCollateral(o)).filter((v): v is number => v != null)
      const avgCollateral =
        collaterals.length > 0 ? collaterals.reduce((a, b) => a + b, 0) / collaterals.length : 0

      const ivs = opts.filter((o) => o.iv_pct != null).map((o) => o.iv_pct!)
      const avgIv = ivs.length > 0 ? ivs.reduce((a, b) => a + b, 0) / ivs.length : 0

      const deltas = opts.filter((o) => o.delta != null).map((o) => o.delta!)
      const avgDelta =
        deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0

      const totalProfit = opts.reduce((sum, o) => sum + (computeProfit(o) ?? 0), 0)

      stats.push({
        year,
        avgProfitYield,
        avgDaysHeld,
        avgReturn,
        avgCollateral,
        avgIv,
        avgDelta,
        totalProfit,
        count,
      })
    }

    return stats.sort((a, b) => b.year - a.year)
  }, [options])

  if (yearlyStats.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Yearly Short Options Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 text-xs font-medium">Year</th>
                <th className="pb-2 text-right text-xs font-medium">Profit Yield</th>
                <th className="pb-2 text-right text-xs font-medium">Days Held</th>
                <th className="pb-2 text-right text-xs font-medium">Ann. Return</th>
                <th className="pb-2 text-right text-xs font-medium">Collateral</th>
                <th className="pb-2 text-right text-xs font-medium">IV%</th>
                <th className="pb-2 text-right text-xs font-medium">Delta</th>
                <th className="pb-2 text-right text-xs font-medium">Total Profit</th>
              </tr>
            </thead>
            <tbody>
              {yearlyStats.map((s) => (
                <tr key={s.year} className="border-b last:border-0">
                  <td className="py-2 font-medium">{s.year}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(s.avgProfitYield)}</td>
                  <td className="py-2 text-right tabular-nums">{Math.round(s.avgDaysHeld)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(s.avgReturn)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.avgCollateral)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(s.avgIv * 100)}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(s.avgDelta, 3)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.totalProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
