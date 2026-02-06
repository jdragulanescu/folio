# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** One place to see the full portfolio -- stocks and bought options together with live prices -- without manually maintaining a spreadsheet.
**Current focus:** Phase 3 - Portfolio Overview (ready to plan)

## Current Position

Phase: 2 of 8 complete, ready for Phase 3
Plan: 3 of 3 in Phase 2 (all complete)
Status: Phase 2 verified, ready for Phase 3 planning
Last activity: 2026-02-06 -- Quick task 001: FMP /api/v3/ to /stable/ migration

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 4min
- Total execution time: 0.38 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 15min | 5min |
| 02 | 3/3 | 9min | 3min |

**Recent Trend:**
- Last 5 plans: 01-02 (4min), 01-03 (6min), 02-01 (2min), 02-03 (4min), 02-02 (3min)
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

### Pending Todos

1. **Add capital gains tracking page for UK fiscal years** (area: ui) -- `/tax` page showing realised gains per fiscal year for HMRC self-assessment

### Blockers/Concerns

- Research flag: Phase 7 (UK Tax) was deferred to v2, but if it were in scope, it would need deep HMRC Section 104 research
- Gap: FX rate handling for historical transactions -- using single daily rate for MVP, historical rates deferred
- Gap: Options accounting policy (premium reduces cost basis vs separate income) -- decision needed in Phase 6

## Session Continuity

Last session: 2026-02-06
Stopped at: Quick task 001 complete, ready for Phase 3 planning
Resume file: None
