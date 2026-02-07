"use client"

import { useMemo } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, pnlClassName } from "@/lib/format"
import {
  computeRealisedGainsByFiscalYear,
  toDisplay,
  type TransactionInput,
} from "@/lib/calculations"
import type { TransactionRecord } from "@/lib/types"

interface CapitalGainsTableProps {
  transactions: TransactionRecord[]
  forexRate: number
}

export function CapitalGainsTable({
  transactions,
  forexRate: _forexRate,
}: CapitalGainsTableProps) {
  const fiscalYears = useMemo(() => {
    // Group transactions by symbol
    const txBySymbol = new Map<string, TransactionInput[]>()
    for (const tx of transactions) {
      const existing = txBySymbol.get(tx.symbol) ?? []
      existing.push({
        type: tx.type,
        shares: tx.shares,
        price: tx.price,
        amount: tx.amount,
        date: tx.date,
      })
      txBySymbol.set(tx.symbol, existing)
    }

    // Compute realised gains by fiscal year
    const gains = computeRealisedGainsByFiscalYear(txBySymbol)

    return gains.map((g) => ({
      fiscalYear: g.fiscalYear,
      sellCount: g.sellCount,
      totalProceeds: toDisplay(g.totalProceeds),
      totalCostBasis: toDisplay(g.totalCostBasis),
      realisedPnl: toDisplay(g.realisedPnl),
    }))
  }, [transactions])

  if (fiscalYears.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Capital Gains by Fiscal Year
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
                  Proceeds
                </th>
                <th className="pb-2 text-right text-xs font-medium">
                  Cost Basis
                </th>
                <th className="pb-2 text-right text-xs font-medium">
                  Realised P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {fiscalYears.map((fy) => (
                <tr key={fy.fiscalYear} className="border-b last:border-0">
                  <td className="py-2 font-medium">{fy.fiscalYear}</td>
                  <td className="py-2 text-right tabular-nums">
                    {fy.sellCount}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(fy.totalProceeds)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(fy.totalCostBasis)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${pnlClassName(fy.realisedPnl)}`}
                  >
                    {formatCurrency(fy.realisedPnl)}
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
