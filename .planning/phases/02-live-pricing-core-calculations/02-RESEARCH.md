# Phase 2: Live Pricing & Core Calculations - Research

**Researched:** 2026-02-06
**Domain:** FMP API integration, decimal financial calculations, real-time sync UI, NocoDB bulk operations
**Confidence:** HIGH (core patterns well-established; FMP-specific details verified against documentation)

## Summary

Phase 2 connects the application to live market data via FMP (Financial Modeling Prep) API, stores price history in NocoDB, exposes a sync mechanism with real-time UI feedback, and builds the core calculations engine that turns raw transactions into holdings with precise P&L. This phase is the critical foundation -- Phases 3, 4, 5, 7, and 8 all depend on it.

The standard approach is: (1) a typed FMP client library that batches symbol requests and caches responses, (2) a Next.js route handler at `/api/sync` that orchestrates the sync and streams progress, (3) SWR for client-side data fetching with `useSWRMutation` for the sync trigger, and (4) a pure-function calculations library using Big.js for all financial arithmetic.

**Primary recommendation:** Build the FMP client, sync route handler, and calculations engine as three distinct server-side modules. Use SWR (not React Query) for its lighter footprint and native Vercel/Next.js alignment. Use Big.js `toFixed(2)` as the final conversion boundary -- all intermediate calculations stay as Big instances.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| big.js | ^7.0.1 | Decimal arithmetic for all financial calculations | 6KB, fastest arbitrary-precision library, simpler API than bignumber.js/decimal.js, well-suited to fixed-decimal finance |
| swr | ^2.4.0 | Client-side data fetching, cache management, mutation triggers | 5.3KB, built by Vercel, native Next.js integration, `useSWRMutation` for sync trigger with `isMutating` state |
| @types/big.js | latest | TypeScript type definitions for big.js | big.js ships no types; DefinitelyTyped provides them |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| server-only | (already installed) | Protect FMP API key from client bundles | Import in FMP client module, same pattern as NocoDB client |
| next (route handlers) | 16.1.6 (installed) | /api/sync POST handler with streaming | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWR | TanStack Query (React Query) | TanStack has richer mutation lifecycle (onMutate/onSettled), DevTools, and better optimistic updates, but is 3x larger (16KB vs 5KB), adds complexity not needed for this use case. SWR's `useSWRMutation` with `trigger()` + `isMutating` is sufficient for a single sync operation. |
| big.js | decimal.js | decimal.js supports trig/log/exp functions not needed for finance; big.js is smaller and simpler for +, -, *, / operations |
| big.js | bignumber.js | bignumber.js supports crypto-large numbers and base conversions; overkill for stock price arithmetic |
| Streaming SSE | Simple POST with polling | SSE gives real-time progress ("Syncing 45/120") but adds complexity. Polling is simpler but laggy. Recommendation: use streaming for sync progress. |

**Installation:**
```bash
pnpm add big.js swr && pnpm add -D @types/big.js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── nocodb.ts           # (existing) NocoDB REST client
│   ├── types.ts            # (existing) NocoDB table types -- extend with FMP types
│   ├── fmp.ts              # NEW: FMP API client (server-only)
│   ├── fmp-types.ts        # NEW: FMP response type definitions
│   ├── calculations.ts     # NEW: Holdings/P&L engine using Big.js
│   └── sync.ts             # NEW: Sync orchestration (coordinates FMP fetch + NocoDB write)
├── app/
│   └── api/
│       └── sync/
│           └── route.ts    # NEW: POST handler for /api/sync
├── hooks/
│   ├── use-mobile.ts       # (existing)
│   ├── use-sync.ts         # NEW: SWR mutation hook for sync trigger
│   └── use-last-synced.ts  # NEW: SWR hook for polling last-synced timestamp
├── components/
│   └── layout/
│       └── app-sidebar.tsx  # (existing) -- add sync button + last-synced indicator
└── ...
```

