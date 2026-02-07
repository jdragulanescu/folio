"use client"

import { useMemo } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { OptionRecord } from "@/lib/types"

interface StatusBreakdownTableProps {
  options: OptionRecord[]
}

const STATUSES = ["Open", "Closed", "Expired", "Assigned", "Rolled"] as const

export function StatusBreakdownTable({ options }: StatusBreakdownTableProps) {
  const breakdown = useMemo(() => {
    const byYear = new Map<number, Map<string, number>>()

    for (const opt of options) {
      const year = new Date(opt.opened).getFullYear()
      if (!byYear.has(year)) {
        byYear.set(year, new Map<string, number>())
      }
      const yearMap = byYear.get(year)!
      yearMap.set(opt.status, (yearMap.get(opt.status) ?? 0) + 1)
    }

    const years = [...byYear.keys()].sort((a, b) => b - a)

    // Compute totals row
    const totals = new Map<string, number>()
    for (const [, yearMap] of byYear) {
      for (const [status, count] of yearMap) {
        totals.set(status, (totals.get(status) ?? 0) + count)
      }
    }

    return { years, byYear, totals }
  }, [options])

  if (breakdown.years.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 text-xs font-medium">Year</th>
                {STATUSES.map((s) => (
                  <th key={s} className="pb-2 text-right text-xs font-medium">
                    {s}
                  </th>
                ))}
                <th className="pb-2 text-right text-xs font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.years.map((year) => {
                const yearMap = breakdown.byYear.get(year)!
                const total = STATUSES.reduce(
                  (sum, s) => sum + (yearMap.get(s) ?? 0),
                  0,
                )
                return (
                  <tr key={year} className="border-b last:border-0">
                    <td className="py-2 font-medium">{year}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className="py-2 text-right tabular-nums">
                        {yearMap.get(s) ?? 0}
                      </td>
                    ))}
                    <td className="py-2 text-right tabular-nums font-medium">
                      {total}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="border-t-2 font-medium">
                <td className="py-2">Total</td>
                {STATUSES.map((s) => (
                  <td key={s} className="py-2 text-right tabular-nums">
                    {breakdown.totals.get(s) ?? 0}
                  </td>
                ))}
                <td className="py-2 text-right tabular-nums">
                  {STATUSES.reduce(
                    (sum, s) => sum + (breakdown.totals.get(s) ?? 0),
                    0,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
