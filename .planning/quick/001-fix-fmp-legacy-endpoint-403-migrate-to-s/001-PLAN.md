---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/fmp.ts
  - src/lib/fmp-types.ts
  - src/lib/sync.ts
autonomous: true

must_haves:
  truths:
    - "FMP batch quote requests return live stock prices without 403 errors"
    - "FMP forex rate requests return USD/GBP exchange rate without 403 errors"
    - "FMP key metrics requests return TTM metrics without 403 errors"
    - "Sync pipeline stores forex rate correctly using new response shape"
  artifacts:
    - path: "src/lib/fmp.ts"
      provides: "FMP client using /stable/ endpoints"
      contains: "/stable/"
    - path: "src/lib/fmp-types.ts"
      provides: "Updated FMPForexQuote interface matching stable endpoint response"
      contains: "price"
    - path: "src/lib/sync.ts"
      provides: "Sync pipeline using forexRate.price instead of forexRate.bid"
      contains: "forexRate.price"
  key_links:
    - from: "src/lib/fmp.ts"
      to: "FMP /stable/ API"
      via: "fmpFetch URL construction"
      pattern: "/stable/"
    - from: "src/lib/sync.ts"
      to: "src/lib/fmp-types.ts"
      via: "FMPForexQuote.price field access"
      pattern: "forexRate\\.price"
---

<objective>
Migrate all FMP API calls from deprecated /api/v3/ endpoints to /stable/ endpoints.

Purpose: FMP deprecated /api/v3/ endpoints for non-legacy users after Aug 31, 2025. All three endpoints (batch quote, forex, key metrics TTM) return 403 errors with "Legacy Endpoint" message, breaking the entire price sync pipeline.

Output: Working FMP integration using /stable/ endpoints with updated type definitions.
</objective>

<execution_context>
@/Users/skylight/.claude/sky/workflows/execute-plan.md
@/Users/skylight/.claude/sky/templates/summary.md
</execution_context>

<context>
@src/lib/fmp.ts
@src/lib/fmp-types.ts
@src/lib/sync.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate FMP endpoints and update types</name>
  <files>src/lib/fmp.ts, src/lib/fmp-types.ts, src/lib/sync.ts</files>
  <action>
  Three changes across three files:

  **1. src/lib/fmp.ts — Update all three endpoint paths:**

  - `fetchBatchQuotes`: Change `/api/v3/quote/${symbolStr}` to `/stable/batch-quote?symbols=${symbolStr}`.
    The symbols move from a path segment to a query parameter. Note: fmpFetch already handles the `?` vs `&` separator for apikey — since the path now contains `?`, fmpFetch will correctly use `&` for the apikey.

  - `fetchForexRate`: Change `/api/v3/fx/${pair}` to `/stable/quote?symbol=${pair}`.
    The stable API uses the same quote endpoint for forex pairs. The pair moves from path to query parameter.

  - `fetchKeyMetricsTTM`: Change `/api/v3/key-metrics-ttm/${symbol}` to `/stable/key-metrics-ttm?symbol=${symbol}`.
    The symbol moves from path to query parameter.

  **2. src/lib/fmp-types.ts — Update FMPForexQuote interface:**

  Replace the current FMPForexQuote interface with the new stable response shape:

  ```typescript
  export interface FMPForexQuote {
    symbol: string
    price: number
    change: number
    changePercentage: number
    previousClose: number
    dayLow: number
    dayHigh: number
    yearLow: number
    yearHigh: number
    volume: number
    open: number
    priceAvg50: number
    priceAvg200: number
    timestamp: number
    exchange: string
  }
  ```

  Update the section comment from `GET /api/v3/fx/{pair}` to `GET /stable/quote?symbol={pair}`.
  Also update the other two section comments:
  - Quote comment: `GET /api/v3/quote/{symbols}` to `GET /stable/batch-quote?symbols={symbols}`
  - Key Metrics comment: `GET /api/v3/key-metrics-ttm/{symbol}` to `GET /stable/key-metrics-ttm?symbol={symbol}`

  **3. src/lib/sync.ts — Update forex field access:**

  Line 179: Change `String(forexRate.bid)` to `String(forexRate.price)`. The stable forex endpoint returns the rate in the `price` field instead of `bid`.

  **What to avoid and why:**
  - Do NOT change the FMPQuote interface — the stable batch-quote endpoint returns the same field names as v3.
  - Do NOT change the FMPKeyMetricsTTM interface — the stable key-metrics-ttm endpoint returns the same field names as v3.
  - Do NOT change any logic in sync.ts beyond the `forexRate.bid` → `forexRate.price` swap.
  - Do NOT change fmpFetch itself — it already handles `?` detection for apikey appending.
  </action>
  <verify>
  1. Run `npx tsc --noEmit` — must pass with zero errors (confirms FMPForexQuote shape matches all usages).
  2. Run `npx next lint` — must pass.
  3. Grep for `/api/v3/` in src/lib/ — must return zero matches (confirms no legacy endpoints remain).
  </verify>
  <done>
  All three FMP endpoints use /stable/ paths. FMPForexQuote interface matches stable response shape. sync.ts reads `forexRate.price` instead of `forexRate.bid`. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero type errors
2. `npx next lint` passes
3. No occurrences of `/api/v3/` remain in `src/lib/fmp.ts` or `src/lib/fmp-types.ts`
4. `forexRate.bid` no longer referenced anywhere in `src/lib/sync.ts`
</verification>

<success_criteria>
- All FMP API calls use /stable/ endpoints
- FMPForexQuote interface matches the stable quote response shape
- sync.ts uses forexRate.price for forex rate storage
- TypeScript compiles without errors
- Linting passes
</success_criteria>

<output>
After completion, create `.planning/quick/001-fix-fmp-legacy-endpoint-403-migrate-to-s/001-SUMMARY.md`
</output>