### Pattern 1: FMP Client with Server-Only Guard
**What:** Typed FMP API client that batches requests and never leaks the API key to the client
**When to use:** All FMP API calls
**Example:**
```typescript
// src/lib/fmp.ts
import "server-only"

const FMP_BASE = "https://financialmodelingprep.com"
const API_KEY = process.env.FMP_API_KEY!

// Batch quote: single request for multiple symbols
// GET /api/v3/quote/AAPL,MSFT,GOOGL?apikey=KEY
export async function fetchBatchQuotes(symbols: string[]): Promise<FMPQuote[]> {
  const symbolStr = symbols.join(",")
  const url = `${FMP_BASE}/api/v3/quote/${symbolStr}?apikey=${API_KEY}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`FMP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<FMPQuote[]>
}

// Forex rate: GET /api/v3/fx/USDGBP?apikey=KEY
export async function fetchForexRate(pair: string): Promise<FMPForexQuote[]> {
  const url = `${FMP_BASE}/api/v3/fx/${pair}?apikey=${API_KEY}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`FMP FX ${res.status}: ${await res.text()}`)
  return res.json() as Promise<FMPForexQuote[]>
}
```

### Pattern 2: Streaming Progress from Route Handler
**What:** Use ReadableStream to send sync progress updates to the client in real time
**When to use:** The `/api/sync` POST handler
**Example:**
```typescript
// src/app/api/sync/route.ts
import { type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send progress updates as JSON lines
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
        }

        send({ type: "start", total: symbols.length })

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]
          const quotes = await fetchBatchQuotes(batch)
          // Process and save...
          send({ type: "progress", completed: (i + 1) * batchSize, total })
        }

        send({ type: "complete", timestamp: new Date().toISOString() })
        controller.close()
      } catch (error) {
        send({ type: "error", message: String(error) })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  })
}
```

### Pattern 3: SWR Mutation Hook for Sync Trigger
**What:** Client-side hook that triggers sync and tracks progress via stream reading
**When to use:** The Sync Now button in the sidebar
**Example:**
```typescript
// src/hooks/use-sync.ts
"use client"
import useSWRMutation from "swr/mutation"

async function triggerSync(url: string) {
  const res = await fetch(url, { method: "POST" })
  if (!res.body) throw new Error("No stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let lastMessage = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).trim().split("\n")
    for (const line of lines) {
      lastMessage = JSON.parse(line)
    }
  }
  return lastMessage
}

export function useSync() {
  const { trigger, isMutating, data, error } = useSWRMutation(
    "/api/sync",
    triggerSync
  )
  return { trigger, isSyncing: isMutating, result: data, error }
}
```

### Pattern 4: Big.js Calculation Boundaries
**What:** All financial calculations use Big.js internally, convert to number only at display boundaries
**When to use:** The entire calculations library
**Example:**
```typescript
// src/lib/calculations.ts
import Big from "big.js"

// Configure rounding: ROUND_HALF_UP for financial
Big.RM = Big.roundHalfUp  // RM = 1

export interface Holding {
  symbol: string
  shares: number          // Display value
  avgCost: number         // Display value (2dp)
  totalCost: number       // Display value (2dp)
  currentPrice: number    // From FMP
  marketValue: number     // Display value (2dp)
  unrealisedPnl: number   // Display value (2dp)
  unrealisedPnlPct: number
  realisedPnl: number     // Display value (2dp)
  totalPnl: number        // Display value (2dp)
  weight: number          // As percentage
}

interface PoolState {
  shares: Big
  totalCost: Big  // Total pool cost
}

