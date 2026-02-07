---
phase: 03-portfolio-overview
plan: 01
subsystem: ui
tags: [tanstack-table, recharts, shadcn, server-components, big.js, nocodb, portfolio]

# Dependency graph
requires:
  - phase: 02-live-pricing-core-calculations
    provides: "computePortfolio, toDisplay, SymbolInput, TransactionInput from calculations.ts; NocoDB client with getAllRecords, fetchParallel"
provides:
  - "getPortfolioData() -- server-side data assembly returning serialisable PortfolioData"
  - "DisplayHolding and PortfolioData types for all Phase 3 client components"
  - "formatCurrency, formatPercent, formatNumber, formatCompact, pnlClassName utilities"
  - "Portfolio page shell with grid layout and placeholder sections"
  - "shadcn table, card, chart, badge, dropdown-menu components"
  - "@tanstack/react-table and recharts npm packages"
affects: [03-02, 03-03, 04-01, 05-01, 07-01]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-table 8.21.3", "recharts 3.7.0", "shadcn table", "shadcn card", "shadcn chart", "shadcn badge", "shadcn dropdown-menu"]
  patterns: ["Server-side data assembly with Big.js serialisation boundary", "Parallel NocoDB fetch via fetchParallel", "Centralised format utilities shared across server/client"]

key-files:
  created: ["src/lib/portfolio.ts", "src/lib/format.ts", "src/components/ui/table.tsx", "src/components/ui/card.tsx", "src/components/ui/chart.tsx", "src/components/ui/badge.tsx", "src/components/ui/dropdown-menu.tsx"]
  modified: ["src/app/page.tsx", "package.json"]

key-decisions:
  - "getPrimaryPlatform uses net share tally (buys - sells) per platform to determine broker"
  - "unrealisedPnlPct computed as (unrealisedPnl / totalCost) * 100 with division-by-zero guard"
  - "dayChange computed per-holding as marketValue * (changePct / 100), then summed"
  - "shares exported with 6 decimal places to preserve fractional share accuracy"

patterns-established:
  - "Server data assembly: fetch raw records -> computePortfolio -> toDisplay -> serialisable interface"
  - "Format utilities: shared module without server-only guard for client component reuse"
  - "Page shell pattern: async Server Component calls data function, renders layout with placeholder sections"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 3 Plan 1: Dependencies, Data Assembly, and Page Shell Summary

**Server-side portfolio data assembly with Big.js serialisation boundary, format utilities, and page shell rendering 5 summary cards from live NocoDB data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T00:40:18Z
- **Completed:** 2026-02-07T00:43:35Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Installed all Phase 3 npm dependencies (@tanstack/react-table, recharts) and 5 shadcn components (table, card, chart, badge, dropdown-menu)
- Created `getPortfolioData()` server-side data assembly that fetches 4 NocoDB tables in parallel, computes holdings via Big.js calculation engine, and converts to serialisable plain-number types
- Built centralised format utilities (formatCurrency, formatPercent, formatNumber, formatCompact, pnlClassName) shared across server and client components
- Replaced placeholder page with async Server Component rendering portfolio value, P&L, day change, deposits, and options premium in summary cards with full layout grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and shadcn components** - `1731ecf` (chore)
2. **Task 2: Create formatting utilities and server-side data assembly** - `dd97e09` (feat)
3. **Task 3: Build portfolio page shell with layout structure** - `f10b7b7` (feat)

## Files Created/Modified
- `src/lib/portfolio.ts` - Server-side data assembly with getPortfolioData(), DisplayHolding, PortfolioData types
- `src/lib/format.ts` - Centralised financial formatting utilities (currency, percent, number, compact, pnlClassName)
- `src/app/page.tsx` - Async Server Component page shell with summary cards and grid layout
- `src/components/ui/table.tsx` - shadcn table component for holdings table (03-02)
- `src/components/ui/card.tsx` - shadcn card component for summary cards (03-03)
- `src/components/ui/chart.tsx` - shadcn chart component with recharts integration (03-03)
- `src/components/ui/badge.tsx` - shadcn badge component for status indicators
- `src/components/ui/dropdown-menu.tsx` - shadcn dropdown menu for column visibility (03-02)
- `package.json` - Added @tanstack/react-table and recharts dependencies

## Decisions Made
- **Primary platform detection:** Net share tally per platform (buys minus sells) determines the primary broker for each holding. Handles null platforms gracefully by skipping them in the tally.
- **Shares precision:** Exported with 6 decimal places via `toDisplay(h.shares, 6)` to preserve fractional share accuracy from brokers like Trading 212.
- **Day change calculation:** Per-holding `marketValue * (changePct / 100)` summed to portfolio level, with null changePct treated as 0.
- **Unrealised P&L %:** Computed as `(unrealisedPnl / totalCost) * 100` with division-by-zero guard returning 0.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getPortfolioData()` returns fully typed `PortfolioData` ready for client components
- `DisplayHolding[]` array ready for TanStack Table in plan 03-02
- Summary cards layout in place, ready for shadcn Card conversion in plan 03-03
- Sidebar grid sections ready for allocation charts and top movers in plan 03-03
- Format utilities available for all display components

---
*Phase: 03-portfolio-overview*
*Completed: 2026-02-07*
