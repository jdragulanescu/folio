# Project Research Summary

**Project:** Folio - Personal Investment Tracking Dashboard
**Domain:** Financial portfolio management (stocks + options wheel/LEAPS, multi-broker, UK tax)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

Folio is a personal investment tracking dashboard replacing an Apple Numbers spreadsheet that currently tracks ~120 symbols across 6 brokers, ~964 stock transactions, ~200 options trades (wheel strategy + LEAPS), deposits, dividends, and UK tax estimates. The research reveals this is a data-intensive dashboard application requiring precise financial calculations, real-time pricing, and complex portfolio analytics. The recommended approach uses Next.js 16 (App Router with Server Components) for the frontend, NocoDB as a self-hosted backend/API layer, and FMP API for live stock pricing.

The architecture follows a server-first pattern: Server Components fetch from NocoDB and compute heavy calculations (holdings aggregation, P&L, tax estimates) on the server, passing serialized data to Client Components for interactive rendering (charts, sortable tables, forms). This keeps API credentials server-side and eliminates client-side data fetching complexity. Python scripts handle one-time migration from Apple Numbers and daily price sync cron jobs. The stack is modern, stable, and well-documented with high confidence.

Key risks center on financial precision (floating-point arithmetic errors), UK tax compliance (Section 104 pooling rules are complex), NocoDB performance (N+1 query waterfalls), and options accounting (assignment transactions must auto-create stock entries to avoid phantom holdings). Mitigation requires using decimal libraries (Big.js) for all money math, implementing proper UK CGT share matching rules with clear disclaimers until validated, parallel data fetching with Promise.all, and automated transaction generation when options are assigned. The data migration script is the foundation — if the 964 transactions and 200 options migrate incorrectly, every subsequent calculation will be wrong.

## Key Findings

### Recommended Stack

The research identifies a modern, stable stack built on Next.js 16 with React 19, leveraging Server Components for security and performance. NocoDB provides a self-hosted REST API backend that eliminates the need for a custom server, while FMP API supplies live pricing within free tier limits. The stack emphasizes server-first rendering, minimal client JavaScript, and type safety throughout.

**Core technologies:**
- **Next.js 16.2.x** (App Router, Server Components, Turbopack) — Latest stable with React 19 foundation. Server Components keep NocoDB/FMP API keys server-side, critical for security. Cache Components with `use cache` for performance.
- **NocoDB 0.301.x** (self-hosted REST API) — Already running. Provides database + REST API in one, eliminating need for separate backend. v2 endpoints with `xc-token` auth. Tables: symbols, transactions, options, deposits, dividends, monthly_snapshots, price_history, settings.
- **FMP API v3** — Live stock pricing. Free tier allows ~3 calls per sync (120 symbols / 50 per batch). Batch quote endpoint for efficient bulk fetching.
- **Python 3.12+** — Migration script (numbers-parser to read Apple Numbers) and daily price sync cron. Separate tooling outside Next.js project.
- **TypeScript 5.7.x** + Tailwind CSS v4 + shadcn/ui — Type safety, modern styling, component library with unified radix-ui primitives.
- **Recharts 3.7.x** — Declarative SVG charts for portfolio allocation, performance over time, options premium tracking.
- **Zod 4 + react-hook-form 7.71.x** — Form validation (client and server), type-safe API route inputs.
- **Big.js** — Critical addition for decimal arithmetic in financial calculations (not in original plan but required by research to avoid floating-point errors).

**Critical version notes:**
- Tailwind v4 uses CSS-first config (`@theme` directive), no `tailwind.config.js`
- shadcn/ui unified `radix-ui` package (Feb 2026 update), not individual `@radix-ui/react-*` packages
- Use `tw-animate-css` (not deprecated `tailwindcss-animate`)

### Expected Features

The research categorizes features into three tiers based on user expectations and competitive analysis. The spreadsheet replacement (v1 MVP) must deliver live prices, holdings calculation, transaction/options history, and data entry forms. Differentiators (v1.x) include unified stock+options portfolio view, UK tax estimates, and wheel strategy analytics — features not available in generic trackers like Ghostfolio or Sharesight. Anti-features are explicitly rejected to avoid scope creep (broker API auto-import, real-time streaming prices, automated rebalancing).

