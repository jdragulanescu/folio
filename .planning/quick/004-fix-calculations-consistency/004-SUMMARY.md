---
phase: quick-004
plan: 01
subsystem: calculations
tags: [big.js, math-abs, section-104, capital-gains, options-pnl, currency-conversion]

# Dependency graph
requires:
  - phase: quick-003
    provides: "Capital gains table, currency selector, calculations engine"
provides:
  - "Correct cash balance (positive, not negative)"
  - "Correct realised P&L for sells with negative spreadsheet amounts"
  - "Consistent GBP-to-USD deposit conversion"
  - "Options P&L using computeProfit() matching options page"
  - "Wider capital gains card with totals row and commission"
affects: [phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Math.abs() on all transaction amounts to handle negative sells from migration"
    - "computeProfit() for options P&L consistency across pages"

key-files:
  created: []
  modified:
    - src/lib/calculations.ts
    - src/lib/portfolio.ts
    - src/lib/__tests__/calculations.test.ts
    - src/components/portfolio/capital-gains-table.tsx
    - src/components/portfolio/summary-cards.tsx
    - src/app/page.tsx

key-decisions:
  - "All deposits are GBP - removed isUsBroker branching for deposits"
  - "Options P&L uses computeProfit() from options-shared for consistency"
  - "Math.abs() applied defensively to all transaction amounts"

patterns-established:
  - "Math.abs(tx.amount) pattern: Always use absolute value of transaction amounts since spreadsheet migration preserved negative sell amounts"
  - "computeProfit() as single source of truth for options P&L across all pages"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Quick Task 004: Fix Calculations Consistency Summary

**Math.abs() fix for negative sell amounts, consistent GBP deposit conversion, options P&L via computeProfit(), and wider capital gains card with totals**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T16:02:44Z
- **Completed:** 2026-02-07T16:07:00Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments
- Fixed critical bug where negative sell amounts from spreadsheet migration caused -$1M cash balance and wrong capital gains
- Unified all deposit conversion to GBP-to-USD (removed incorrect isUsBroker branching)
- Options premium card now uses computeProfit() for net P&L consistency with options page
- Capital gains card spans 2 columns with totals footer and commission display
- Added 2 test cases verifying negative amount handling (36 total calculation tests, 115 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix negative sell amounts in calculations engine and portfolio assembly** - `7f2ea7c` (fix)
2. **Task 2: Capital gains card wider layout with totals and commission** - `5e024ce` (feat)
3. **Task 3: Rename Options Premium to Options P&L with dynamic color** - `7c8c9c2` (feat)

## Files Created/Modified
- `src/lib/calculations.ts` - Math.abs() on txAmount in computeHolding and computeRealisedGainsByFiscalYear
- `src/lib/portfolio.ts` - Math.abs() on cash balance, all-GBP deposits, computeProfit() for options, removed US_BROKERS/isUsBroker
- `src/lib/__tests__/calculations.test.ts` - 2 new tests for negative sell amounts
- `src/components/portfolio/capital-gains-table.tsx` - Totals footer, commission display, shorter title, options prop
- `src/components/portfolio/summary-cards.tsx` - "Options P&L" label with dynamic pnlClassName coloring
- `src/app/page.tsx` - col-span-2 wrapper and options prop for CapitalGainsTable

## Decisions Made
- All deposits are GBP: Removed `isUsBroker` branching since ALL deposits in the system are GBP regardless of broker platform
- Options P&L uses `computeProfit()` from `options-shared.ts` for consistency with the options page (`computeStats` logic)
- Math.abs() applied defensively to both Buy and Sell amounts (buys are already positive but abs is safe)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All financial calculations now produce correct values
- Dashboard shows positive cash balance and correct capital gains
- Options P&L consistent between portfolio and options pages
- Ready to continue with Phase 5 (sync, performance) or additional quick tasks

---
*Quick Task: 004*
*Completed: 2026-02-07*