// Section 104 pool calculation
export function computeHolding(
  transactions: Array<{ type: "Buy" | "Sell"; shares: number; price: number; amount: number }>,
  currentPrice: number,
): { shares: Big; avgCost: Big; realisedPnl: Big } {
  let pool: PoolState = { shares: new Big(0), totalCost: new Big(0) }
  let realisedPnl = new Big(0)

  for (const tx of transactions) {
    const txShares = new Big(tx.shares)
    const txAmount = new Big(tx.amount)

    if (tx.type === "Buy") {
      pool.shares = pool.shares.plus(txShares)
      pool.totalCost = pool.totalCost.plus(txAmount)
    } else {
      // Sell: reduce pool proportionally
      if (pool.shares.eq(0)) continue
      const avgCost = pool.totalCost.div(pool.shares)
      const costOfSold = avgCost.times(txShares)
      realisedPnl = realisedPnl.plus(txAmount.minus(costOfSold))
      pool.shares = pool.shares.minus(txShares)
      pool.totalCost = pool.totalCost.minus(costOfSold)

      // Reset pool if fully sold
      if (pool.shares.lte(0)) {
        pool = { shares: new Big(0), totalCost: new Big(0) }
      }
    }
  }

  const avgCost = pool.shares.gt(0) ? pool.totalCost.div(pool.shares) : new Big(0)
  return { shares: pool.shares, avgCost, realisedPnl }
}
```

### Pattern 5: NocoDB Bulk Operations
**What:** Use array bodies for bulk creates and updates to minimize API calls
**When to use:** Updating ~120 symbols and inserting ~120 price_history records per sync
**Example:**
```typescript
// Extend src/lib/nocodb.ts with bulk operations

// Bulk create: POST with array body
export async function createRecords<T>(
  table: TableName,
  records: Partial<T>[],
): Promise<T[]> {
  const tableId = TABLE_IDS[table]
  return nocodbFetch<T[]>(`/api/v2/tables/${tableId}/records`, {
    method: "POST",
    body: JSON.stringify(records),
  })
}