**Must have (table stakes):**
- Holdings overview with live prices, cost basis, P&L per symbol, portfolio weight
- Multi-broker support (6 platforms with per-broker P&L tracking)
- Transaction history (searchable, sortable, filterable — 964+ rows)
- Options trades tables: Wheel (164 trades) and LEAPS (36 positions) with full lifecycle tracking
- Wheel aggregate stats (premium collected, win rate, average return, annualized return)
- Deposit tracking by month and platform
- Dividend tracking by symbol with annual totals
- Monthly performance snapshots (historical portfolio value chart)
- Add transaction form, add options form, manual price sync trigger
- Dark theme (finance dashboards are dark by default)

**Should have (competitive):**
- **Unified stocks + options portfolio view** — Killer feature. Shows LEAPS market value alongside stock holdings in allocation charts. No mainstream tracker does this.
- **UK tax estimates** (income + dividend + CGT) — Saves end-of-year scrambling. Generic trackers don't support UK tax or charge for it.
- **Wheel strategy cycle tracking** — Dedicated analytics inside the portfolio tracker eliminates context-switching to TrackTheta/Wheelytics.
- **Annualized return per options trade** — Time-normalized performance metric most spreadsheets lack.
- **Dividend income goal tracking** — Progress bar toward annual target with forward projection.
- **Options expiration calendar** — Visual timeline of upcoming expirations with urgency indicators (green >30d, amber 7-30d, red <7d).
- **Per-broker P&L breakdown** — See which broker is performing best.
- **Benchmark comparison** (portfolio vs S&P 500) — Validates active management effort.
- **Top movers** (gainers/losers today and overall) — Quick insight without scanning full holdings table.

**Defer (v2+):**
- Full Section 104 CGT calculation (complex HMRC share matching rules — build when approaching first tax deadline)
- Benchmark comparison (requires accumulated price_history data over time)
- Forward dividend projection (needs dividend_yield from FMP)
- CSV import for transactions (only if manual entry becomes burdensome)

**Anti-features (deliberately excluded):**
- Broker API auto-import — Too fragile, rate-limited, 6 brokers = 6x complexity. One-time migration + manual forms is sufficient.
- Real-time streaming prices — FMP free tier can't support it. Daily sync is fresh enough for portfolio decisions.
- Live options pricing/Greeks — No free API. User enters LEAPS market values manually.
- Multi-currency with live FX — Adds massive complexity to every calculation. Display in native listing currency (USD for US stocks), show GBP total using single stored FX rate.
- Mobile-first responsive — Desktop analytics tool. Dense tables and multi-column layouts. Responsive enough not to break, but desktop-optimized.
- Automated rebalancing suggestions — Naive across 6 brokers with different fees, tax, and options positions. Show allocation, let user decide.

### Architecture Approach

The architecture is server-first with clear boundaries: NocoDB provides data storage and REST API, Next.js Server Components fetch and compute on the server, Client Components handle interactivity only. All API credentials stay server-side. The pattern eliminates client-side data fetching libraries (no SWR/React Query) and reduces JavaScript bundle size. Python scripts are isolated for one-time migration and daily cron sync.

