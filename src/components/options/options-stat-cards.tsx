"use client"

import { DollarSign, TrendingUp, Target, Clock } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, pnlClassName } from "@/lib/format"
import type { OptionsStats } from "@/lib/options"

interface OptionsStatCardsProps {
  stats: OptionsStats
}

export function OptionsStatCards({ stats }: OptionsStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Premium Collected */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Premium Collected
          </CardTitle>
          <DollarSign className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.totalPremiumCollected)}
          </div>
        </CardContent>
      </Card>

      {/* Capital Gains P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Capital Gains P&L
          </CardTitle>
          <TrendingUp className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${pnlClassName(stats.capitalGainsPnl)}`}
          >
            {formatCurrency(stats.capitalGainsPnl)}
          </div>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <Target className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.winRate.toFixed(2)}%
          </div>
        </CardContent>
      </Card>

      {/* Avg Days Held */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Days Held</CardTitle>
          <Clock className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(stats.avgDaysHeld)} days
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
