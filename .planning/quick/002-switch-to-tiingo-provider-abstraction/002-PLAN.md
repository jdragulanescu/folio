---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/providers/types.ts
  - src/lib/providers/tiingo.ts
  - src/lib/providers/index.ts
  - src/lib/sync.ts
  - .env.example
autonomous: true

must_haves:
  truths:
    - "Price sync fetches stock quotes from Tiingo IEX endpoint, not FMP"
    - "Price sync fetches USD/GBP forex rate from Tiingo forex endpoint, not FMP"
    - "Provider abstraction allows swapping providers via a single import change"
    - "changesPercentage is computed as (last - prevClose) / prevClose * 100 since Tiingo lacks it"
    - "Fields unavailable from Tiingo IEX (yearHigh, yearLow, marketCap, pe, eps, avgVolume, priceAvg50, priceAvg200) are null"
  artifacts:
    - path: "src/lib/providers/types.ts"
      provides: "Provider-agnostic StockQuote, ForexRate, and PriceProvider interfaces"
      exports: ["StockQuote", "ForexRate", "PriceProvider"]
    - path: "src/lib/providers/tiingo.ts"
      provides: "Tiingo implementation of PriceProvider"
      exports: ["TiingoProvider"]
    - path: "src/lib/providers/index.ts"
      provides: "Active provider singleton export"
      exports: ["provider"]
    - path: "src/lib/sync.ts"
      provides: "Sync orchestrator using provider abstraction"
  key_links:
    - from: "src/lib/providers/tiingo.ts"
      to: "src/lib/providers/types.ts"
      via: "implements PriceProvider interface"
      pattern: "implements PriceProvider"
    - from: "src/lib/providers/index.ts"
      to: "src/lib/providers/tiingo.ts"
      via: "instantiates TiingoProvider as active provider"
      pattern: "new TiingoProvider"
    - from: "src/lib/sync.ts"
      to: "src/lib/providers/index.ts"
      via: "imports provider singleton"
      pattern: "from.*[\"'].*providers"
---

<objective>
Replace FMP with Tiingo as the price data provider, behind a provider-agnostic abstraction layer.

Purpose: FMP free tier no longer supports batch quotes or forex (402 Restricted Endpoint). Tiingo's free tier covers our needs (IEX quotes + forex). The abstraction layer future-proofs against provider changes.

Output: Working price sync using Tiingo API, with a clean provider interface that makes adding new providers trivial.
</objective>

<execution_context>
@/Users/skylight/.claude/sky/workflows/execute-plan.md
@/Users/skylight/.claude/sky/templates/summary.md
</execution_context>

