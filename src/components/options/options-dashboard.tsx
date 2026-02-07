"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { OptionsPageData } from "@/lib/options-shared"
import { OptionsStatCards } from "./options-stat-cards"
import { ShortOptionsTable } from "./wheel-table"
import { LongOptionsTable } from "./leaps-table"
import { AllOptionsTable } from "./all-options-table"
import { PremiumChart } from "./premium-chart"
import { YearlyStatsTable } from "./yearly-stats-table"
import { StatusBreakdownTable } from "./status-breakdown-table"

interface OptionsDashboardProps {
  data: OptionsPageData
}

export function OptionsDashboard({ data }: OptionsDashboardProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Options</h1>

      {/* Stat cards ABOVE tabs */}
      <OptionsStatCards stats={data.stats} />

      {/* Tabs */}
      <Tabs defaultValue="short">
        <TabsList>
          <TabsTrigger value="short">Short</TabsTrigger>
          <TabsTrigger value="long">Long</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="short" className="mt-4">
          <ShortOptionsTable
            options={data.options}
            symbolPrices={data.symbolPrices}
          />
        </TabsContent>

        <TabsContent value="long" className="mt-4">
          <LongOptionsTable
            options={data.options}
            symbolPrices={data.symbolPrices}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <AllOptionsTable options={data.options} />
        </TabsContent>
      </Tabs>

      {/* Charts & Summary Tables */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PremiumChart allOptions={data.options} />
        <YearlyStatsTable options={data.options} />
      </div>

      <StatusBreakdownTable options={data.options} />
    </div>
  )
}
