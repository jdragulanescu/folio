import { getPortfolioData } from "@/lib/portfolio"
import { formatCurrency, formatPercent, pnlClassName } from "@/lib/format"

export default async function PortfolioPage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground text-sm">
          Overview of your investment holdings and performance.
        </p>
      </div>

      {/* Summary Cards Section */}
      <section aria-label="Summary cards">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="bg-card text-card-foreground rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Portfolio Value
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(data.totals.totalMarketValue)}
            </p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Unrealised P&amp;L
            </p>
            <p
              className={`mt-1 text-xl font-bold ${pnlClassName(data.totals.totalUnrealisedPnl)}`}
            >
              {formatCurrency(data.totals.totalUnrealisedPnl)}
            </p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Day Change
            </p>
            <p
              className={`mt-1 text-xl font-bold ${pnlClassName(data.dayChange)}`}
            >
              {formatCurrency(data.dayChange)}{" "}
              <span className="text-sm font-normal">
                ({formatPercent(data.dayChangePct)})
              </span>
            </p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Total Deposited
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(data.totalDeposited)}
            </p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Options Premium
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(data.optionsPremium)}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Holdings Table -- spans 2/3 width on large screens */}
        <section
          aria-label="Holdings table"
          className="bg-card text-card-foreground rounded-lg border p-4 lg:col-span-2"
        >
          <h2 className="text-lg font-semibold">Holdings</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.holdings.length} active positions
          </p>
          {/* Placeholder: TanStack Table component (03-02) */}
          <div className="text-muted-foreground mt-4 rounded border border-dashed p-8 text-center text-sm">
            Holdings table with sort, filter, and column visibility will be
            built in plan 03-02.
          </div>
        </section>

        {/* Sidebar -- charts and movers */}
        <div className="space-y-6">
          {/* Allocation Charts */}
          <section
            aria-label="Allocation charts"
            className="bg-card text-card-foreground rounded-lg border p-4"
          >
            <h2 className="text-lg font-semibold">Allocation</h2>
            {/* Placeholder: Sector and strategy donut charts (03-03) */}
            <div className="text-muted-foreground mt-4 rounded border border-dashed p-8 text-center text-sm">
              Sector and strategy donut charts will be built in plan 03-03.
            </div>
          </section>

          {/* Top Movers */}
          <section
            aria-label="Top movers"
            className="bg-card text-card-foreground rounded-lg border p-4"
          >
            <h2 className="text-lg font-semibold">Top Movers</h2>
            {/* Placeholder: Top 5 gainers and losers (03-03) */}
            <div className="text-muted-foreground mt-4 rounded border border-dashed p-8 text-center text-sm">
              Top 5 gainers and losers will be built in plan 03-03.
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
