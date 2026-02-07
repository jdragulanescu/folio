# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** One place to see the full portfolio -- stocks and bought options together with live prices -- without manually maintaining a spreadsheet.
**Current focus:** Phases 3 & 4 complete and verified, ready for Phase 5

## Current Position

Phase: 4 of 8 complete (Phases 1-4 done), ready for Phase 5
Plan: 4 of 4 in Phase 4 (all complete, verified 31/31 must-haves)
Status: Phase 4 verified and complete
Last activity: 2026-02-07 -- Quick task 003: fix portfolio calcs, currency, tests

Progress: [██████░░░░] 54%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 4min
- Total execution time: 0.77 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 15min | 5min |
| 02 | 3/3 | 9min | 3min |
| 03 | 3/3 | 15min | 5min |
| 04 | 4/4 | 11min | 3min |

**Recent Trend:**
- Last 5 plans: 04-02 (4min), 03-02 (7min), 04-03 (2min), 03-03 (5min), 04-04 (1min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8-phase structure derived from 56 requirements across 7 categories
- [Roadmap]: Phases 3, 4, 5 can execute in parallel (all depend only on Phase 2)
- [Roadmap]: UK Tax deferred to v2; advanced features (unified view, expiration calendar) placed in Phase 8
- [01-01]: Restructured to src/ directory layout (create-next-app generated flat, plan expects src/)
- [01-01]: Used &:where(.dark, .dark *) for dark mode custom variant
- [01-01]: Portfolio page at root / rather than /portfolio
- [01-02]: Custom REST client over nocodb-sdk for better control and no version lock
- [01-02]: Record suffix on interfaces to distinguish raw DB rows from computed types
- [01-02]: number | null for optional numerics (NocoDB returns null not undefined)
- [01-02]: PAGE_SIZE 200 for auto-pagination, cache: "no-store" for fresh data
- [01-03]: Dynamic header mapping for spreadsheet column detection
- [01-03]: Null platform passed through (98 transactions)
- [01-03]: Sector data from 'Table 1' in Portfolio sheet, not Sectors-1
- [02-01]: 30-symbol batch size for FMP quote requests (URL length safety)
- [02-01]: 50-record batch size for NocoDB bulk updates (safe default)
- [02-01]: Graceful null fallback for FMP key-metrics-ttm (free tier restrictions)
- [02-03]: Big.RM = roundHalfUp for financial rounding, Big.DP left at default 20
- [02-03]: toDisplay() as sole Big-to-number conversion boundary
- [02-03]: Same-day transactions: buys before sells (simplified HMRC same-day rule)
- [02-02]: NDJSON streaming over SSE for sync progress (simpler, no EventSource needed)
- [02-02]: Partial batch failure: log and continue, don't abort entire sync
- [02-02]: Settings upsert pattern: query-then-create-or-update for first-run safety
- [02-02]: Forex bid price stored for USD/GBP (conservative direction)
- [quick-001]: FMP stable endpoint returns `price` field instead of `bid` for forex -- sync pipeline updated accordingly
- [quick-002]: PriceProvider abstraction -- swap providers via single import change
- [quick-002]: Tiingo midPrice for forex (bid/ask average), computed changesPercentage
- [quick-002]: Tiingo IEX lacks yearHigh, yearLow, marketCap, pe, eps, avgVolume, priceAvg50, priceAvg200 -- all null
- [quick-002]: FMP files kept as dormant code (fmp.ts, fmp-types.ts unchanged)
- [03-01]: getPrimaryPlatform uses net share tally (buys - sells) per platform to determine broker
- [03-01]: Shares exported with 6 decimal places for fractional share accuracy
- [03-01]: dayChange computed per-holding then summed; null changePct treated as 0
- [03-01]: unrealisedPnlPct as (unrealisedPnl / totalCost) * 100 with zero guard
- [03-02]: Default sort: weight descending (most impactful positions first)
- [03-02]: 6 core columns visible by default, 9 optional toggle-able columns hidden
- [03-02]: Null changePct sorted to bottom via custom nullBottomSort function
- [03-02]: Weight shows N/A on symbol detail page (needs full portfolio context)
- [03-02]: ROE displayed as percentage (value * 100) since stored as decimal
- [03-03]: Small slices below 3% allocation merged into "Other" in donut charts
- [03-03]: Top movers sorted by day change % (changePct) as most actionable daily metric
- [03-03]: Broker breakdown collapsed by default to reduce visual noise (REVERSED in quick-003: now always visible)
- [03-03]: Null sectors/strategies labelled "Unassigned", null platforms labelled "Unknown"
- [04-01]: formatCurrency defaults to USD (was GBP) since portfolio holds US stocks
- [04-01]: Roll chain matching uses call_put type + 5-day proximity heuristic
- [04-01]: Premium chart groups by opened date month (when premium was received/paid)
- [04-01]: LEAPS P&L from underlying stock intrinsic value (no free options pricing API)
- [04-01]: avgDaysHeld excludes options with null days_held for accuracy
- [04-02]: Radix Select uses "all" sentinel value (empty string not supported as item value)
- [04-02]: Symbol input debounce is local-only (React compiler prohibits setState in useEffect)
- [04-02]: ToggleGroup uses "all" default value for visual highlighting
- [04-03]: Stat cards placed above tabs to always show overall totals regardless of active tab
- [04-03]: LEAPS table uses flat rows (no roll chain expansion) for simplicity
- [04-03]: All tab uses flat OptionsRow[] without roll chain grouping for unified view
- [04-04]: buildPremiumByMonth already returns abbreviated month names (not ISO dates) -- use directly
- [04-04]: Available years always include current year even with no data
- [quick-003]: US brokers (IBKR, Robinhood) have USD deposits; all others treated as GBP
- [quick-003]: Currency toggle placed above summary cards, persisted in localStorage via useCurrencyPreference
- [quick-003]: holdings-columns converted from static array to getColumns(currency, forexRate) factory
- [quick-003]: Capital gains computed via Section 104 pool per-symbol, aggregated by UK fiscal year
- [quick-003]: forexRate exposed on PortfolioData and passed to all currency-displaying components

### Pending Todos

1. **Add capital gains tracking page for UK fiscal years** (area: ui) -- `/tax` page showing realised gains per fiscal year for HMRC self-assessment

### Blockers/Concerns

- Research flag: Phase 7 (UK Tax) was deferred to v2, but if it were in scope, it would need deep HMRC Section 104 research
- Gap: FX rate handling for historical transactions -- using single daily rate for MVP, historical rates deferred
- Gap: Options accounting policy (premium reduces cost basis vs separate income) -- decision needed in Phase 6

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Fix FMP legacy endpoint 403 — migrate to stable API | 2026-02-06 | 4c5fbe3 | [001-fix-fmp-legacy-endpoint-403-migrate-to-s](./quick/001-fix-fmp-legacy-endpoint-403-migrate-to-s/) |
| 002 | Switch to Tiingo provider abstraction | 2026-02-06 | 9f388b2 | [002-switch-to-tiingo-provider-abstraction](./quick/002-switch-to-tiingo-provider-abstraction/) |
| 003 | Fix portfolio calcs, currency selector, tests | 2026-02-07 | ad7bb43 | [003-fix-portfolio-calcs-currency-tests](./quick/003-fix-portfolio-calcs-currency-tests/) |

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed quick task 003 (fix portfolio calcs, currency selector, tests)
Resume file: None