// Bulk update: PATCH with array body (Id in each object)
export async function updateRecords<T>(
  table: TableName,
  records: Array<Partial<T> & { Id: number }>,
): Promise<T[]> {
  const tableId = TABLE_IDS[table]
  return nocodbFetch<T[]>(`/api/v2/tables/${tableId}/records`, {
    method: "PATCH",
    body: JSON.stringify(records),
  })
}
```

### Anti-Patterns to Avoid
- **Floating-point arithmetic for money:** Never use native JS `number * number` for financial calculations. Always use Big.js.
- **Exposing FMP API key to client:** The FMP client must import `server-only`. Never call FMP directly from client components.
- **Individual NocoDB calls in a loop:** Don't update 120 symbols with 120 individual PATCH requests. Use bulk update.
- **Storing Big.js instances in state/DB:** Big.js values must be converted to `number` (via `.toNumber()`) before storing in NocoDB or passing to React state.
- **Calculating cost basis with running average per share:** Use total pool cost / total shares (the Section 104 pool model), not a running average that accumulates rounding errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Custom number wrapper | big.js | Floating-point errors accumulate over 963 transactions; Big.js handles arbitrary precision |
| Relative time display ("5 min ago") | Custom date formatter | Intl.RelativeTimeFormat or a tiny lib | Edge cases with timezones, locale, and update intervals |
| Data fetching + caching | Custom fetch wrapper with cache | SWR | Race conditions, deduplication, revalidation, and stale-while-revalidate are hard to get right |
| Streaming progress | Custom WebSocket server | ReadableStream + NDJSON | WebSocket is overkill for unidirectional progress; ReadableStream works natively in route handlers |
| FX rate conversion | Manual multiplication everywhere | Centralized `convertToGBP(amount, rate)` utility | Easy to miss conversions or use stale rates |

**Key insight:** The calculations engine handles 963 historical transactions across ~120 symbols. Rounding errors from `0.1 + 0.2 !== 0.3` would cascade across hundreds of operations. Big.js eliminates this class of bug entirely.

## Common Pitfalls

### Pitfall 1: FMP Free Tier Symbol Restrictions
**What goes wrong:** The FMP free tier may limit certain endpoints to ~87 sample symbols, but the portfolio has ~120 symbols. The v3/quote endpoint appears to work for all US stocks on the free tier, while fundamental data endpoints (key-metrics, ratios) may be restricted.
**Why it happens:** FMP's pricing page shows "Symbol Limited" indicators on many endpoint categories for the free plan.
**How to avoid:** (1) Use `GET /api/v3/quote/{symbols}` for core price data -- this returns price, change%, dayHigh, dayLow, yearHigh, yearLow, pe, eps, marketCap, previousClose, and avgVolume in a single call for any US symbol. (2) For extended fundamentals (forward PE, PEG, revenue growth), attempt `GET /api/v3/key-metrics-ttm/{symbol}` but handle 403/empty gracefully -- store what works, skip what doesn't. (3) Cache ALL successful API responses in the database to avoid re-fetching.
**Warning signs:** 403 errors or empty arrays on fundamental endpoints for non-sample symbols.

### Pitfall 2: FMP Rate Limit Exhaustion
**What goes wrong:** With 250 requests/day on the free tier, a sync that makes individual requests per symbol would use 120+ requests per sync, allowing only 2 syncs per day.
**Why it happens:** Each individual quote or metrics request counts against the daily limit.
**How to avoid:** (1) Batch quote requests: `/api/v3/quote/AAPL,MSFT,GOOGL,...` supports comma-separated symbols in a single request. (2) Batch in groups of ~30 symbols per request (URL length safety). (3) Total API calls per sync should be ~4-5 (120 symbols / 30 per batch) + 1 (forex) = ~5 requests. (4) Cache in database -- if data for today already exists, skip the FMP call.
**Warning signs:** Running out of API budget before end of day; sync returning partial results.

### Pitfall 3: Big.js Division Precision
**What goes wrong:** Division in Big.js respects the `DP` (decimal places) setting, defaulting to 20. If you set `DP = 2` globally, intermediate calculations lose precision.
**Why it happens:** Developers set DP to 2 thinking it matches "2 decimal places for currency display."
**How to avoid:** Leave `Big.DP = 20` (default) for all intermediate calculations. Only use `.toFixed(2)` at the final display boundary. Never round intermediate values.
**Warning signs:** Holdings calculations that don't match broker statements by fractions of a penny.

### Pitfall 4: Pool Reset on Zero Shares
**What goes wrong:** After fully selling a position (shares = 0), the average cost from the previous pool carries over to the next buy.
**Why it happens:** Code tracks `avgCost` as a persistent variable instead of resetting the pool.
**How to avoid:** When shares reach 0 (or go negative due to data issues), reset both `shares` and `totalCost` to 0. The next buy starts a fresh pool. Check for `pool.shares.lte(0)` after every sell.
**Warning signs:** Unrealised P&L that doesn't match broker's displayed average cost for positions that were fully closed and reopened.

### Pitfall 5: Transaction Sort Order for Cost Basis
**What goes wrong:** Transactions processed in wrong order produce incorrect average costs.
**Why it happens:** Database returns records in insertion order, not chronological order.
**How to avoid:** Always sort transactions by date ascending before processing through the Section 104 pool algorithm. For same-day transactions, process buys before sells (HMRC same-day rule, simplified).
**Warning signs:** Negative pool costs or shares; average costs that don't match expectations.

### Pitfall 6: NocoDB PATCH Endpoint Format
**What goes wrong:** PATCH requests to `/api/v2/tables/{tableId}/records/{recordId}` return 404.
**Why it happens:** NocoDB v2 API requires the record Id in the request body, not the URL path.
**How to avoid:** Always PATCH to `/api/v2/tables/{tableId}/records` with `{ Id: rowId, ...updates }` in the body. The existing `updateRecord` function in `nocodb.ts` already does this correctly.
**Warning signs:** 404 errors on PATCH operations despite records existing.

### Pitfall 7: Stale Sidebar Timestamp
**What goes wrong:** The "Last synced" timestamp doesn't update after sync completes without a page refresh.
**Why it happens:** Server Components don't re-render on client-side data changes.
**How to avoid:** Store last-synced timestamp in a SWR cache key. After sync mutation completes, SWR's `mutate()` revalidates the cache, updating the timestamp display. The sidebar sync section should be a Client Component using `useSWR` to poll the last-synced value.
**Warning signs:** User sees stale "Last synced: 2 hours ago" after clicking Sync Now.

## Code Examples

### FMP Quote Response Shape (Verified)
```typescript
// Source: FMP API documentation + GitHub examples
// GET /api/v3/quote/AAPL?apikey=KEY
// Returns array of quote objects

