---
phase: 03-portfolio-overview
plan: 02
subsystem: ui
tags: [tanstack-table, holdings, column-visibility, symbol-detail, nocodb, server-components]

# Dependency graph
requires:
  - phase: 03-portfolio-overview/01
    provides: "DisplayHolding, PortfolioData, getPortfolioData, formatCurrency, formatPercent, pnlClassName, shadcn table/badge/dropdown-menu"
provides:
  - "HoldingsTable component with TanStack Table sort, filter, column visibility"
  - "useColumnVisibility hook with localStorage persistence"
  - "Column definitions for 15 DisplayHolding fields"
  - "Symbol detail page at /symbol/[symbol] with position summary, fundamentals, transactions"
affects: [03-03, 04-01, 05-01]

# Tech tracking
tech-stack:
  added: []
  patterns: ["TanStack Table with sortable headers and null-bottom sorting", "localStorage-backed column visibility persistence", "Server Component detail page with parallel NocoDB fetching"]

key-files:
  created: ["src/components/portfolio/holdings-columns.tsx", "src/components/portfolio/holdings-table.tsx", "src/hooks/use-column-visibility.ts", "src/app/symbol/[symbol]/page.tsx"]
  modified: ["src/app/page.tsx"]

key-decisions:
  - "Default sort: weight descending (most impactful positions first)"
  - "6 core columns visible, 9 optional columns hidden by default"
  - "Null changePct sorted to bottom regardless of sort direction"
  - "Weight shows N/A on symbol detail page (requires full portfolio context)"
  - "ROE displayed as percentage (value * 100) since stored as decimal"

patterns-established:
  - "SortableHeader reusable component for DRY sortable column headers"
  - "nullBottomSort custom sorting function for nullable numeric columns"
  - "Column label mapping in table component for dropdown display"
  - "Server Component detail page with computeHolding for single-symbol recalculation"

# Metrics
duration: 7min
completed: 2026-02-07
---

# Phase 3 Plan 2: Holdings Table and Symbol Detail Page Summary

**TanStack Table holdings display with sortable columns, symbol search, localStorage column visibility, and server-rendered symbol detail page with position summary, fundamentals, and transaction history**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-07T00:47:21Z
- **Completed:** 2026-02-07T00:54:02Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Created TanStack Table holdings table with 15 sortable columns, symbol search filter, and column visibility dropdown
- Built localStorage-backed column visibility hook with 6 core columns visible by default and 9 toggle-able
- Defined column definitions with gain/loss colour coding, null-safe sorting, currency/percent formatting, and Badge components
- Created symbol detail page at `/symbol/[symbol]` with position summary card, fundamentals card, and transaction history table
- Wired HoldingsTable into the main portfolio page (integrated by parallel 03-03 agent in final page.tsx)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create column definitions and holdings table component** - `aa448f3` (feat)
2. **Task 2: Create symbol detail page and wire holdings table into page.tsx** - `749003e` (feat)

## Files Created/Modified
- `src/hooks/use-column-visibility.ts` - localStorage-backed column visibility persistence hook
- `src/components/portfolio/holdings-columns.tsx` - 15 column definitions with SortableHeader, pnlClassName, null-bottom sort
- `src/components/portfolio/holdings-table.tsx` - HoldingsTable component with TanStack Table, search, column dropdown, row click navigation
- `src/app/symbol/[symbol]/page.tsx` - Server Component detail page with parallel NocoDB fetch, computeHolding, fundamentals, transactions
- `src/app/page.tsx` - Integrated by 03-03 agent (HoldingsTable import and rendering already present)

## Decisions Made
- **Default sort order:** Weight descending -- shows most impactful positions first, matching common portfolio dashboard UX.
- **Core visible columns (6):** symbol, currentPrice, marketValue, unrealisedPnl, changePct, weight -- these provide the essential at-a-glance portfolio view.
- **Hidden columns (9):** name, shares, avgCost, totalCost, realisedPnl, unrealisedPnlPct, sector, strategy, platform -- available via column visibility toggle.
- **Null changePct sorting:** Custom `nullBottomSort` function pushes null values to the bottom regardless of ascending/descending, preventing nulls from cluttering the top.
- **Weight on symbol page:** Shows "N/A" because weight calculation requires full portfolio market value context, which a single-symbol page does not have.
- **ROE display:** Multiplied by 100 and shown as percentage since NocoDB stores it as a decimal (e.g., 0.15 = 15%).

## Deviations from Plan

### Parallel Execution Coordination

**1. [Expected] page.tsx modified by parallel 03-03 agent**
- **Found during:** Task 2
- **Issue:** Plan 03-03 executed in parallel and rewrote `page.tsx` with all components (SummaryCards, AllocationCharts, TopMovers, BrokerBreakdown) already including HoldingsTable.
- **Resolution:** Committed only the symbol detail page; the HoldingsTable integration was already present in 03-03's page.tsx rewrite.
- **Impact:** None -- the end result is exactly as planned, just via different commit history.

## Issues Encountered

- Lint warning about React Compiler incompatibility with TanStack Table's `useReactTable()` -- this is a known limitation (React Compiler cannot memoize TanStack Table's return values). Not actionable, will resolve when TanStack Table adds Compiler support.

## User Setup Required

None.

## Next Phase Readiness
- HoldingsTable renders with full sorting, filtering, and column visibility
- Symbol detail page provides drill-down from table row click
- All 15 column definitions available for future customisation
- Column visibility persistence ready for user preferences

---
*Phase: 03-portfolio-overview*
*Completed: 2026-02-07*