<context>
@src/lib/fmp.ts
@src/lib/fmp-types.ts
@src/lib/sync.ts
@src/lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create provider abstraction types and Tiingo implementation</name>
  <files>
    src/lib/providers/types.ts
    src/lib/providers/tiingo.ts
    src/lib/providers/index.ts
  </files>
  <action>
    Create `src/lib/providers/types.ts` with these interfaces:

    **StockQuote** -- provider-agnostic quote shape matching what sync.ts needs:
    - `symbol: string` -- ticker
    - `price: number` -- current/last price
    - `previousClose: number`
    - `changesPercentage: number` -- daily change % (provider computes if API lacks it)
    - `dayHigh: number`
    - `dayLow: number`
    - `yearHigh: number | null` -- null if provider lacks it
    - `yearLow: number | null`
    - `marketCap: number | null`
    - `pe: number | null`
    - `eps: number | null`
    - `avgVolume: number | null`
    - `priceAvg50: number | null`
    - `priceAvg200: number | null`
    - `volume: number`

    **ForexRate** -- provider-agnostic forex shape:
    - `pair: string` -- e.g. "USDGBP"
    - `rate: number` -- exchange rate

    **PriceProvider** -- interface contract:
    - `fetchBatchQuotes(symbols: string[]): Promise<StockQuote[]>`
    - `fetchForexRate(pair?: string): Promise<ForexRate>`

    Create `src/lib/providers/tiingo.ts`:
    - `import "server-only"` at top (protects API token)
    - Export class `TiingoProvider implements PriceProvider`
    - Read token from `process.env.TIINGO_API_TOKEN` (throw clear error if missing)
    - Auth via `Authorization: Token ${token}` header on every request (NOT query param)
    - Internal `tiingoFetch<T>(url: string): Promise<T>` helper with `cache: "no-store"`, error handling matching fmp.ts pattern (throw on non-ok with status + body)

    **fetchBatchQuotes implementation:**
    - Tiingo IEX supports up to 100 tickers per request, but keep BATCH_SIZE at 30 for safety (matches existing pattern)
    - Endpoint: `https://api.tiingo.com/iex/?tickers=${batch.join(",")}` for each batch
    - Map Tiingo IEX response to StockQuote:
      - `symbol` = response `ticker` (Tiingo uses "ticker" not "symbol")
      - `price` = response `last` (last sale price)
      - `previousClose` = response `prevClose`
      - `changesPercentage` = COMPUTE: `prevClose !== 0 ? ((last - prevClose) / prevClose) * 100 : 0` (Tiingo does NOT return this field)
      - `dayHigh` = response `high`
      - `dayLow` = response `low`
      - `volume` = response `volume`
      - `yearHigh`, `yearLow`, `marketCap`, `pe`, `eps`, `avgVolume`, `priceAvg50`, `priceAvg200` = all `null` (not available from Tiingo IEX)

    **fetchForexRate implementation:**
    - Default pair: `"USDGBP"` (same as FMP)
    - Endpoint: `https://api.tiingo.com/tiingo/fx/top?tickers=${pair.toLowerCase()}`
    - Tiingo forex pair format: lowercase, no slash (e.g., "usdgbp")
    - Map response: `rate` = response `midPrice` (average of bid/ask, conservative)
    - `pair` = input pair uppercased for consistency
    - Throw if response array is empty

    Create `src/lib/providers/index.ts`:
    - Import TiingoProvider
    - Export a singleton: `export const provider: PriceProvider = new TiingoProvider()`
    - Re-export types: `export type { StockQuote, ForexRate, PriceProvider } from "./types"`
    - This is the single import point for sync.ts and any future consumers

    Define Tiingo response types locally in tiingo.ts (private, not exported) since they're only used for JSON parsing inside the provider:
    - `TiingoIEXQuote` with fields: ticker, timestamp, last, lastSize, tngoLast, prevClose, open, high, low, mid, volume, bidSize, bidPrice, askSize, askPrice
    - `TiingoForexQuote` with fields: ticker, quoteTimestamp, bidPrice, bidSize, askPrice, askSize, midPrice
  </action>
  <verify>
    Run `pnpm tsc --noEmit` from project root -- must pass with no errors.
    Run `pnpm lint` from project root -- must pass.
  </verify>
  <done>
    Three new files exist under src/lib/providers/. PriceProvider interface defines the contract. TiingoProvider implements it with correct endpoint URLs, auth headers, field mappings, and computed changesPercentage. Provider index exports a ready-to-use singleton.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewire sync.ts to use provider abstraction and update .env.example</name>
  <files>
    src/lib/sync.ts
    .env.example
  </files>
  <action>
    **Update src/lib/sync.ts:**

    1. Replace the FMP import:
       - REMOVE: `import { fetchBatchQuotes, fetchForexRate } from "./fmp"`
       - ADD: `import { provider } from "./providers"`
       - ADD: `import type { StockQuote } from "./providers"`

    2. In the batch processing loop, replace `fetchBatchQuotes(batch)` with `provider.fetchBatchQuotes(batch)`.
       The returned StockQuote interface has the SAME field names that sync.ts already uses (symbol, price, previousClose, changesPercentage, dayHigh, dayLow, yearHigh, yearLow, marketCap, pe, eps, avgVolume, priceAvg50, priceAvg200, volume), so the mapping code in the symbolUpdates and historyRecords blocks does NOT need to change.

    3. In the forex section, replace `fetchForexRate("USDGBP")` with `provider.fetchForexRate("USDGBP")`.
       Update the rate extraction: was `forexRate.price`, now `forexRate.rate`.
       Line ~179: change `String(forexRate.price)` to `String(forexRate.rate)`.

    4. Update the file header comment to mention "provider abstraction" instead of "FMP fetch".

    5. Remove the BATCH_SIZE constant from sync.ts (line ~37). Batching is now the provider's responsibility. Remove the batch loop that splits tickers into groups of 30 -- instead call `provider.fetchBatchQuotes(tickers)` ONCE with all tickers. The provider handles batching internally.

       This means restructuring the main loop: instead of iterating batches of 30, call fetchBatchQuotes once and then do a single bulk update. Keep the try/catch for error handling. Keep the progress events but simplify -- emit "start", then after the single fetch, emit "progress" at 100%, then proceed to forex and "complete".

       Actually -- to preserve partial-failure resilience and progress streaming, keep the batch approach in sync.ts but delegate batch sizing to the caller. Here's the cleaner approach:
       - Keep BATCH_SIZE = 30 in sync.ts (this is the sync orchestrator's batch size, not the provider's)
       - Keep the for loop that iterates batches
       - Inside each batch iteration, call `provider.fetchBatchQuotes(batch)` (the provider receives only 30 tickers and returns quotes for those)
       - This preserves: partial failure (one batch fails, others continue), progress events per batch, same UX

    6. Update the type annotation for `quotes` from implicit FMPQuote[] to explicit StockQuote[].

    **Update .env.example:**
    - Add a new section below the Table IDs section:
      ```
      # Price Data Provider (Tiingo)
      TIINGO_API_TOKEN=your_tiingo_api_token
      ```
    - Keep the existing FMP_API_KEY line if present (it may not be in .env.example currently -- if not, don't add it). Actually, .env.example does NOT have FMP_API_KEY currently, so just add the Tiingo section.

    Note: Do NOT remove or modify src/lib/fmp.ts or src/lib/fmp-types.ts. They stay as dead code in case the user upgrades to FMP paid tier later.
  </action>
  <verify>
    Run `pnpm tsc --noEmit` from project root -- must pass with no errors.
    Run `pnpm lint` from project root -- must pass.
    Verify sync.ts no longer imports from "./fmp": `rg "from.*fmp" src/lib/sync.ts` should return nothing.
    Verify sync.ts imports from providers: `rg "from.*providers" src/lib/sync.ts` should match.
    Verify .env.example contains TIINGO_API_TOKEN.
  </verify>
  <done>
    sync.ts imports from provider abstraction, not FMP directly. ForexRate uses .rate field. .env.example documents the TIINGO_API_TOKEN env var. FMP files remain untouched as dormant code. Typecheck and lint pass.
  </done>
</task>

</tasks>

<verification>
1. `pnpm tsc --noEmit` passes -- all types align across providers/types.ts, providers/tiingo.ts, providers/index.ts, and sync.ts
2. `pnpm lint` passes -- no lint errors in new or modified files
3. `rg "from.*fmp" src/lib/sync.ts` returns nothing -- sync.ts fully decoupled from FMP
4. `rg "from.*providers" src/lib/sync.ts` matches -- sync.ts uses abstraction
5. `rg "TIINGO_API_TOKEN" .env.example` matches -- env var documented
6. Files exist: src/lib/providers/types.ts, src/lib/providers/tiingo.ts, src/lib/providers/index.ts
7. src/lib/fmp.ts and src/lib/fmp-types.ts are unchanged (verify with `git diff src/lib/fmp.ts` showing no changes)
</verification>

<success_criteria>
- Provider abstraction layer exists with StockQuote, ForexRate, and PriceProvider interfaces
- TiingoProvider correctly maps IEX quotes and forex responses to unified schema
- changesPercentage is computed from (last - prevClose) / prevClose * 100
- Fields unavailable from Tiingo (yearHigh, yearLow, marketCap, pe, eps, avgVolume, priceAvg50, priceAvg200) are null
- sync.ts uses provider abstraction exclusively -- zero FMP imports
- Forex rate uses midPrice from Tiingo
- Adding a new provider requires: implement PriceProvider interface, swap the singleton in index.ts
- All code typechecks and lints clean
</success_criteria>

<output>
After completion, create `.planning/quick/002-switch-to-tiingo-provider-abstraction/002-SUMMARY.md`
</output>
