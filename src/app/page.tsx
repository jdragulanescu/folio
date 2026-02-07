import { getPortfolioData } from "@/lib/portfolio"
import { HoldingsTable } from "@/components/portfolio/holdings-table"
import { SummaryCards } from "@/components/portfolio/summary-cards"
import { AllocationCharts } from "@/components/portfolio/allocation-charts"
import { TopMovers } from "@/components/portfolio/top-movers"
import { BrokerBreakdown } from "@/components/portfolio/broker-breakdown"
import { WeightBarChart } from "@/components/portfolio/weight-bar-chart"
import { CostWeightChart } from "@/components/portfolio/cost-weight-chart"
import { EpsYieldChart } from "@/components/portfolio/eps-yield-chart"

export default async function PortfolioPage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6">
      {/* Summary cards - full width */}
      <SummaryCards data={data} />

      {/* Holdings table - full width */}
      <HoldingsTable holdings={data.holdings} />

      {/* Charts grid - responsive 2-col or 3-col */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <WeightBarChart holdings={data.holdings} />
        <AllocationCharts holdings={data.holdings} />
        <CostWeightChart holdings={data.holdings} />
        <EpsYieldChart holdings={data.holdings} />
        <TopMovers holdings={data.holdings} />
        <BrokerBreakdown holdings={data.holdings} />
      </div>
    </div>
  )
}
