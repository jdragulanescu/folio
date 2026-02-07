import { getPortfolioData } from "@/lib/portfolio"
import { HoldingsTable } from "@/components/portfolio/holdings-table"
import { SummaryCards } from "@/components/portfolio/summary-cards"
import { AllocationCharts } from "@/components/portfolio/allocation-charts"
import { TopMovers } from "@/components/portfolio/top-movers"
import { BrokerBreakdown } from "@/components/portfolio/broker-breakdown"

export default async function PortfolioPage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6">
      {/* Summary cards - full width */}
      <SummaryCards data={data} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Holdings table and broker breakdown (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <HoldingsTable holdings={data.holdings} />
          <BrokerBreakdown holdings={data.holdings} />
        </div>

        {/* Right: Charts and movers (1/3 width) */}
        <div className="space-y-6">
          <AllocationCharts holdings={data.holdings} />
          <TopMovers holdings={data.holdings} />
        </div>
      </div>
    </div>
  )
}
