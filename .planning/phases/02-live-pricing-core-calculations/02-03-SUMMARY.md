---
phase: 02-live-pricing-core-calculations
plan: 03
subsystem: calculations
tags: [big.js, section-104, cost-basis, pnl, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Project structure, TypeScript config, NocoDB types
provides:
  - Section 104 pool cost basis engine (computeHolding)
  - Portfolio aggregation with weights (computePortfolio)
  - Big.js display boundary utility (toDisplay)
  - Comprehensive test suite (24 tests)
affects: [03-portfolio-table, 04-charts, 05-dividends-options, 07-uk-tax]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [Big.js decimal arithmetic, Section 104 pool algorithm, display-boundary conversion]

key-files:
  created:
    - src/lib/calculations.ts
    - src/lib/__tests__/calculations.test.ts
  modified:
    - package.json

key-decisions:
  - "Big.RM = roundHalfUp at module level for financial rounding"
  - "Big.DP left at default 20 for full intermediate precision"
  - "toDisplay() as the sole Big-to-number conversion boundary"
  - "Buys processed before sells on same-day transactions (HMRC same-day rule, simplified)"

patterns-established:
  - "Big.js arithmetic: all intermediate values stay as Big instances, only convert at display boundary"
  - "Section 104 pool: track totalCost and shares, derive avgCost, reset on full disposal"
  - "Transaction sort: date ascending, buys before sells on same day"
  - "TDD: vitest run for test execution, vitest for watch mode"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 2 Plan 3: Section 104 Holdings Calculator Summary

**Section 104 pool cost basis engine with Big.js decimal arithmetic, covering buy/sell/reset/re-entry sequences and portfolio-level weight aggregation via TDD**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-06T20:26:35Z
- **Completed:** 2026-02-06T20:30:07Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments
- Built Section 104 pool algorithm handling all transaction sequences: single buy, multiple buys, partial sell, full disposal, re-entry after disposal, fractional shares
- Implemented portfolio-level aggregation with market value weights summing to 100%
- All arithmetic uses Big.js with no floating-point operations; display values converted at boundary only
- 24 comprehensive tests covering all edge cases pass in 5ms

## Task Commits

Each TDD phase was committed atomically:

1. **RED: Failing tests** - `99348cb` (test)
2. **GREEN: Passing implementation** - `5557b07` (feat)
3. **REFACTOR: Code cleanup** - `53440ba` (refactor)

## Files Created/Modified
- `src/lib/calculations.ts` - Core calculations engine: computeHolding (Section 104 pool), computePortfolio (weights + totals), toDisplay (Big.js boundary)
- `src/lib/__tests__/calculations.test.ts` - 24 test cases covering all Section 104 edge cases, portfolio aggregation, toDisplay precision, and Big.js config verification
- `package.json` - Added vitest dependency and test/test:watch scripts

## Decisions Made
- **Big.js rounding mode:** Set `Big.RM = Big.roundHalfUp` at module level for financial rounding (0.5 rounds up). This matches HMRC and standard financial convention.
- **Big.js decimal places:** Left `Big.DP = 20` (default) for full intermediate precision. Only apply `toFixed(2)` at the display boundary.
- **Same-day sort order:** Buys processed before sells on same day. This is the simplified HMRC same-day rule -- the full 30-day bed-and-breakfast rule is deferred to v2 (Phase 7).
- **Test precision:** Used `toFixed(2)` comparison for values involving non-terminating decimals (e.g., 1700/150), since Big.js division at 20dp produces tiny residuals that are irrelevant at 2dp display.
- **vitest over jest:** Vitest is faster, ESM-native, and needs no additional config for TypeScript imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test precision for non-terminating decimal arithmetic**
- **Found during:** GREEN phase (test 2, multiple buys cost averaging)
- **Issue:** `unrealisedPnl` for test 2 produced `100.0000000000000000005` due to 1700/150 division residual at 20dp, causing strict Big equality check to fail
- **Fix:** Changed test assertion from `toEqual(new Big(100))` to `Number(result.unrealisedPnl.toFixed(2))).toBe(100.0)` for values involving non-terminating divisions
- **Files modified:** `src/lib/__tests__/calculations.test.ts`
- **Verification:** All 24 tests pass
- **Committed in:** `5557b07` (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test assertion fix. The calculation itself is correct -- the residual is at the 19th decimal place and is invisible at display precision.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Calculations engine ready for use by portfolio table (Phase 3), charts (Phase 4), and dividends/options (Phase 5)
- `computeHolding` accepts `TransactionInput[]` which maps directly from `TransactionRecord` in NocoDB types
- `computePortfolio` accepts a Map of symbol data, ready to be composed with data from NocoDB queries
- All exports are typed and documented

---
*Phase: 02-live-pricing-core-calculations*
*Completed: 2026-02-06*
