"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { OptionsPageData } from "@/lib/options"
import { OptionsStatCards } from "./options-stat-cards"
import { WheelTable } from "./wheel-table"
import { LeapsTable } from "./leaps-table"
import { AllOptionsTable } from "./all-options-table"
import { PremiumChart } from "./premium-chart"

interface OptionsDashboardProps {
  data: OptionsPageData
}

export function OptionsDashboard({ data }: OptionsDashboardProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Options</h1>

      {/* Stat cards ABOVE tabs -- always show overall totals */}
      <OptionsStatCards stats={data.stats} />

      {/* Tabs */}
      <Tabs defaultValue="wheel">
        <TabsList>
          <TabsTrigger value="wheel">Wheel</TabsTrigger>
          <TabsTrigger value="leaps">LEAPS</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="wheel" className="mt-4">
          <WheelTable
            options={data.options}
            symbolPrices={data.symbolPrices}
          />
        </TabsContent>

        <TabsContent value="leaps" className="mt-4">
          <LeapsTable
            options={data.options}
            symbolPrices={data.symbolPrices}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <AllOptionsTable options={data.options} />
        </TabsContent>
      </Tabs>

      {/* Premium Chart */}
      <PremiumChart allOptions={data.options} />
    </div>
  )
}
