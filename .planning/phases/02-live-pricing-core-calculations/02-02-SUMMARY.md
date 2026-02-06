---
phase: 02-live-pricing-core-calculations
plan: 02
subsystem: api
tags: [sync, ndjson, streaming, swr, fmp, nocodb, sidebar]

# Dependency graph
requires:
  - phase: 02-01
    provides: FMP client (fetchBatchQuotes, fetchForexRate) and NocoDB REST client (CRUD operations)
provides:
  - Sync orchestration module (runSync async generator)
  - POST /api/sync with NDJSON streaming progress
  - GET /api/sync/status returning last-synced timestamp
  - useSync hook for triggering sync with real-time progress
  - useLastSynced hook polling sync status every 60s
  - Sidebar sync button with spinning icon and relative time display
affects: [portfolio-page, performance-dashboard, any-page-needing-fresh-prices]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NDJSON streaming for long-running operations"
    - "Async generator for orchestrating multi-step server pipelines"
    - "SWR mutation for POST triggers with progress tracking"
    - "SWR polling for live status indicators"
    - "Settings table upsert pattern for application config"

key-files:
  created:
    - src/lib/sync.ts
    - src/app/api/sync/route.ts
    - src/app/api/sync/status/route.ts
    - src/hooks/use-sync.ts
    - src/hooks/use-last-synced.ts
  modified:
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "NDJSON streaming over SSE for sync progress (simpler, no EventSource needed)"
  - "Partial batch failure: log error, track failed count, continue with next batch"
  - "Settings table upsert pattern: query-then-create-or-update for first-run safety"
  - "Forex rate stored as bid price (conservative direction for GBP conversion)"

patterns-established:
  - "NDJSON streaming: async generator yields typed events, route serializes to stream"
  - "Settings upsert: listRecords + updateRecord or createRecord"
  - "SWR mutation: useSWRMutation + manual progress via useState + global mutate for cache invalidation"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 2 Plan 2: Sync Pipeline Summary

**NDJSON-streaming sync pipeline: FMP batch quotes -> NocoDB symbol/price_history updates -> sidebar real-time progress with SWR hooks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T20:34:22Z
- **Completed:** 2026-02-06T20:37:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Full sync orchestration as async generator with typed progress events (start/progress/complete/error)
- Streaming POST /api/sync endpoint with NDJSON and GET /api/sync/status for polling
- Sidebar footer with Sync Now button (spinning icon, progress text, disabled during sync)
- Relative time last-synced indicator auto-updating via 60s SWR polling
- USD/GBP forex rate fetched and stored in settings during each sync
- Partial batch failure resilience -- individual batch errors don't abort the entire sync

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sync orchestration and API route handlers** - `5bd1c1d` (feat)
2. **Task 2: Create SWR hooks and add sync UI to sidebar** - `c476f7d` (feat)

## Files Created/Modified
- `src/lib/sync.ts` - Sync orchestration: async generator yielding SyncProgress events, batch processing, upsert settings
- `src/app/api/sync/route.ts` - POST handler streaming NDJSON from runSync generator
- `src/app/api/sync/status/route.ts` - GET handler returning last_synced timestamp from settings table
- `src/hooks/use-sync.ts` - Client hook: triggers sync via POST, reads NDJSON stream, tracks progress state
- `src/hooks/use-last-synced.ts` - Client hook: polls /api/sync/status every 60s via SWR
- `src/components/layout/app-sidebar.tsx` - Added sync button with spinning icon and relative time display in footer

## Decisions Made
- **NDJSON over SSE:** Simpler protocol for client consumption -- just JSON lines over a POST response stream, no EventSource API needed. The client reads via ReadableStream reader with buffer management.
- **Partial failure handling:** Each FMP batch is independently try/caught. Failed batches are logged and tracked in the `failed` count but don't prevent other batches from succeeding.
- **Settings upsert pattern:** First sync ever has no "last_synced" row. The upsertSetting helper queries for existing key then creates or updates accordingly, avoiding unique constraint errors.
- **Forex bid price:** Storing `forexRate.bid` for USD/GBP (conservative direction -- slightly lower rate benefits GBP-based portfolio valuation accuracy).

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required. FMP API key and NocoDB credentials were configured in Phase 1.

## Next Phase Readiness
- Sync pipeline is operational, ready for manual or automated price refreshes
- Price history records will accumulate on each sync for historical charting (Phase 5)
- Portfolio page can now rely on fresh `current_price` data in the symbols table
- Exchange rate available in settings table for GBP conversion in calculations

---
*Phase: 02-live-pricing-core-calculations*
*Completed: 2026-02-06*
