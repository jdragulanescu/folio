"use client"

import { DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"
import type { OptionsStats } from "@/lib/options-shared"

interface OptionsStatCardsProps {
  stats: OptionsStats
}

export function OptionsStatCards({ stats }: OptionsStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Total Options P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Options P&L
          </CardTitle>
          <DollarSign className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold tabular-nums ${pnlClassName(stats.totalPnl)}`}>
            {formatCurrency(stats.totalPnl)}
          </div>
          <div className="text-muted-foreground mt-1 space-y-0.5 text-xs tabular-nums">
            <div className="flex justify-between">
              <span>Short</span>
              <span className={pnlClassName(stats.shortPnl)}>{formatCurrency(stats.shortPnl)}</span>
            </div>
            <div className="flex justify-between">
              <span>Long</span>
              <span className={pnlClassName(stats.longPnl)}>{formatCurrency(stats.longPnl)}</span>
            </div>
            <div className="flex justify-between">
              <span>Commission</span>
              <span className="text-loss">{formatCurrency(stats.totalCommission)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Short Options P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Short Options P&L
          </CardTitle>
          <TrendingUp className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold tabular-nums ${pnlClassName(stats.shortPnl)}`}>
            {formatCurrency(stats.shortPnl)}
          </div>
        </CardContent>
      </Card>

      {/* Long Options P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Long Options P&L
          </CardTitle>
          {stats.longPnl >= 0 ? (
            <TrendingUp className="text-gain size-4" />
          ) : (
            <TrendingDown className="text-loss size-4" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold tabular-nums ${pnlClassName(stats.longPnl)}`}>
            {formatCurrency(stats.longPnl)}
          </div>
        </CardContent>
      </Card>

      {/* Avg Days Held */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Days Held
          </CardTitle>
          <Clock className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {Math.round(stats.avgDaysHeld)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
