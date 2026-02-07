"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { DisplayHolding } from "@/lib/portfolio"
import { formatPercent, formatCurrency, pnlClassName } from "@/lib/format"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface TopMoversProps {
  holdings: DisplayHolding[]
}

export function TopMovers({ holdings }: TopMoversProps) {
  const { gainers, losers } = useMemo(() => {
    const withChange = holdings.filter((h) => h.changePct != null)

    const sorted = [...withChange].sort(
      (a, b) => (b.changePct ?? 0) - (a.changePct ?? 0),
    )

    return {
      gainers: sorted.filter((h) => (h.changePct ?? 0) > 0).slice(0, 5),
      losers: sorted
        .filter((h) => (h.changePct ?? 0) < 0)
        .reverse()
        .slice(0, 5),
    }
  }, [holdings])

  const hasData = gainers.length > 0 || losers.length > 0

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Movers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Top Gainers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gain">Top Gainers</CardTitle>
        </CardHeader>
        <CardContent>
          {gainers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gainers today</p>
          ) : (
            <div className="space-y-3">
              {gainers.map((h) => (
                <MoverRow key={h.symbol} holding={h} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Losers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-loss">Top Losers</CardTitle>
        </CardHeader>
        <CardContent>
          {losers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No losers today</p>
          ) : (
            <div className="space-y-3">
              {losers.map((h) => (
                <MoverRow key={h.symbol} holding={h} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MoverRow({ holding }: { holding: DisplayHolding }) {
  const changePct = holding.changePct ?? 0

  return (
    <div className="flex items-center justify-between">
      <div>
        <Link
          href={`/symbol/${holding.symbol}`}
          className="font-semibold hover:underline"
        >
          {holding.symbol}
        </Link>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(holding.marketValue)}
        </p>
      </div>
      <span className={`font-mono text-sm font-medium ${pnlClassName(changePct)}`}>
        {formatPercent(changePct)}
      </span>
    </div>
  )
}
