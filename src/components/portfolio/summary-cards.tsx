"use client"

import type { PortfolioData } from "@/lib/portfolio"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CircleDollarSign,
} from "lucide-react"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"

interface SummaryCardsProps {
  data: PortfolioData
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const { totals, dayChange, dayChangePct, totalDeposited, optionsPremium } =
    data
  const [currency, setCurrency] = useCurrencyPreference()

  const fc = (value: number) => {
    const converted = currency === "GBP" ? value * data.forexRate : value
    return formatCurrency(converted, currency)
  }

  const unrealisedPnlPct =
    totals.totalCost !== 0
      ? (totals.totalUnrealisedPnl / totals.totalCost) * 100
      : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={currency === "USD" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setCurrency("USD")}
          >
            $ USD
          </Button>
          <Button
            variant={currency === "GBP" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setCurrency("GBP")}
          >
            £ GBP
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Card 1: Total Portfolio Value (hero) */}
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Portfolio Value
            </CardTitle>
            <DollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {fc(totals.totalMarketValue)}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Unrealised P&L */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Unrealised P&L
            </CardTitle>
            {totals.totalUnrealisedPnl >= 0 ? (
              <TrendingUp className="text-gain size-4" />
            ) : (
              <TrendingDown className="text-loss size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold tabular-nums ${pnlClassName(totals.totalUnrealisedPnl)}`}
            >
              {fc(totals.totalUnrealisedPnl)}
            </div>
            <p
              className={`mt-1 text-xs tabular-nums ${pnlClassName(unrealisedPnlPct)}`}
            >
              {formatPercent(unrealisedPnlPct)} of cost
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Day Change */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Day Change
            </CardTitle>
            {dayChange >= 0 ? (
              <TrendingUp className="text-gain size-4" />
            ) : (
              <TrendingDown className="text-loss size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold tabular-nums ${pnlClassName(dayChange)}`}
            >
              {fc(dayChange)}
            </div>
            <p className={`mt-1 text-xs tabular-nums ${pnlClassName(dayChangePct)}`}>
              {formatPercent(dayChangePct)} today
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Total Deposited */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Deposited
            </CardTitle>
            <Wallet className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">
              {fc(totalDeposited)}
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Options Premium Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Options Premium
            </CardTitle>
            <CircleDollarSign className="text-gain size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-gain">
              {fc(optionsPremium)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
