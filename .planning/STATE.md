# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** One place to see the full portfolio -- stocks and bought options together with live prices -- without manually maintaining a spreadsheet.
**Current focus:** Phase 2 - Live Pricing & Core Calculations

## Current Position

Phase: 2 of 8 (Live Pricing & Core Calculations)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-06 -- Phase 1 complete (3/3 plans, verified)

Progress: [█░░░░░░░░░] 12.5%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 15min | 5min |

**Recent Trend:**
- Last 5 plans: 01-01 (5min), 01-03 (6min), 01-02 (4min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 7 (UK Tax) was deferred to v2, but if it were in scope, it would need deep HMRC Section 104 research
- Gap: FX rate handling for historical transactions -- using single daily rate for MVP, historical rates deferred
- Gap: Options accounting policy (premium reduces cost basis vs separate income) -- decision needed in Phase 6

## Session Continuity

Last session: 2026-02-06
Stopped at: Phase 1 complete, ready for Phase 2 planning
Resume file: None
