---
id: "003"
title: "Fix portfolio calculations, currency selector, and tests"
type: quick
completed: 2026-02-07
duration: 8min
tasks_completed: 8/8
subsystem: portfolio
tags: [currency, calculations, Big.js, Section-104, fiscal-year, testing]
tech-stack:
  patterns:
    - "Currency conversion via fc() helper pattern (convert + format)"
    - "Column factory function pattern for currency-aware table columns"
    - "useSyncExternalStore hook for currency preference persistence"
key-files:
  modified:
    - src/lib/portfolio.ts
    - src/lib/calculations.ts
    - src/lib/format.ts
    - src/app/page.tsx
    - src/components/portfolio/broker-breakdown.tsx
    - src/components/portfolio/capital-gains-table.tsx
    - src/components/portfolio/summary-cards.tsx
    - src/components/portfolio/holdings-table.tsx
    - src/components/portfolio/holdings-columns.tsx
    - src/components/portfolio/allocation-charts.tsx
    - src/components/portfolio/top-movers.tsx
  created:
    - src/lib/__tests__/format.test.ts
decisions:
  - "US brokers (IBKR, Robinhood) have USD deposits; all others treated as GBP"
  - "Currency toggle placed above summary cards, persisted in localStorage"
  - "holdings-columns converted from static array to getColumns() factory"
  - "fc() helper pattern used across all currency-displaying components"
  - "Capital gains computed via Section 104 pool per-symbol then aggregated by fiscal year"
---

# Quick Task 003: Fix portfolio calculations, currency selector, and tests

Fixed 6 portfolio dashboard issues: wrong cash balance (GBP/USD mixing), zero-share stocks showing, broker toggle removal, fiscal year capital gains with real P&L, USD/GBP currency selector, and comprehensive test coverage.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 6d82467 | fix(003): fix cash balance currency mixing and zero-share filtering |
| 2 | 75d7511 | fix(003): remove broker breakdown toggle -- always show content |
| 3 | 2a7fa2c | feat(003): fix capital gains table to show real P&L per fiscal year |
| 4 | bb0966f | feat(003): add currency selector and wire formatCurrency across all components |
| 5 | 75feb2b | test(003): add tests for getFiscalYear and computeRealisedGainsByFiscalYear |
| 6 | ad7bb43 | test(003): add tests for format utilities and currency conversion |

## What Changed

### 1. Cash Balance Currency Fix
GBP deposits from UK brokers (Trading 212, Freetrade, Stake, eToro) are now converted to USD using the stored forex rate before summing with USD deposits. The `usd_gbp_rate` is fetched from the NocoDB settings table in parallel with other data. The same conversion applies to `totalDeposited`.

### 2. Zero-Share Filtering
Changed `shares.gt(0)` to `shares.gte(new Big("0.0001"))` to filter out near-zero fractional positions that result from floating-point arithmetic in broker data.

### 3. Broker Breakdown Always Visible
Removed the expand/collapse toggle (useState, Button, CardAction). The card now always renders its table and pie chart.

### 4. Capital Gains with Real P&L
Added `getFiscalYear()` and `computeRealisedGainsByFiscalYear()` to calculations.ts. The function runs the Section 104 pool algorithm per symbol and records per-sale proceeds, cost basis, and P&L grouped by UK fiscal year (6 Apr - 5 Apr). The capital gains table now shows 5 columns: Fiscal Year, Sales, Proceeds, Cost Basis, Realised P&L.

### 5. Currency Selector
Wired the existing (previously unused) `useCurrencyPreference` hook to all portfolio components. A USD/GBP toggle appears above the summary cards. All currency values across the dashboard convert when toggled. Key implementation:
- `convertCurrency()` and `formatCompact(value, currency)` added to format.ts
- `getColumns(currency, forexRate)` factory replaces static `columns` array in holdings-columns.tsx
- Each component uses a local `fc()` helper that converts USD to GBP when needed

### 6. Test Coverage
Added 25 new test cases across 2 test files:
- **calculations.test.ts**: 5 tests for getFiscalYear (April boundary, year edges), 5 tests for computeRealisedGainsByFiscalYear (single/multi symbol, cross-FY, empty)
- **format.test.ts** (new): 5 formatCurrency, 2 formatCompact, 4 convertCurrency, 4 formatShares

## Verification Results

- `pnpm tsc --noEmit`: zero type errors
- `pnpm vitest run`: 112 tests pass (3 test files)
- `pnpm lint`: zero errors (4 pre-existing warnings from TanStack Table)

## Deviations from Plan

### Task 5 merged into Task 3
The page.tsx update to remove `holdings` prop from CapitalGainsTable was done during Task 3 to keep typecheck passing. No separate commit was needed.
