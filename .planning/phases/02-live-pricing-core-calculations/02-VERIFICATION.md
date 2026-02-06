---
phase: 02-live-pricing-core-calculations
verified: 2026-02-06T20:40:30Z
status: passed
score: 11/11 must-haves verified
---

# Phase 2: Live Pricing & Core Calculations Verification Report

**Phase Goal:** Symbols have current prices from FMP and the holdings calculation engine produces accurate P&L using decimal arithmetic

**Verified:** 2026-02-06T20:40:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FMP client can fetch batch quotes for multiple symbols in a single request | ✓ VERIFIED | `fetchBatchQuotes()` exists, batches 30 symbols per request, concatenates results |
| 2 | FMP client can fetch USD/GBP forex rate | ✓ VERIFIED | `fetchForexRate()` exists, defaults to USDGBP, returns first element |
| 3 | FMP API key is never exposed to client bundles | ✓ VERIFIED | `import "server-only"` guard in fmp.ts line 1 |
| 4 | NocoDB client can bulk-create and bulk-update records | ✓ VERIFIED | `createRecords()` and `updateRecords()` exported, updateRecords batches in groups of 50 |
| 5 | POST /api/sync fetches prices from FMP, updates symbols, inserts price_history | ✓ VERIFIED | sync.ts orchestrates full pipeline: fetchBatchQuotes → updateRecords → createRecords |
| 6 | Sync streams progress to client as NDJSON | ✓ VERIFIED | route.ts returns ReadableStream with Content-Type: application/x-ndjson, encodes JSON lines |
| 7 | Sidebar shows 'Last synced' with real-time updates | ✓ VERIFIED | useLastSynced polls every 60s, formatRelativeTime displays "Xm ago", sidebar renders timestamp |
| 8 | Sidebar 'Sync Now' button triggers sync with progress | ✓ VERIFIED | Button calls trigger(), shows spinner + "Syncing X/Y..." during isSyncing |
| 9 | GET /api/sync/status returns last_synced timestamp | ✓ VERIFIED | status/route.ts queries settings table, returns { lastSynced: string | null } |
| 10 | Holdings calculation produces correct P&L using Big.js | ✓ VERIFIED | All 24 tests pass, all arithmetic uses .plus/.minus/.times/.div, no floating-point ops |
| 11 | Weight allocation computed as market value / total | ✓ VERIFIED | computePortfolio calculates weights, test verifies 60%/40% split sums to 100% |

