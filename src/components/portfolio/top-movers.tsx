"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { DisplayHolding } from "@/lib/portfolio"
import { formatPercent, formatCurrency, pnlClassName } from "@/lib/format"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

interface TopMoversProps {
  holdings: DisplayHolding[]
  forexRate: number
}

export function TopMovers({ holdings, forexRate }: TopMoversProps) {
  const [currency] = useCurrencyPreference()

  const fc = (value: number) => {
    const converted = currency === "GBP" ? value * forexRate : value
    return formatCurrency(converted, currency)
  }
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
          <CardTitle className="text-sm font-medium">Top Movers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Top Gainers */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <TrendingUp className="text-gain size-4" />
          <CardTitle className="text-sm font-medium">Top Gainers</CardTitle>
        </CardHeader>
        <CardContent>
          {gainers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gainers today</p>
          ) : (
            <div className="space-y-2.5">
              {gainers.map((h) => (
                <MoverRow key={h.symbol} holding={h} fc={fc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Losers */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <TrendingDown className="text-loss size-4" />
          <CardTitle className="text-sm font-medium">Top Losers</CardTitle>
        </CardHeader>
        <CardContent>
          {losers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No losers today</p>
          ) : (
            <div className="space-y-2.5">
              {losers.map((h) => (
                <MoverRow key={h.symbol} holding={h} fc={fc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function MoverRow({
  holding,
  fc,
}: {
  holding: DisplayHolding
  fc: (value: number) => string
}) {
  const changePct = holding.changePct ?? 0

  return (
    <div className="flex items-center justify-between">
      <div>
        <Link
          href={`/symbol/${holding.symbol}`}
          className="text-sm font-semibold hover:underline"
        >
          {holding.symbol}
        </Link>
        <p className="text-xs text-muted-foreground">
          {fc(holding.marketValue)}
        </p>
      </div>
      <span className={`font-mono text-sm tabular-nums ${pnlClassName(changePct)}`}>
        {formatPercent(changePct)}
      </span>
    </div>
  )
}
