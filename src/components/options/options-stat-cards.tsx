"use client"

import { DollarSign, TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, pnlClassName } from "@/lib/format"
import type { OptionsStats } from "@/lib/options-shared"

interface OptionsStatCardsProps {
  stats: OptionsStats
}

export function OptionsStatCards({ stats }: OptionsStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Premium Collected (short strategies only) */}
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

      {/* Capital Gains P&L (long strategies) */}
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
    </div>
  )
}