interface FMPQuote {
  symbol: string
  name: string
  price: number
  changesPercentage: number
  change: number
  dayLow: number
  dayHigh: number
  yearHigh: number
  yearLow: number
  marketCap: number
  priceAvg50: number
  priceAvg200: number
  volume: number
  avgVolume: number
  exchange: string
  open: number
  previousClose: number
  eps: number
  pe: number
  earningsAnnouncement: string | null
  sharesOutstanding: number
  timestamp: number
}
```

### FMP Forex Response Shape
```typescript
// GET /api/v3/fx/USDGBP?apikey=KEY
// Returns array with single forex quote

interface FMPForexQuote {
  ticker: string    // "USD/GBP"
  bid: number
  ask: number
  open: number
  low: number
  high: number
  changes: number
  date: string      // ISO date string
}
```

### FMP Key Metrics TTM Shape (Partial -- free tier may restrict)
```typescript
// GET /api/v3/key-metrics-ttm/AAPL?apikey=KEY
// May return 403 or empty for non-sample symbols on free tier

interface FMPKeyMetricsTTM {
  symbol: string
  peRatioTTM: number | null
  pegRatioTTM: number | null
  dividendYieldTTM: number | null
  revenuePerShareTTM: number | null
  netIncomePerShareTTM: number | null
  operatingCashFlowPerShareTTM: number | null
  freeCashFlowPerShareTTM: number | null
  cashPerShareTTM: number | null
  bookValuePerShareTTM: number | null
  debtToEquityTTM: number | null
  currentRatioTTM: number | null
  returnOnEquityTTM: number | null
  returnOnAssetsTTM: number | null
  // Many more fields -- implementation should store what's available
}
```

### Extending SymbolRecord for Extended Metrics
```typescript
// The existing SymbolRecord already has core fields (current_price, pe_ratio, etc.)
// Add extended metrics as nullable fields in NocoDB symbols table

// Additional fields to add to NocoDB symbols table:
//   forward_pe: number | null
//   peg_ratio: number | null
//   revenue_growth: number | null
//   earnings_growth: number | null
//   roe: number | null
//   debt_to_equity: number | null
//   free_cash_flow_per_share: number | null
//   book_value_per_share: number | null
//   price_avg_50: number | null
//   price_avg_200: number | null
//   usd_gbp_rate: number | null          -- stored per sync for FX conversion
//   last_fundamentals_update: string | null
```

### Big.js Arithmetic Pattern for Holdings
```typescript
import Big from "big.js"

// Weighted average cost basis (Section 104 pool)
function section104Pool(transactions: TransactionRecord[]): {
  shares: Big
  totalCost: Big
  avgCost: Big
  realisedPnl: Big
} {
  let shares = new Big(0)
  let totalCost = new Big(0)
  let realisedPnl = new Big(0)

  // MUST sort by date ascending
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const tx of sorted) {
    const txShares = new Big(tx.shares)
    const txAmount = new Big(tx.amount)

    if (tx.type === "Buy") {
      shares = shares.plus(txShares)
      totalCost = totalCost.plus(txAmount)
    } else {
      // Sell: proportional cost reduction
      if (shares.eq(0)) continue
      const avgCost = totalCost.div(shares)
      const costOfSold = avgCost.times(txShares)
      realisedPnl = realisedPnl.plus(txAmount.minus(costOfSold))

      shares = shares.minus(txShares)
      totalCost = totalCost.minus(costOfSold)

      // Pool reset on full disposal
      if (shares.lte(0)) {
        shares = new Big(0)
        totalCost = new Big(0)
      }
    }
  }

  const avgCost = shares.gt(0) ? totalCost.div(shares) : new Big(0)
  return { shares, totalCost, avgCost, realisedPnl }
}