**Score:** 11/11 truths verified (100%)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/fmp.ts` | FMP API client with batch quotes, forex, key metrics | ✓ VERIFIED | 111 lines, exports fetchBatchQuotes, fetchForexRate, fetchKeyMetricsTTM. server-only guard line 1. Batches in groups of 30. |
| `src/lib/fmp-types.ts` | TypeScript types for FMP responses | ✓ VERIFIED | 80 lines, exports FMPQuote, FMPForexQuote, FMPKeyMetricsTTM. All fields typed, nullable metrics documented. |
| `src/lib/nocodb.ts` | Extended NocoDB client with bulk ops | ✓ VERIFIED | 237 lines, exports createRecords (bulk POST), updateRecords (bulk PATCH with 50-record batching). |
| `src/lib/types.ts` | Extended SymbolRecord with fundamentals | ✓ VERIFIED | 208 lines, SymbolRecord includes forward_pe, peg_ratio, currency, price_avg_50, dividend_yield_ttm, and 8 other fundamental fields. |
| `src/lib/sync.ts` | Sync orchestration logic | ✓ VERIFIED | 198 lines, exports runSync async generator yielding SyncProgress. Fetches quotes, updates symbols, inserts history, stores forex rate. |
| `src/app/api/sync/route.ts` | POST handler with streaming | ✓ VERIFIED | 33 lines, exports POST, returns ReadableStream with NDJSON content type, iterates runSync generator. |
| `src/app/api/sync/status/route.ts` | GET handler for last-synced | ✓ VERIFIED | 16 lines, exports GET with force-dynamic, queries settings table, returns { lastSynced }. |
| `src/hooks/use-sync.ts` | SWR mutation hook | ✓ VERIFIED | 117 lines, exports useSync, reads NDJSON stream, tracks progress via useState, revalidates /api/sync/status after complete. |
| `src/hooks/use-last-synced.ts` | SWR polling hook | ✓ VERIFIED | 42 lines, exports useLastSynced, polls every 60s, returns lastSynced timestamp. |
| `src/components/layout/app-sidebar.tsx` | Sidebar with sync UI | ✓ VERIFIED | 150 lines, uses useSync and useLastSynced, displays relative time, renders Sync Now button with spinner and progress. |
| `src/lib/calculations.ts` | Holdings engine with Section 104 | ✓ VERIFIED | 224 lines, exports computeHolding, computePortfolio, toDisplay. All arithmetic via Big.js, Big.RM = roundHalfUp. |
| `src/lib/__tests__/calculations.test.ts` | Comprehensive test suite | ✓ VERIFIED | 429 lines, 24 tests covering single buy, multiple buys, partial sell, full disposal, re-entry, fractional shares, sort order, portfolio weights. All pass in 4ms. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| sync.ts | fmp.ts | import fetchBatchQuotes, fetchForexRate | ✓ WIRED | Line 3: `import { fetchBatchQuotes, fetchForexRate } from "./fmp"`. Called on lines 111, 175. |
| sync.ts | nocodb.ts | import updateRecords, createRecords | ✓ WIRED | Lines 4-11: imports updateRecords, createRecords, getAllRecords. Used on lines 82, 140, 154. |
| route.ts | sync.ts | import runSync | ✓ WIRED | Line 1: `import { runSync } from "@/lib/sync"`. Iterated in line 9. |
| use-sync.ts | /api/sync | fetch POST with stream reading | ✓ WIRED | Line 31: `fetch("/api/sync", { method: "POST" })`. Stream read lines 37-80. |
| app-sidebar.tsx | use-sync.ts | import useSync | ✓ WIRED | Line 29: `import { useSync } from "@/hooks/use-sync"`. Called line 69, trigger used line 134. |
| app-sidebar.tsx | use-last-synced.ts | import useLastSynced | ✓ WIRED | Line 28: `import { useLastSynced } from "@/hooks/use-last-synced"`. Called line 70, lastSynced displayed line 126. |
| calculations.ts | big.js | import Big | ✓ WIRED | Line 13: `import Big from "big.js"`. Used throughout for all arithmetic (lines 108, 121, 122, 125, etc.). |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DATA-09: Live price sync from FMP | ✓ SATISFIED | FMP client fetches batch quotes, sync pipeline updates symbols table with current_price, previous_close, change_pct, day/year high/low, market_cap, PE, EPS. |
| DATA-10: Daily price history | ✓ SATISFIED | Sync inserts price_history records with symbol, date (YYYY-MM-DD), close_price, volume after each batch. |
| DATA-11: Forex rate storage | ✓ SATISFIED | Sync fetches USDGBP rate, stores bid price in settings table with keys "usd_gbp_rate" and "usd_gbp_rate_updated". |
| UI-03: Manual sync trigger | ✓ SATISFIED | Sidebar footer has "Sync Now" button that calls POST /api/sync, displays progress ("Syncing 45/120..."), shows relative time for last-synced. |

### Anti-Patterns Found

**None blocking.**

Scanned files: fmp.ts, fmp-types.ts, nocodb.ts, types.ts, sync.ts, route.ts, status/route.ts, use-sync.ts, use-last-synced.ts, app-sidebar.tsx, calculations.ts, calculations.test.ts

- No TODO/FIXME comments in Phase 2 code
- No placeholder content in implementation files
- No empty return statements or stub functions
- No console.log-only implementations
- "Coming soon" text found in app/page.tsx and other page stubs, but these are placeholders for future phases (not Phase 2 scope)

### Code Quality Checks

| Check | Result | Details |
|-------|--------|---------|
| TypeScript compilation | ✓ PASS | `pnpm typecheck` exits 0, no errors |
| ESLint | ✓ PASS | `pnpm lint` exits 0, no warnings |
| Unit tests | ✓ PASS | 24/24 tests pass in 4ms |
| Big.js arithmetic | ✓ VERIFIED | All calculations use .plus/.minus/.times/.div, no primitive number operations on financial values |
| Big.js configuration | ✓ VERIFIED | Big.RM = roundHalfUp (line 21), Big.DP = 20 (verified in test line 426) |
| Server-only guards | ✓ VERIFIED | fmp.ts, nocodb.ts, sync.ts all have `import "server-only"` at line 1 |
| Dependencies installed | ✓ VERIFIED | big.js@7.0.1, swr@2.4.0, vitest@4.0.18 in package.json |

## Detailed Verification

### Plan 02-01: FMP Client & Bulk NocoDB Operations

**Must-haves verified:**

1. ✓ FMP client can fetch batch quotes — `fetchBatchQuotes()` exists, splits symbols into batches of 30, fetches sequentially, concatenates results. Empty array guard on line 58. Batch loop lines 62-69.

2. ✓ FMP client can fetch USD/GBP forex rate — `fetchForexRate()` exists, defaults to "USDGBP" parameter, calls `/api/v3/fx/${pair}`, returns first element with null check. Lines 80-90.

3. ✓ FMP API key never exposed to client — `import "server-only"` on line 1 of fmp.ts. Build-time error if imported by client component.

4. ✓ NocoDB bulk operations — `createRecords()` exported from nocodb.ts (lines 169-180), `updateRecords()` exported (lines 195-217). updateRecords batches in groups of 50 (BULK_UPDATE_BATCH_SIZE constant line 183). Empty array guards present.

5. ✓ SymbolRecord extended — Lines 75, 90-102 of types.ts include currency, forward_pe, peg_ratio, dividend_yield_ttm, revenue_per_share, roe, roa, debt_to_equity, free_cash_flow_per_share, book_value_per_share, current_ratio, price_avg_50, price_avg_200, last_fundamentals_update.

**Wiring verified:**
- fmp.ts imports types from fmp-types.ts (line 3)
- nocodb.ts uses TableName type from types.ts (line 6)
- All exports substantive (no stubs, proper implementations)

### Plan 02-02: Sync Route & Sidebar UI

**Must-haves verified:**

1. ✓ POST /api/sync fetches and updates — sync.ts runSync generator: fetches symbols (line 82), builds batches (line 106), calls fetchBatchQuotes (line 111), builds symbolUpdates array (lines 114-137), calls updateRecords (line 140), builds historyRecords (lines 144-151), calls createRecords (line 154).

2. ✓ Sync streams progress as NDJSON — route.ts creates ReadableStream (line 6), iterates runSync generator (line 9), encodes each progress as JSON + "\n" (line 10), sets Content-Type: application/x-ndjson (line 28).

3. ✓ Sidebar shows last-synced with real-time updates — app-sidebar.tsx imports useLastSynced (line 28), calls hook (line 70), displays relative time (line 126) using formatRelativeTime helper (lines 40-51). SWR refreshInterval: 60_000 in use-last-synced.ts line 33.

4. ✓ Sidebar Sync Now button — Button with onClick={() => trigger()} (line 134), disabled={isSyncing} (line 135), shows spinner with animate-spin during sync (line 139), displays progress text "Syncing X/Y..." when progress.type === "progress" (lines 118-122).

5. ✓ GET /api/sync/status returns timestamp — status/route.ts queries settings table with where: "(key,eq,last_synced)" (line 8), returns { lastSynced: value | null } (line 13), has force-dynamic export (line 4).

6. ✓ Price history records inserted — sync.ts lines 144-154 build historyRecords array with symbol, date (today as YYYY-MM-DD), close_price, volume. Calls createRecords("price_history", historyRecords).

7. ✓ USD/GBP rate fetched and stored — sync.ts lines 174-190 fetch forex rate, call upsertSetting for "usd_gbp_rate" and "usd_gbp_rate_updated". Uses forexRate.bid (line 178).

**Wiring verified:**
- sync.ts imports fetchBatchQuotes, fetchForexRate from fmp.ts (line 3)
- sync.ts imports updateRecords, createRecords from nocodb.ts (lines 4-11)
- route.ts imports runSync from sync.ts (line 1)
- use-sync.ts fetches /api/sync (line 31), reads stream (lines 37-80), mutates /api/sync/status after complete (line 82)
- app-sidebar.tsx imports and uses both hooks (lines 28-29, 69-70)
- Sidebar renders sync button and last-synced indicator (lines 116-145)

### Plan 02-03: Calculations Engine

**Must-haves verified:**

1. ✓ Holdings calculation produces correct P&L — Test suite covers: single buy (test 1), multiple buys (test 2), partial sell (test 3), full disposal (test 4), re-entry (test 5), complex sequences (test 6). All pass.

2. ✓ Holdings handles sells proportionally (Section 104) — Lines 135-140 of calculations.ts: compute avgCost, costOfSold = avgCost * txShares, reduce pool proportionally. Test 3 verifies.

3. ✓ Holdings resets pool on full disposal — Lines 143-145: if pool.shares <= 0, reset to { shares: 0, totalCost: 0 }. Test 4 verifies shares = 0, totalCost = 0, realisedPnl = 500.

4. ✓ Holdings handles re-entry after disposal — Test 5 verifies fresh pool after reset: buy 100 @ 10, sell 100 @ 15 (realised 500), buy 50 @ 20 → avgCost = 20 (not averaged with old pool), realisedPnl carried = 500.

5. ✓ Unrealised P&L computed correctly — Lines 153-155: `price.minus(avgCost).times(pool.shares)`. Test 1 verifies: 100 shares @ $10 cost, $12 current → unrealised = 200.

6. ✓ Weight allocation computed — Lines 205-207 of computePortfolio: `h.result.marketValue.div(totals.totalMarketValue).times(100)`. Test 10 verifies 60%/40% weights for $6000/$4000 holdings.

7. ✓ All arithmetic uses Big.js — Grep verified all operations use .plus, .minus, .times, .div (lines 129, 130, 135, 136, 137, 139, 140, 150, 152, 154, 189, 190, 191, 194, 206). No primitive number arithmetic on financial values.

8. ✓ Display values use toFixed(2) at boundaries — toDisplay function (lines 221-223): `Number(value.toFixed(dp))` with default dp=2. Test 12 verifies precision.

**Wiring verified:**
- calculations.ts imports Big from big.js (line 13)
- Big.RM set to roundHalfUp (line 21), test verifies (line 421)
- Big.DP left at default 20, test verifies (line 426)
- calculations.test.ts imports computeHolding, computePortfolio, toDisplay (lines 2-6)
- All 24 tests pass in 4ms

## Summary

Phase 2 goal **ACHIEVED**.

All 11 must-have truths verified. All 12 artifacts exist, are substantive (no stubs), and are correctly wired. All key links verified. All 4 requirements (DATA-09, DATA-10, DATA-11, UI-03) satisfied.

**Evidence of goal achievement:**

1. **Live pricing operational:** FMP client fetches current prices for ~120 symbols in batches of 30. Sync pipeline updates symbols table with current_price, change_pct, day/year high/low, market_cap, PE, EPS. Price history records inserted daily. USD/GBP rate stored in settings. Manual sync trigger in sidebar with real-time progress.

2. **Calculations engine accurate:** Section 104 pool algorithm handles all buy/sell sequences correctly. All arithmetic uses Big.js decimal precision (no floating-point errors). 24 comprehensive tests pass, including edge cases (fractional shares, full disposal, re-entry, complex multi-transaction sequences). Portfolio weights computed and sum to 100%.

3. **Quality verified:** TypeScript compiles without errors. ESLint passes. All tests pass. No TODO/FIXME in production code. Server-only guards protect API keys. Dependencies installed.

**Phase 2 is ready for Phase 3 (Portfolio Dashboard).**

---

_Verified: 2026-02-06T20:40:30Z_
_Verifier: Claude (sky-verifier)_
