"use client"

import { useMemo } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, pnlClassName } from "@/lib/format"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import {
  computeRealisedGainsByFiscalYear,
  toDisplay,
  type TransactionInput,
} from "@/lib/calculations"
import type { TransactionRecord, OptionRecord } from "@/lib/types"

interface CapitalGainsTableProps {
  transactions: TransactionRecord[]
  options: OptionRecord[]
  forexRate: number
}

export function CapitalGainsTable({
  transactions,
  options,
  forexRate,
}: CapitalGainsTableProps) {
  const [currency] = useCurrencyPreference()

  const fc = (value: number) => {
    const converted = currency === "GBP" ? value * forexRate : value
    return formatCurrency(converted, currency)
  }
  const fiscalYears = useMemo(() => {
    // Group transactions by symbol
    const txBySymbol = new Map<string, TransactionInput[]>()
    for (const tx of transactions) {
      const existing = txBySymbol.get(tx.symbol) ?? []
      existing.push({
        type: tx.type,
        shares: tx.shares,
        price: tx.price,
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

  const totals = useMemo(() => {
    return {
      sellCount: fiscalYears.reduce((sum, fy) => sum + fy.sellCount, 0),
      totalProceeds: fiscalYears.reduce((sum, fy) => sum + fy.totalProceeds, 0),
      totalCostBasis: fiscalYears.reduce(
        (sum, fy) => sum + fy.totalCostBasis,
        0,
      ),
      realisedPnl: fiscalYears.reduce((sum, fy) => sum + fy.realisedPnl, 0),
    }
  }, [fiscalYears])

  const totalCommission = useMemo(() => {
    return options
      .filter((o) => o.commission != null)
      .reduce((sum, o) => sum + o.commission! * o.qty, 0)
  }, [options])

  if (fiscalYears.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Capital Gains</CardTitle>
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
                    {fc(fy.totalProceeds)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {fc(fy.totalCostBasis)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${pnlClassName(fy.realisedPnl)}`}
                  >
                    {fc(fy.realisedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right tabular-nums">
                  {totals.sellCount}
                </td>
                <td className="pt-2 text-right tabular-nums">
                  {fc(totals.totalProceeds)}
                </td>
                <td className="pt-2 text-right tabular-nums">
                  {fc(totals.totalCostBasis)}
                </td>
                <td
                  className={`pt-2 text-right tabular-nums ${pnlClassName(totals.realisedPnl)}`}
                >
                  {fc(totals.realisedPnl)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {totalCommission !== 0 && (
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Total Options Commission
            </span>
            <span className="tabular-nums font-medium text-loss">
              {fc(Math.abs(totalCommission))}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