// Convert Big to display number at the boundary
function toDisplay2dp(value: Big): number {
  return Number(value.toFixed(2))
}
```

### SWR Last-Synced Polling
```typescript
// src/hooks/use-last-synced.ts
"use client"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useLastSynced() {
  const { data, mutate } = useSWR("/api/sync/status", fetcher, {
    refreshInterval: 60_000, // Poll every 60s for auto-sync check
  })
  return {
    lastSynced: data?.lastSynced as string | null,
    revalidate: mutate,
  }
}
```

### NocoDB Bulk Update for Symbol Prices
```typescript
// After FMP sync, bulk-update all symbols in NocoDB
async function updateSymbolPrices(
  quotes: FMPQuote[],
  symbolMap: Map<string, number>, // symbol -> NocoDB row Id
): Promise<void> {
  const updates = quotes
    .filter(q => symbolMap.has(q.symbol))
    .map(q => ({
      Id: symbolMap.get(q.symbol)!,
      current_price: q.price,
      previous_close: q.previousClose,
      change_pct: q.changesPercentage,
      day_high: q.dayHigh,
      day_low: q.dayLow,
      year_high: q.yearHigh,
      year_low: q.yearLow,
      market_cap: q.marketCap,
      pe_ratio: q.pe,
      eps: q.eps,
      avg_volume: q.avgVolume,
      last_price_update: new Date().toISOString(),
    }))

  // Bulk update in chunks (NocoDB handles array bodies)
  await updateRecords("symbols", updates)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Python sync script | Next.js route handler (server-side JS) | Context decision | One language, shared types, no separate Python runtime needed |
| Individual fetch per symbol | Batch quote endpoint (comma-separated) | FMP API has always supported this | ~5 API calls instead of ~120 per sync |
| TanStack Query (React Query) v5 | SWR v2.4 with useSWRMutation | SWR 2.0 (Dec 2022) added useSWRMutation | Lighter bundle, Vercel-native, sufficient for this use case |
| Polling for sync progress | ReadableStream + NDJSON streaming | Next.js 13+ route handlers | Real-time "Syncing 45/120..." without WebSockets |
| manual mutate() calls | useSWRMutation with automatic revalidation | SWR 2.0 | Cleaner mutation-then-revalidate pattern |

**Deprecated/outdated:**
- FMP v3 legacy batch endpoint (`/api/v3/stock/list`) -- use `/api/v3/quote/{symbols}` for real-time data
- SWR 1.x `mutate()` pattern -- replaced by `useSWRMutation` hook in SWR 2.0+
- NocoDB API v1 `/api/v1/db/data/` paths -- the project uses v2 `/api/v2/tables/` exclusively

## Open Questions

1. **FMP Free Tier Symbol Coverage for Extended Fundamentals**
   - What we know: The `/api/v3/quote` endpoint appears to work for all US symbols. The `/api/v3/key-metrics-ttm` endpoint may be restricted to ~87 sample symbols on the free tier.
   - What's unclear: Exact symbol list available on free tier for fundamental metrics. FMP's documentation is vague about per-endpoint symbol restrictions.
   - Recommendation: Implement extended fundamentals fetch with graceful fallback. Try the request; if it fails (403 or empty), store null and move on. Log which symbols failed for monitoring. This can be validated during implementation.

2. **NocoDB Bulk Operation Batch Size Limits**
   - What we know: NocoDB v2 API accepts array bodies for both POST (create) and PATCH (update). The existing client uses single-record operations.
   - What's unclear: Maximum array size for a single bulk request. No documented limit found.
   - Recommendation: Batch in groups of 50 records per request as a safe default. If issues arise, reduce batch size. 120 symbols / 50 = 3 requests, which is still efficient.

3. **Auto-Sync Implementation Strategy**
   - What we know: Context specifies auto-sync when prices are >4 hours old, and after US market close.
   - What's unclear: Whether to use a cron job (Vercel cron / external), on-page-visit trigger, or both.
   - Recommendation: Use on-visit trigger as the primary mechanism (check last-synced timestamp on page load via SWR, trigger sync if stale). Add Vercel cron as a secondary mechanism for daily 9PM UK sync. On-visit is simpler and doesn't require external cron infrastructure.

4. **Dividend Yield Source**
   - What we know: The FMP quote response includes `pe` and `eps` but the search results didn't confirm `dividendYield` as a direct quote field.
   - What's unclear: Whether dividend yield comes from the quote endpoint or requires a separate company-profile/key-metrics call.
   - Recommendation: Check the actual FMP API response during implementation. If not in quote, it may be in `/api/v3/profile/{symbol}` or `/api/v3/key-metrics-ttm/{symbol}`. Handle gracefully either way.

5. **LSE (London Stock Exchange) Symbol Format**
   - What we know: User has GBP-denominated stocks. FMP may use different ticker formats for LSE stocks (e.g., "VOD.L" vs "VOD.LON").
   - What's unclear: Exact format FMP uses for LSE tickers and whether the free tier covers non-US exchanges.
   - Recommendation: During implementation, test with known LSE symbols. FMP pricing page suggests US-only on free tier, so LSE symbols may not have live prices. Document this as a known limitation and handle gracefully.

## Sources

### Primary (HIGH confidence)
- [FMP API Documentation](https://site.financialmodelingprep.com/developer/docs) - endpoint URLs, response shapes, pricing tiers
- [FMP GitHub API Reference](https://github.com/FinancialModelingPrepAPI/Financial-Modeling-Prep-API) - complete endpoint list, confirmed 250/day free tier with access to most endpoints
- [big.js API Reference](https://mikemcl.github.io/big.js/) - complete API: arithmetic, comparison, rounding, conversion methods
- [SWR Official Docs](https://swr.vercel.app/docs/mutation) - useSWRMutation, trigger(), isMutating, revalidation patterns
- [Next.js Route Handlers Docs](https://nextjs.org/docs/app/getting-started/route-handlers) - POST handler creation, supported methods, caching behavior
- [NocoDB API v2 Bug Discussion](https://github.com/nocodb/nocodb/issues/11722) - confirmed PATCH format with Id in body, bulk support
- [HMRC CRYPTO22251](https://www.gov.uk/hmrc-internal-manuals/cryptoassets-manual/crypto22251) - Section 104 pool algorithm with worked example

### Secondary (MEDIUM confidence)
- [SWR vs TanStack Query Comparison (LogRocket, 2025)](https://blog.logrocket.com/swr-vs-tanstack-query-react/) - mutation capabilities comparison, cache invalidation patterns
- [SWR vs TanStack Query (Refine, 2025)](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/) - bundle size comparison (5.3KB vs 16.2KB), DevTools, Next.js integration
- [FMP Pricing Page](https://site.financialmodelingprep.com/pricing-plans) - 250 calls/day, ~87 sample symbols for some endpoints, US stock coverage
- [Next.js Streaming Tutorial (DEV.to)](https://dev.to/arfatapp/tutorial-streaming-responses-in-nextjs-with-function-yield-and-readablestream-3bna) - ReadableStream pattern for route handlers
- [NocoDB Table Scripting API](https://nocodb.com/docs/scripts/api-reference/table) - createRecordsAsync, updateRecordsAsync bulk methods

### Tertiary (LOW confidence)
- [FMP Quote Response JSON Shape](https://site.financialmodelingprep.com/how-to/how-to-pull-stock-information-using-the-fmp-api-with-python) - verified quote fields but from tutorial, not official schema docs
- FMP key-metrics-ttm field names - inferred from training data and naming conventions; exact fields need validation against live API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - big.js and SWR are well-documented, stable, widely used. Versions verified.
- Architecture: HIGH - Route handler patterns, streaming, SWR hooks are well-established Next.js patterns.
- FMP API: MEDIUM - Endpoint URLs and quote fields verified, but free tier symbol restrictions and extended metrics need live validation.
- NocoDB bulk operations: MEDIUM - Confirmed array body support for v2 API, but batch size limits undocumented.
- Section 104 calculations: HIGH - Algorithm is well-defined by HMRC with worked examples. Implementation pattern is straightforward with Big.js.
- Pitfalls: HIGH - Based on verified documentation and known issues (NocoDB PATCH format, Big.js DP setting, FMP rate limits).

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days -- stable domain, libraries mature)
