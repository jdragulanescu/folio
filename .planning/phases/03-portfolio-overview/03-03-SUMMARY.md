---
phase: 03-portfolio-overview
plan: 03
subsystem: ui
tags: [recharts, shadcn, donut-charts, summary-cards, top-movers, broker-breakdown, portfolio-dashboard]

# Dependency graph
requires:
  - phase: 03-portfolio-overview
    plan: 01
    provides: "getPortfolioData(), DisplayHolding, PortfolioData types, format utilities, shadcn card/chart components"
  - phase: 03-portfolio-overview
    plan: 02
    provides: "HoldingsTable component with TanStack Table sort/filter/column visibility"
provides:
  - "SummaryCards component displaying 5 portfolio metrics (PORT-04)"
  - "AllocationCharts component with sector and strategy donut charts (PORT-05, PORT-06)"
  - "TopMovers component showing top 5 gainers and losers by day change % (PORT-09)"
  - "BrokerBreakdown component with per-broker table and allocation donut chart (PORT-10)"
  - "Final page.tsx wiring all Phase 3 components into responsive grid layout"
affects: [07-01, 08-01]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Client component donut charts with recharts PieChart/Pie/Label", "Small-slice grouping (< 3%) into 'Other' category", "Collapsible card pattern with useState toggle", "CSS custom property palette cycling for chart colours"]

key-files:
  created: ["src/components/portfolio/summary-cards.tsx", "src/components/portfolio/allocation-charts.tsx", "src/components/portfolio/top-movers.tsx", "src/components/portfolio/broker-breakdown.tsx"]
  modified: ["src/app/page.tsx"]

key-decisions:
  - "Small slices below 3% allocation merged into 'Other' for cleaner donut charts"
  - "Top movers use changePct (day change %) as primary metric -- most actionable daily information"
  - "Broker breakdown collapsed by default to reduce visual noise"
  - "Null sectors/strategies labelled 'Unassigned', null platforms labelled 'Unknown'"
  - "Options premium card always shows green (text-gain) as positive income metric"

patterns-established:
  - "Donut chart pattern: buildChartData aggregation -> ChartConfig generation -> PieChart with center Label"
  - "Collapsible card: useState toggle with Button variant='ghost' in CardHeader"
  - "MoverRow pattern: symbol link + market value context + coloured change percentage"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 3 Plan 3: Summary Cards, Allocation Charts, Top Movers, and Broker Breakdown Summary

**5 summary metric cards, sector/strategy donut charts with small-slice grouping, top 5 gainers/losers by day change, and collapsible per-broker breakdown with allocation donut**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T00:48:43Z
- **Completed:** 2026-02-07T00:53:59Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- Built SummaryCards component with 5 metric cards (total portfolio value as hero card, unrealised P&L with percentage, day change with percentage, total deposited, options premium collected) using shadcn Card anatomy with gain/loss colouring
- Created AllocationCharts with sector and strategy donut charts using recharts PieChart, featuring hover tooltips via ChartTooltip, center labels (total value for sector, strategy count for strategy), and automatic grouping of slices below 3% into "Other"
- Built TopMovers component showing top 5 gainers and top 5 losers sorted by day change percentage, with clickable symbol links to /symbol/{symbol} and market value context
- Created BrokerBreakdown as a collapsible card showing per-broker summary table (holdings count, market value, P&L, weight) and a broker allocation donut chart
- Rewrote page.tsx as the definitive final version importing and rendering all Phase 3 components: SummaryCards, HoldingsTable (from 03-02), AllocationCharts, TopMovers, BrokerBreakdown in a responsive grid layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create summary cards and allocation donut charts** - `d297403` (feat)
2. **Task 2: Create top movers, broker breakdown, and wire all components into page** - `85c13dc` (feat)

## Files Created/Modified

- `src/components/portfolio/summary-cards.tsx` - 5 metric cards with hero card, gain/loss colouring, responsive grid
- `src/components/portfolio/allocation-charts.tsx` - Sector and strategy donut charts with tooltips, center labels, small-slice grouping
- `src/components/portfolio/top-movers.tsx` - Top 5 gainers/losers by day change % with symbol links
- `src/components/portfolio/broker-breakdown.tsx` - Collapsible per-broker table and allocation donut chart
- `src/app/page.tsx` - Definitive final version with all Phase 3 components wired into responsive layout

## Decisions Made

- **Small-slice threshold:** Slices below 3% allocation are merged into "Other" for cleaner donut visualisation. Threshold chosen to prevent unreadable thin slices while preserving meaningful segments.
- **Top movers metric:** Day change percentage (changePct) used as primary sort metric for gainers/losers -- this is the most actionable daily information compared to absolute value change.
- **Broker breakdown default state:** Collapsed by default to reduce visual clutter on the main dashboard. Users click "View" to expand the table and chart.
- **Null handling:** Null sectors/strategies labelled "Unassigned", null platforms labelled "Unknown" -- clear descriptive names rather than showing "null".
- **Options premium colouring:** Always shown in green (text-gain) since premium collected is inherently a positive income metric regardless of amount.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 3 is fully complete -- all 3 plans (03-01, 03-02, 03-03) delivered
- Portfolio dashboard is fully functional with summary cards, holdings table, allocation charts, top movers, and broker breakdown
- Phase 7 (Performance Analytics) can build on this foundation, referencing the same data assembly layer and format utilities
- Phase 8 (Advanced Features) can extend the unified portfolio view by adding bought options to the holdings data

---
*Phase: 03-portfolio-overview*
*Completed: 2026-02-07*
