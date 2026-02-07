---
phase: "04"
plan: "01"
subsystem: "data-layer"
tags: ["transactions", "options", "formatting", "server-actions", "pagination", "roll-chains"]
depends_on:
  requires: ["01-02", "02-03"]
  provides: ["transactions-data-assembly", "options-data-assembly", "format-utilities", "load-more-server-action"]
  affects: ["04-02", "04-03", "04-04", "05-01"]
tech_stack:
  added: ["date-fns@4.1.0", "react-day-picker@9.13.1"]
  patterns: ["server-side-pagination", "roll-chain-inference", "server-actions-for-infinite-scroll"]
key_files:
  created:
    - "src/lib/transactions.ts"
    - "src/lib/options.ts"
    - "src/actions/load-transactions.ts"
    - "src/components/ui/tabs.tsx"
    - "src/components/ui/select.tsx"
    - "src/components/ui/calendar.tsx"
    - "src/components/ui/popover.tsx"
    - "src/components/ui/toggle-group.tsx"
    - "src/components/ui/toggle.tsx"
  modified:
    - "src/lib/format.ts"
    - "package.json"
decisions:
  - id: "04-01-01"
    description: "formatCurrency defaults to USD (was GBP) since portfolio holds US stocks"
  - id: "04-01-02"
    description: "Roll chain matching uses call_put type + 5-day proximity heuristic"
  - id: "04-01-03"
    description: "Premium chart groups by opened date month (when premium was received/paid)"
  - id: "04-01-04"
    description: "LEAPS P&L computed from underlying stock intrinsic value, not option market price"
  - id: "04-01-05"
    description: "avgDaysHeld excludes options with null days_held for accuracy"
metrics:
  duration: "4min"
  completed: "2026-02-07"
---

# Phase 4 Plan 01: Dependencies, Data Assembly & Formatting Summary

Server-side data assembly layer with NocoDB-backed paginated transactions, options roll chain inference, LEAPS derived columns, stats computation, and shared formatting utilities.

## What Was Done

### Task 1: Install Dependencies and shadcn Components
- Installed `date-fns@4.1.0` and `react-day-picker@9.13.1` (npm packages)
- Installed shadcn components: tabs, select, calendar, popover, toggle-group (+ toggle as dependency)
- Skipped already-present packages: @tanstack/react-table, recharts
- Skipped already-present components: table, badge, card, chart

### Task 2: Create Data Assembly Layer
- **format.ts**: Added `formatDate`, `formatDateShort`, `daysToExpiry` functions using date-fns. Updated `formatCurrency` to accept USD/GBP parameter (default USD). Updated `formatCompact` to use USD.
- **transactions.ts**: Server-side paginated transaction fetching with NocoDB where clause builder. Supports symbol (like), platform (eq), type (eq), dateFrom/dateTo (4-part date syntax). Default sort by date descending. Page size: 50.
- **options.ts**: Full options data assembly including:
  - `inferRollChains()`: Groups by ticker, matches Rolled status with 5-day temporal proximity and same call_put type
  - `computeLeapsDisplay()`: Derives intrinsicValue, extrinsicValue, costBasis, currentPnl, daysToExpiry, valueLostPerMonth, premiumFeePct
  - `buildPremiumByMonth()`: Monthly premium chart data with Wheel/LEAPS split, zero-filled 12 months
  - `buildOptionsRows()`: TanStack Table-ready rows with sub-rows for roll chain legs
  - `computeStats()`: totalPremiumCollected, capitalGainsPnl, winRate, avgDaysHeld
  - `getOptionsPageData()`: Main entry point fetching options + symbols in parallel
- **load-transactions.ts**: Server Action with `"use server"` directive re-exporting `getTransactionsPage` for client-side infinite scroll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] formatCurrency default changed from GBP to USD**
- **Found during:** Task 2 (format.ts update)
- **Issue:** Phase 3 created format.ts with hardcoded GBP currency, but portfolio values are in USD (US stocks). Plan 04-01 specifies USD default.
- **Fix:** Changed default parameter from GBP to USD, updated formatCompact similarly
- **Files modified:** src/lib/format.ts

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | formatCurrency defaults to USD | Portfolio is primarily US stocks; USD is the common case |
| 2 | Roll chain: call_put match + 5-day proximity | Research recommended this heuristic; prevents cross-type matching |
| 3 | Premium chart uses opened date | Reflects when premium was received/paid (financially meaningful) |
| 4 | LEAPS P&L from intrinsic value | No free options pricing API; intrinsic value provides directional info |
| 5 | avgDaysHeld excludes null days_held | Prevents skewing the average with zero values for missing data |
| 6 | Map converted to Record for serialisation | Maps can't cross server/client boundary in Next.js |

## Verification Results

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- All 9 required shadcn components present in src/components/ui/
- All npm packages present in package.json
- transactions.ts imports from nocodb.ts correctly
- options.ts imports from nocodb.ts correctly
- load-transactions.ts has "use server" directive
- format.ts uses date-fns for date operations

## Next Phase Readiness

Plans 04-02 (transactions page UI), 04-03 (options page UI), and 04-04 (responsive/polish) can proceed. All data contracts, types, and Server Actions they depend on are now available.

**Key interfaces for downstream plans:**
- `TransactionsPage` and `TransactionFilters` for the transactions table
- `OptionsPageData`, `OptionsRow`, `LeapsDisplayRow` for the options dashboard
- `MonthlyPremium` for the premium bar chart
- `loadMoreTransactions` Server Action for infinite scroll
