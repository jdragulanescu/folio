"use client"

import type { PortfolioData } from "@/lib/portfolio"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SummaryCardsProps {
  data: PortfolioData
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const { totals, dayChange, dayChangePct, totalDeposited, optionsPremium } =
    data

  const unrealisedPnlPct =
    totals.totalCost !== 0
      ? (totals.totalUnrealisedPnl / totals.totalCost) * 100
      : 0

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {/* Card 1: Total Portfolio Value (hero) */}
      <Card className="col-span-2 md:col-span-1">
        <CardHeader className="pb-2">
          <CardDescription>Total Portfolio Value</CardDescription>
          <CardTitle className="text-3xl font-bold">
            {formatCurrency(totals.totalMarketValue)}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Card 2: Unrealised P&L */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Unrealised P&L</CardDescription>
          <CardTitle
            className={`text-2xl ${pnlClassName(totals.totalUnrealisedPnl)}`}
          >
            {formatCurrency(totals.totalUnrealisedPnl)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-xs ${pnlClassName(unrealisedPnlPct)}`}
          >
            {formatPercent(unrealisedPnlPct)}
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Day Change */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Day Change</CardDescription>
          <CardTitle className={`text-2xl ${pnlClassName(dayChange)}`}>
            {formatCurrency(dayChange)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-xs ${pnlClassName(dayChangePct)}`}>
            {formatPercent(dayChangePct)}
          </p>
        </CardContent>
      </Card>

      {/* Card 4: Total Deposited */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Deposited</CardDescription>
          <CardTitle className="text-2xl">
            {formatCurrency(totalDeposited)}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Card 5: Options Premium Collected */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Options Premium Collected</CardDescription>
          <CardTitle className="text-2xl text-gain">
            {formatCurrency(optionsPremium)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
