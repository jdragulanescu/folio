---
phase: 01-foundation-data-migration
plan: 02
subsystem: api
tags: [nocodb, rest-client, typescript, server-only, pagination]

# Dependency graph
requires:
  - phase: 01-foundation-data-migration/01
    provides: Next.js scaffold with src/ directory layout and server-only package
provides:
  - Typed NocoDB REST client with server-only guard
  - Auto-pagination via getAllRecords
  - Parallel multi-table fetch via fetchParallel
  - TypeScript interfaces for all 8 NocoDB tables
  - Broker constants with active/archived distinction
affects: [02-portfolio-calculations, 03-options-tracking, 04-price-sync, 05-dividend-deposits, 06-performance-history]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-only import guard, custom REST client over SDK, Record suffix convention]

key-files:
  created:
    - src/lib/nocodb.ts
    - src/lib/types.ts
  modified: []

key-decisions:
  - "Custom REST client over nocodb-sdk for better control and no version lock"
  - "Record suffix on all interfaces to distinguish raw DB rows from computed types"
  - "number | null for optional numerics (NocoDB returns null, not undefined)"
  - "PAGE_SIZE of 200 for auto-pagination (under NocoDB 5 req/sec limit)"

patterns-established:
  - "server-only guard: import 'server-only' as first import in server modules"
  - "Record naming: all NocoDB interfaces end with Record (SymbolRecord, TransactionRecord, etc.)"
  - "Table-typed fetch: all CRUD functions take TableName as first argument"
  - "fetchParallel pattern: wrap getAllRecords calls in fetchParallel for concurrent multi-table data loading"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 1 Plan 2: NocoDB Client Summary

**Typed NocoDB REST client with server-only guard, auto-pagination, parallel fetch, and 8-table TypeScript interfaces**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-06T19:08:37Z
- **Completed:** 2026-02-06T19:12:32Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- TypeScript interfaces for all 8 NocoDB tables with correct null annotations and string literal unions
- Broker constants separating active (IBKR, Trading 212, Robinhood) from archived (Freetrade, Stake, eToro)
- NocoDB REST client with server-only import guard preventing client-side API token exposure
- Auto-pagination (getAllRecords) fetching all pages using pageInfo.isLastPage
- Parallel multi-table fetch (fetchParallel) with typed tuple results
- Full CRUD: listRecords, getAllRecords, getRecord, createRecord, updateRecord

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript type definitions and broker constants** - `0b27ca4` (feat)
2. **Task 2: Build the NocoDB REST client with server-only guard** - `6d43b4f` (feat)

## Files Created/Modified
- `src/lib/types.ts` - TypeScript interfaces for all 8 NocoDB tables, broker constants, pagination types, list params
- `src/lib/nocodb.ts` - Typed NocoDB REST client with server-only guard, auto-pagination, parallel fetch, CRUD operations

## Decisions Made
- Used `number | null` for optional numeric fields because NocoDB returns `null` for empty Decimal/Number cells
- String literal unions for SingleSelect fields (e.g., `"Buy" | "Sell"`, `"Open" | "Closed" | "Expired" | "Rolled" | "Assigned"`)
- `Record` suffix on all interfaces to distinguish raw DB rows from computed types in later phases
- PAGE_SIZE of 200 for auto-pagination -- sequential fetching naturally stays under NocoDB 5 req/sec rate limit
- `cache: "no-store"` on all fetches since NocoDB data changes via migration and sync

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. NocoDB environment variables (NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_TABLE_*) are expected to be configured in .env when NocoDB tables are created in a later phase.

## Next Phase Readiness
- nocodb.ts and types.ts are ready for import by all subsequent phases
- Phase 2 (portfolio calculations) can use fetchParallel to load symbols + transactions + options concurrently
- Phase 4 (price sync) can use createRecord/updateRecord for price data writes
- NocoDB environment variables must be set in .env before runtime usage

---
*Phase: 01-foundation-data-migration*
*Completed: 2026-02-06*
