# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** One place to see the full portfolio -- stocks and bought options together with live prices -- without manually maintaining a spreadsheet.
**Current focus:** Phase 3 - Portfolio Overview (in progress)

## Current Position

Phase: 3 of 8 (Portfolio Overview)
Plan: 1 of 3 in Phase 3 (complete)
Status: In progress
Last activity: 2026-02-07 -- Completed 03-01-PLAN.md (dependencies, data assembly, page shell)

Progress: [████░░░░░░] 35%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 4min
- Total execution time: 0.43 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 15min | 5min |
| 02 | 3/3 | 9min | 3min |
| 03 | 1/3 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-03 (6min), 02-01 (2min), 02-03 (4min), 02-02 (3min), 03-01 (3min)
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

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed 03-01-PLAN.md (dependencies, data assembly, page shell)
Resume file: None