**Major components:**
1. **NocoDB REST API (localhost:8080)** — Data layer. 8 tables with v2 endpoints. Auth via `xc-token` header (server-side only). Pagination via `limit`/`offset`. Filtering via `where` clause.
2. **Python migration script** — One-time import from `.numbers` file using numbers-parser. Bulk-inserts into NocoDB. Validates row counts (964 transactions, ~120 symbols, ~200 options).
3. **Python sync script** — Daily FMP price fetch (batch 50 symbols/call) + NocoDB update. Cron at 9pm UK, Mon-Fri. Also duplicated as Next.js Route Handler for UI trigger.
4. **lib/nocodb.ts** — Typed server-side API wrapper. All NocoDB HTTP calls. Uses `server-only` import guard. Handles pagination, filtering, error mapping.
5. **lib/fmp.ts** — Typed server-side pricing wrapper. Batch quote calls. Used by `/api/sync` Route Handler. Server-only.
6. **lib/calculations.ts** — Portfolio math: holdings aggregation (weighted avg cost basis), P&L, allocations, tax estimates. Pure functions, no I/O. Uses Big.js for decimal arithmetic.
7. **Server Components (pages)** — Each page is `async`, fetches from NocoDB, computes derived data, passes props to Client Components. Parallel fetching with `Promise.all()`.
8. **Route Handlers (app/api/*)** — Mutations: add transaction, sync prices, add option, close option. Validate with zod, write to NocoDB, `revalidatePath()` to refresh Server Components.
9. **Client Components** — Interactive UI: charts (Recharts), sortable tables, forms (react-hook-form + zod). Receive data via props. No direct NocoDB/FMP calls.

**Key patterns:**
- **Server Component fetches, Client Component renders:** Portfolio page fetches holdings server-side, passes to HoldingsTable (client) for sorting/filtering.
- **Route Handler mutation with path revalidation:** TransactionForm (client) POSTs to `/api/transactions` (Route Handler) which validates, writes to NocoDB, calls `revalidatePath()` to refresh affected pages.
- **Parallel data fetching:** Use `Promise.all([getSymbols(), getTransactions()])` to fetch multiple tables simultaneously, not sequentially.
- **Streaming with Suspense:** Wrap slow-loading sections (holdings calculation) in `<Suspense>` so page shell renders immediately.

**Data flow (read):** Browser → Server Component → lib/nocodb.ts → NocoDB API → lib/calculations.ts → Server renders HTML → Client Components hydrate for interactivity

**Data flow (write):** Client form → Route Handler → Validate (zod) → lib/nocodb.ts → NocoDB API → revalidatePath() → Server Components re-render

### Critical Pitfalls

The research identified 13 pitfalls (5 critical, 5 moderate, 3 minor). The critical ones require architectural decisions in Phase 1 or cause rewrites if ignored.

1. **Floating-point arithmetic in financial calculations** — JavaScript's `0.1 + 0.2 === 0.30000000000000004` compounds across 964 transactions. Use Big.js for ALL money math in `calculations.ts`. Apply rounding only at display time. Without this, portfolio totals diverge from broker statements and tax calculations are wrong.

2. **UK tax calculation ignores HMRC share matching rules** — Implementation plan uses simple average cost basis, but HMRC mandates three-step hierarchy: same-day rule → 30-day bed-and-breakfasting → Section 104 pool. Cross-broker pooling required (AAPL at IBKR + Trading 212 = ONE pool). Defer full implementation to Tax Phase with clear "ESTIMATE ONLY" disclaimers until validated against HMRC HS284 examples.

3. **NocoDB as backend creates N+1 query waterfalls** — No SQL joins. Portfolio overview needs 5+ tables (symbols, transactions, deposits, dividends, options). Without parallel fetching, this is 10+ sequential API calls (2-5 seconds page load). Mitigation: `Promise.all()` for parallel fetch, fetch all records upfront for small tables (<1000 rows), pre-compute expensive aggregations in `monthly_snapshots` table.

4. **Options assignment creates phantom stock transactions** — Put assignment = receive 100 shares at strike price. Must auto-create corresponding Buy transaction when option status changes to "Assigned," or holdings calculation will be wrong (shares exist in real portfolio but not in data). Call assignment = sell 100 shares, same issue. Implement in option close/update API endpoint.

5. **price_history table grows unbounded** — 120 symbols * 252 trading days/year = ~30,000 rows/year. NocoDB offset pagination degrades with large tables. Implement retention policy in sync script: keep daily prices for last 90 days, then weekly for older data, then monthly for 1+ year old. Prune automatically during daily sync.

**Additional critical considerations:**
- **FMP free tier bandwidth exhaustion** (500MB/30-day rolling) — Log every request with response size. Rate limit "Sync Now" button (max once per 15 min). Cache FMP responses. Avoid historical price endpoints during free tier.
- **Currency blind spot (GBP vs USD)** — All FMP prices in USD, deposits in GBP. Must fetch GBP/USD rate during each sync, store it, convert consistently. HMRC requires gains in GBP using exchange rate on transaction dates. Decide display currency (recommend GBP) in Phase 1, not later.
- **Data migration silently drops/corrupts records** — numbers-parser edge cases: EmptyCell returns None, dates before 1970, summary rows that aren't real transactions. Run migration in dry-run mode first, validate row counts (964 transactions, 164 wheel, 36 LEAPS, 74 deposit months), compare sum of transaction amounts to original spreadsheet total.

## Implications for Roadmap

Based on research, the architecture has clear dependency chains that dictate build order. The NocoDB client and migration script are the foundation — nothing works without data. Price sync is the primary upgrade over the spreadsheet. Portfolio overview and options dashboard are the core display pages. Write operations (forms + Route Handlers) enable ongoing data entry. Advanced features (tax, performance analytics, unified view) require accumulated data and stable calculations.

### Phase 1: Foundation & Data Migration
**Rationale:** Everything depends on data being in NocoDB and the server-side API client working correctly. This is the architectural skeleton on which all features hang. The migration script is one-time but critical — if 964 transactions migrate incorrectly, every calculation is wrong forever.

**Delivers:**
- NocoDB client (`lib/nocodb.ts`) with typed functions, `server-only` guard, parallel fetch support
- TypeScript types (`lib/types.ts`) for all models (Symbol, Transaction, Option, Holding, etc.)
- Python migration script: reads `.numbers` file, validates, bulk-inserts to NocoDB
- Root layout + sidebar navigation (dark theme, "Last synced" indicator)
- Environment setup (.env.local with NocoDB token, FMP key, table IDs)

**Addresses:**
- Table stakes: data must exist before any page can render
- Pitfall #8 (migration data quality) — dry-run validation, row count verification
- Pitfall #9 (API token exposure) — `server-only` guard prevents client-side leaks
- Pitfall #11 (table ID hardcoding) — store IDs in env vars, document in .env.example

**Avoids:**
- Critical Pitfall #3 (N+1 waterfalls) — design NocoDB client with `Promise.all()` support from day one
- Pitfall #9 (token in client) — `server-only` import guard in `lib/nocodb.ts`

**Research flag:** Standard patterns (Next.js server-only, NocoDB REST API well-documented). Skip phase-level research.

### Phase 2: Live Pricing & Core Calculations
**Rationale:** Live prices are the primary upgrade over the spreadsheet. Holdings calculation is the most critical computation — every portfolio view depends on it. Decimal arithmetic (Big.js) must be established here or floating-point errors compound as transaction count grows.

**Delivers:**
- FMP client (`lib/fmp.ts`) with batch quote endpoint integration
- Python sync script: fetch prices for 120 symbols in batches of 50, update NocoDB
- Daily cron job (9pm UK, Mon-Fri) for automated price refresh
- `/api/sync` Route Handler for manual "Sync Now" button
- Calculations library (`lib/calculations.ts`) with Big.js for holdings, P&L, cost basis
- Price history retention logic (prune to 90d daily, then weekly, then monthly)

**Uses:**
- Stack: FMP API (batch quote), Big.js (decimal math), Python requests + python-dotenv
- NocoDB: update `symbols` table with latest prices, insert into `price_history` table

**Addresses:**
- Table stakes: live prices are the reason to build this tool
- Pitfall #1 (floating-point errors) — Big.js for all financial calculations from day one
- Pitfall #5 (price_history growth) — retention policy built into sync script
- Pitfall #6 (FMP bandwidth) — log usage, rate limit "Sync Now" button

**Avoids:**
- Critical Pitfall #1 (floating-point arithmetic) — establish decimal library before calculations proliferate
- Pitfall #5 (unbounded table growth) — pruning logic added at creation time
- Pitfall #6 (API bandwidth exhaustion) — usage logging and rate limiting

**Research flag:** Standard patterns (FMP API documented, cron jobs well-known). Skip phase research. However, validate Big.js integration with test calculations against broker statements.

### Phase 3: Portfolio Overview Page
**Rationale:** The primary dashboard page. Depends on Phase 1 (data migration) and Phase 2 (live prices, holdings calculation). This is the "heart" of the application — if this page works, the tool replaces the spreadsheet for read-only use.

**Delivers:**
- Portfolio overview page (Server Component): fetches symbols + transactions, computes holdings
- Holdings table (Client Component): sortable, filterable, per-symbol P&L, cost basis, allocation %
- Summary cards: total portfolio value, total invested, unrealized gain/loss, day change
- Sector/strategy allocation pie charts (Recharts): group holdings by sector and strategy
- Top movers cards: best/worst performers (day and overall)

**Implements:**
- Architecture Pattern 1: Server Component fetches, Client Component renders
- Architecture Pattern 4: Parallel fetch with `Promise.all([getSymbols(), getTransactions()])`
- Calculations: `calculateHoldings(transactions, symbols)` → Holding[] with cost basis, P&L

**Addresses:**
- Table stakes: holdings overview with live prices is core functionality
- Differentiators: per-broker P&L, top movers

**Avoids:**
- Pitfall #3 (N+1 waterfalls) — parallel fetch, single-pass holdings calculation

**Research flag:** Standard dashboard patterns (Recharts examples, shadcn/ui tables). Skip phase research.

### Phase 4: Transaction & Options History
**Rationale:** Secondary display pages. Simpler than portfolio overview — just query and render. Options dashboard is independent of stock portfolio (different tables), can be built in parallel. These pages complete the read-only "spreadsheet replacement" functionality.

**Delivers:**
- Transaction history page: paginated table, sortable by date/symbol/type, filterable by platform
- Options dashboard: separate tables for Wheel (open/closed) and LEAPS
- Wheel aggregate stats cards: total premium collected, win rate, avg return, avg days held, annualized return
- LEAPS tracker: break-even price, days to expiry, current P&L (manually entered market value)
- Dividends page: by-symbol breakdown, annual total, monthly distribution
- Deposits page: by-month and by-platform breakdown, bar chart

**Implements:**
- Server Components for each page (independent data fetching)
- Client Components for sortable tables with react-hook-form state

**Addresses:**
- Table stakes: must view historical transactions and options without opening NocoDB
- Wheel strategy analytics (differentiator)

**Research flag:** Standard patterns (sortable tables, basic charts). Skip phase research. Note: options assignment logic (Pitfall #4) is NOT addressed here — deferred to Phase 5 when write operations are added.

### Phase 5: Write Operations (Forms & API Routes)
**Rationale:** Without data entry forms, user still needs NocoDB for adding transactions/options. This phase completes the "spreadsheet replacement" by enabling writes through the dashboard. Must implement before tool can be used as primary data entry interface.

**Delivers:**
- Validation schemas (`lib/validations.ts`): zod schemas for transaction, option, deposit inputs
- Add transaction form (Client Component): react-hook-form + zod, auto-calculate amount field
- Add option form (Client Component): all wheel/LEAPS fields, strike/expiration/premium required
- Add deposit form (Client Component): month + platform + amount
- Route Handlers: `/api/transactions` (POST), `/api/options` (POST), `/api/deposits` (POST)
- Close/update option endpoint: `/api/options/[id]` (PATCH) with status field
- Auto-generate stock transaction when option assigned (addresses Pitfall #4)

**Implements:**
- Architecture Pattern 2: Route Handler mutation with path revalidation
- Form validation: zod schemas used client-side (form) and server-side (Route Handler)

**Addresses:**
- Table stakes: must add transactions/options through dashboard, not NocoDB UI
- Pitfall #4 (assignment phantom transactions) — PATCH endpoint auto-creates Buy/Sell transaction when option status changes to "Assigned"

**Avoids:**
- Critical Pitfall #4 (assignment creates phantom transactions) — automated transaction generation

**Research flag:** Standard patterns (react-hook-form + zod widely documented). Skip phase research. However, add validation that assignment transaction creation is tested thoroughly (unit tests with mock scenarios).

### Phase 6: Performance Analytics
**Rationale:** Requires accumulated data. Monthly snapshots are migrated but benchmark comparison needs ongoing price_history accumulation (at least 30-90 days). This phase makes sense after the tool has been running for a while and price_history has grown.

**Delivers:**
- Performance page: monthly snapshots table, portfolio value over time line chart
- Benchmark comparison: portfolio vs S&P 500 (fetch SPY from FMP, normalize both to 100 at start date)
- Monthly performance cards: best month, worst month, average monthly return
- Per-broker allocation donut chart (show which broker holds most value)

**Uses:**
- `monthly_snapshots` table (already migrated)
- `price_history` table (accumulated daily from Phase 2 sync script)
- FMP API: fetch SPY historical prices (one-time, cache in NocoDB)

**Addresses:**
- Differentiator: benchmark comparison shows if active management is worth effort

**Research flag:** Standard patterns (line charts, historical data queries). Skip phase research.

### Phase 7: UK Tax Estimates
**Rationale:** Complex calculation requiring Section 104 pooling rules. Only needed at tax season (April). Defer until approaching first tax deadline. Requires stable cost basis calculation from Phase 2-3 and dividend data.

**Delivers:**
- Tax page (Server Component): fetch settings + dividends + sell transactions
- Tax calculator (Client Component): interactive salary input, tax year selector
- UK tax estimates: income tax bands, dividend tax with allowance, CGT with allowance
- **Estimate only** — clearly labelled disclaimers that Section 104 pooling is approximate
- Cross-broker Section 104 pooling: aggregate all transactions per symbol regardless of platform
- HMRC three-step matching: same-day rule, 30-day bed-and-breakfasting, Section 104 pool

**Uses:**
- Stack: zod for tax settings, Big.js for tax calculations
- Constants: UK tax rates, allowances (2024/25 tax year) in `lib/constants.ts`

**Addresses:**
- Differentiator: UK tax awareness — generic trackers don't support or charge for it
- Pitfall #2 (UK tax matching rules) — implement three-step hierarchy with unit tests from HMRC HS284 examples

**Avoids:**
- Critical Pitfall #2 (ignoring HMRC rules) — defer full implementation, but label estimates clearly

**Research flag:** **NEEDS RESEARCH.** UK tax rules are complex and domain-specific. Recommend `/sky:research-phase` for this phase to validate Section 104 implementation, same-day rule edge cases, and cross-broker pooling logic. Sources: HMRC CG51560, CG51565, HS284 helpsheets.

### Phase 8: Advanced Features (Unified View, Expiration Calendar)
**Rationale:** Differentiators that require both stock and options data to be stable. Unified view is the "killer feature" — no mainstream tracker shows sold options premium alongside stock holdings. Expiration calendar requires options data maturity.

**Delivers:**
- Unified stocks + options allocation view: LEAPS market value (manually entered) shown alongside stock holdings in portfolio weights
- Options expiration calendar/timeline: visual display of upcoming expirations with urgency indicators (green >30d, amber 7-30d, red <7d)
- Forward dividend projection: estimate next 12 months based on shares * dividend_yield * price
- Dividend income goal progress bar (toward annual target from settings)

**Uses:**
- LEAPS manual market value entry workflow (form to update LEAPS value)
- Dividend yield data from FMP (if available)

**Addresses:**
- Differentiator: unified view is the primary reason to build custom tool vs using Ghostfolio
- Differentiator: expiration calendar prevents missed rolls/expirations

**Research flag:** Standard patterns (calendar views, progress bars). Skip phase research.

### Phase Ordering Rationale

The dependency chain is clear from research:
1. **Foundation first** — NocoDB client and migration are the data layer. Nothing works without this.
2. **Calculations second** — Holdings calculation is the most critical algorithm. Establish Big.js early or floating-point errors compound.
3. **Core display third** — Portfolio overview depends on Phase 1 + 2 (data + calculations). This is the primary page.
4. **Secondary display fourth** — Transactions/options/dividends/deposits are simpler queries. Can be built in parallel.
5. **Write operations fifth** — Forms + Route Handlers enable data entry. Must work before tool replaces spreadsheet entirely.
6. **Advanced analytics later** — Performance and tax pages require accumulated data (price_history over time, stable cost basis). Tax is complex and only needed at tax season.
7. **Differentiators last** — Unified view and expiration calendar are high-value but not blocking. Build when core is stable.

**Pitfall avoidance order:**
- **Phase 1** addresses Pitfall #8 (migration), #9 (token exposure), #11 (table ID hardcoding)
- **Phase 2** addresses Pitfall #1 (floating-point), #5 (price_history growth), #6 (FMP bandwidth)
- **Phase 3** addresses Pitfall #3 (N+1 waterfalls) via parallel fetch
- **Phase 5** addresses Pitfall #4 (assignment phantom transactions)
- **Phase 7** addresses Pitfall #2 (UK tax rules) — but deferred with disclaimers

**Architecture alignment:**
- Server Component pattern established in Phase 3 (portfolio overview)
- Route Handler pattern established in Phase 5 (first mutation)
- Parallel fetch pattern required from Phase 1 (NocoDB client design)
- Streaming/Suspense can be added later as optimization (not critical path)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 7 (UK Tax Estimates):** HMRC Section 104 pooling, same-day rule, 30-day bed-and-breakfasting are complex domain-specific rules. Recommend `/sky:research-phase` to validate implementation against HMRC HS284 worked examples and ensure cross-broker pooling logic is correct. Sources: HMRC manuals CG51560, CG51565, HS284. Verify with unit tests against real scenarios.

**Phases with standard patterns (skip research-phase):**
- **Phase 1-6, 8:** Next.js Server Components, NocoDB REST API, Recharts charts, react-hook-form validation are all well-documented patterns with high-confidence sources (official docs, established libraries). No niche/complex integrations requiring deep research.

**Validation checkpoints:**
- **After Phase 2:** Run test calculations with Big.js against broker statements. Verify holdings totals match to the penny.
- **After Phase 3:** Compare portfolio overview totals (total value, P&L) to broker's reported totals. Should match within FX rounding.
- **After Phase 5:** Test options assignment flow end-to-end. Assign a put, verify Buy transaction auto-created at correct price (strike - premium or strike, depending on accounting policy chosen).
- **After Phase 7:** Cross-check tax estimates against manual HMRC calculation. Flag discrepancies for review.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js 16, NocoDB 0.301.x, FMP API, shadcn/ui, Recharts all have official docs and recent stable releases (Jan-Feb 2026). Version compatibility verified. |
| Features | HIGH | Research cross-referenced 8+ portfolio trackers (Ghostfolio, Sharesight, TrackTheta, Wealthfolio) and 10+ sources on options wheel tracking and UK tax rules. Feature expectations well-established. |
| Architecture | HIGH | Next.js App Router patterns (Server Components, Route Handlers, streaming) are official and widely adopted. NocoDB REST API v2 is stable and documented. Server-first pattern is standard practice for dashboards. |
| Pitfalls | MEDIUM-HIGH | Floating-point arithmetic, NocoDB N+1 queries, UK tax rules are verified across multiple sources (HMRC manuals, developer blogs, GitHub issues). Options assignment and price_history growth are inferred from domain knowledge but not directly documented for this exact use case. |

**Overall confidence:** HIGH

The stack is modern and stable. The features are well-researched against existing trackers. The architecture follows established Next.js patterns. The pitfalls are validated with specific sources (HMRC manuals for tax, NocoDB GitHub issues for performance, IEEE 754 for floating-point). The main uncertainty is UK tax implementation complexity — Section 104 pooling with same-day and 30-day rules is genuinely complex, hence the MEDIUM-HIGH confidence and recommendation for phase-level research.

### Gaps to Address

**Gap 1: FX rate handling for historical transactions**
- **Issue:** Implementation plan stores `default_currency: GBP` in settings but does not describe how to apply historical FX rates to transactions. HMRC requires gains in GBP using the exchange rate on acquisition and disposal dates, not a single current rate.
- **How to handle:** Phase 1 decision required: (a) store FX rate on each transaction at migration time (backfill using FMP historical forex endpoint), or (b) use a single daily rate from `price_history` and accept approximate GBP values. Recommend (b) for MVP with (a) as Phase 7 enhancement for tax accuracy.

**Gap 2: Options accounting policy (premium reduces cost basis vs separate income)**
- **Issue:** Research highlights two valid approaches for handling assigned options premium. Must choose one before building options stats or portfolio P&L, or double-counting occurs.
- **How to handle:** Phase 5 decision required during options forms/API implementation. Document chosen policy prominently. Test against broker statements to verify P&L reconciles.

**Gap 3: Broker API version compatibility (migration script)**
- **Issue:** Apple Numbers version in use not specified. numbers-parser supports 10.3-14.1, but unknown if the actual `.numbers` file version is within this range.
- **How to handle:** Phase 1 validation — test numbers-parser against the actual file before full migration. If unsupported version, export to CSV as fallback.

**Gap 4: NocoDB table ID resolution**
- **Issue:** Research suggests storing table IDs in env vars OR fetching via meta API. Implementation plan does not specify which approach.
- **How to handle:** Phase 1 decision: recommend env vars for simplicity (8 fixed tables, single-user app). Document table IDs in `.env.example` with instructions to copy from NocoDB UI. Avoids runtime API call overhead.

**Gap 5: Fractional shares handling**
- **Issue:** Some brokers allow fractional shares (0.5 shares of AAPL). Research does not confirm if the current spreadsheet has fractional shares or if NocoDB schema supports them.
- **How to handle:** Phase 1 migration validation — check if any transaction has fractional shares. If yes, verify NocoDB `Number` type supports decimals (it does). If not, can simplify to integers. Add "Looks Done But Isn't" checkpoint: verify 0.5 shares handled correctly in holdings calculation.

## Sources

### Primary (HIGH confidence)
- **Next.js 16.1 & 16 blog posts** — Turbopack stable, Cache Components, React 19 foundation, App Router patterns
- **NocoDB API v2 docs + GitHub releases** — v0.301.x endpoint format, pagination, auth, query params
- **shadcn/ui changelog Feb 2026 & Feb 2025** — Unified radix-ui package, Tailwind v4 support, new-york default
- **Tailwind CSS v4 blog** — CSS-first config, @theme directive, performance improvements
- **FMP API docs** — Free tier limits (500MB/30-day, 250 calls/day), batch quote endpoint, forex rates
- **HMRC capital gains manuals** — CG51560 (same-day & 30-day rules), CG51565 (Section 104 pooling), HS284 helpsheet with worked examples
- **React Hook Form + Zod + Recharts npm pages** — v7.71.x, v4.3.x, v3.7.x — version compatibility and API references

### Secondary (MEDIUM confidence)
- **Benzinga, Stock Analysis, Wall Street Zen: Best Portfolio Trackers (2026)** — Feature comparison across 15+ trackers (Ghostfolio, Sharesight, Wealthfolio, etc.)
- **TrackTheta, Wheelytics, CoveredWheel, Option Wheel Tracker** — Options wheel strategy tracking feature sets
- **Financial Software Ltd, Which.co.uk** — UK CGT rules plain-English explanations, cross-broker pooling
- **numbers-parser GitHub + PyPI** — v4.16.x, cell types, date handling, Numbers version support
- **NocoDB GitHub issues** — #9692 (linked record performance), #7761 (API row limits), #12084 (v3 pagination bug)
- **Next.js architecture blog (Yogi JS)** — Server-first patterns, client islands, App Router composition
- **DEV Community: Financial Precision in JavaScript** — Big.js vs Decimal.js, integer storage patterns, banker's rounding

### Tertiary (LOW confidence)
- **Semaphore: Next.js API Layer** — Centralized server-side API logic pattern (generic advice, not Next.js 16 specific)
- **Robin Wieruch: JavaScript Rounding Errors** — IEEE 754 pitfalls in financial apps (general JS knowledge, not specific to this stack)
- **Motley Fool UK: CGT Share Matching Rules** — Plain-English explanation (not official HMRC source, but corroborates official manuals)

---
*Research completed: 2026-02-06*
*Ready for roadmap: yes*
