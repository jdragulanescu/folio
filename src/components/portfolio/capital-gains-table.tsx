"use client"

import { useMemo } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, pnlClassName } from "@/lib/format"
import type { DisplayHolding } from "@/lib/portfolio"
import type { TransactionRecord } from "@/lib/types"

interface CapitalGainsTableProps {
  holdings: DisplayHolding[]
  transactions: TransactionRecord[]
}

/**
 * Get the UK fiscal year label for a given date.
 * UK fiscal year runs 6 Apr to 5 Apr.
 * e.g. 10 Jan 2025 → "2024/25", 10 May 2025 → "2025/26"
 */
function getFiscalYear(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() // 0-indexed
  const day = d.getDate()
  const year = d.getFullYear()

  // Before 6 April → previous fiscal year
  if (month < 3 || (month === 3 && day <= 5)) {
    return `${year - 1}/${String(year).slice(2)}`
  }
  return `${year}/${String(year + 1).slice(2)}`
}

export function CapitalGainsTable({
  transactions,
}: CapitalGainsTableProps) {
  const fiscalYears = useMemo(() => {
    // Group sell transactions by fiscal year
    const sellTxs = transactions.filter((tx) => tx.type === "Sell")

    const byFy = new Map<string, { sellCount: number; totalAmount: number }>()
    for (const tx of sellTxs) {
      const fy = getFiscalYear(tx.date)
      const existing = byFy.get(fy) ?? { sellCount: 0, totalAmount: 0 }
      existing.sellCount += 1
      existing.totalAmount += tx.amount
      byFy.set(fy, existing)
    }

    return [...byFy.entries()]
      .map(([year, data]) => ({
        year,
        sellCount: data.sellCount,
        totalProceeds: data.totalAmount,
      }))
      .sort((a, b) => b.year.localeCompare(a.year))
  }, [transactions])

  if (fiscalYears.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Sales by Fiscal Year
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 text-xs font-medium">Fiscal Year</th>
                <th className="pb-2 text-right text-xs font-medium">Sales</th>
                <th className="pb-2 text-right text-xs font-medium">
                  Total Proceeds
                </th>
              </tr>
            </thead>
            <tbody>
              {fiscalYears.map((fy) => (
                <tr key={fy.year} className="border-b last:border-0">
                  <td className="py-2 font-medium">{fy.year}</td>
                  <td className="py-2 text-right tabular-nums">
                    {fy.sellCount}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${pnlClassName(fy.totalProceeds)}`}>
                    {formatCurrency(fy.totalProceeds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
