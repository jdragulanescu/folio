# Pitfalls Research

**Domain:** Personal investment tracking dashboard (NocoDB backend, Next.js frontend, FMP API pricing)
**Researched:** 2026-02-06
**Confidence:** MEDIUM-HIGH (verified across multiple sources; some NocoDB-specific items at MEDIUM due to limited production reports at this scale)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Floating-Point Arithmetic in Financial Calculations

**What goes wrong:**
JavaScript uses IEEE 754 binary floating-point (e.g. `0.1 + 0.2 === 0.30000000000000004`). Cost basis calculations, P&L aggregations, and tax computations silently accumulate rounding errors. With 964 transactions across 120 symbols, these errors compound. A portfolio showing GBP 50,234.57 might actually be GBP 50,234.52 -- small per-transaction, but visible in totals and devastating for tax reporting.

**Why it happens:**
Developers use native `number` types for financial math because it "works in testing" with a few transactions. The errors only surface when aggregating hundreds of transactions or comparing to broker statements.

**How to avoid:**
- Use a decimal library like `Decimal.js` or `Big.js` for ALL financial calculations in `calculations.ts`. `Big.js` is recommended -- it is small (~6KB), purpose-built for financial arithmetic, and handles arbitrary decimal precision.
- Store monetary values in NocoDB as `Decimal` type (which the schema already does -- good).
- Apply rounding only at display time, never mid-calculation.
- Use banker's rounding (round half to even) for tax calculations to match HMRC expectations.

**Warning signs:**
- Portfolio total does not match sum of individual holdings when calculated independently
- Tax calculation differs from broker's annual tax statement by small amounts
- P&L percentages that should be identical across views show slight differences

**Phase to address:**
Phase 1 (Foundation) -- establish the calculations library with `Big.js` from day one. Retrofitting decimal arithmetic into existing calculations is painful and error-prone.

---

### Pitfall 2: UK Tax Calculation Ignores HMRC Share Matching Rules

**What goes wrong:**
The implementation plan describes simple average cost basis (total buy amount / total buy shares). This is NOT how UK capital gains tax works. HMRC mandates a strict three-step share matching hierarchy:

1. **Same-day rule:** Shares sold are first matched to shares bought on the same day
2. **30-day "bed and breakfasting" rule:** Then matched to shares bought within 30 days AFTER the disposal (FIFO within this window)
3. **Section 104 pool:** Remaining shares matched against the Section 104 holding (weighted average pool of all earlier acquisitions)

Furthermore, Section 104 holdings are per-company regardless of broker -- shares of AAPL held at IBKR and Trading 212 form ONE Section 104 pool.

**Why it happens:**
Developers implement simple average cost basis (the US FIFO/average method) because it is intuitive. UK rules are more complex and not widely documented in developer resources. The 30-day rule is particularly easy to miss.

**How to avoid:**
- Implement the three-step matching hierarchy as a dedicated module, not an afterthought.
- Cross-broker pooling: aggregate ALL transactions for a symbol regardless of platform before calculating Section 104 pool.
- For each disposal, check: (a) same-day buys, (b) 30-day forward buys, (c) Section 104 pool -- in that order.
- Add unit tests using HMRC's own worked examples (HMRC helpsheet HS284 contains them).
- Consider marking the tax page as "estimate only" with clear disclaimers until the matching rules are validated.

**Warning signs:**
- Cost basis differs from what broker reports show
- Selling and rebuying within 30 days does not trigger the bed-and-breakfasting adjustment
- Same-day buy/sell transactions do not match correctly

**Phase to address:**
Defer full HMRC-compliant tax calculation to a later phase. Phase 1 can show simple average cost basis clearly labelled as "approximate." The tax page should carry a prominent "ESTIMATE ONLY -- does not implement HMRC share matching rules" disclaimer until a dedicated phase implements Section 104 pooling.

---

### Pitfall 3: NocoDB as Backend Creates N+1 Query Waterfalls

**What goes wrong:**
The portfolio overview page needs data from `symbols`, `transactions`, `deposits`, `dividends`, and `options` tables. Without SQL joins, each "related" lookup requires a separate HTTP request to NocoDB. The holdings calculation needs ALL transactions (964 rows across multiple pages at 100/page = 10 requests) PLUS all symbols (120 rows = 2 requests) PLUS current prices. This creates a waterfall of sequential API calls that makes page loads slow (2-5+ seconds).

NocoDB's offset pagination compounds the problem: fetching page 10 of transactions requires the database to scan and skip the first 900 rows.

**Why it happens:**
NocoDB is designed as a spreadsheet-like UI over a database. It lacks server-side joins, aggregations, or custom SQL views via the API. Developers treat it like a traditional REST API without accounting for the "no joins" constraint.

**How to avoid:**
- Use `Promise.all()` / parallel fetch in Next.js Server Components -- fetch all tables simultaneously rather than sequentially. Next.js Server Components support this natively.
- Pre-compute and cache expensive aggregations. Use the `monthly_snapshots` table as a pre-computed cache for the performance page rather than recalculating from raw transactions.
- Fetch all records upfront for small tables (symbols: 120 rows, options: 200 rows -- these fit in single requests with `limit=1000`). Only paginate truly large tables.
- Consider a server-side caching layer (Next.js `unstable_cache` or simple in-memory cache with TTL) to avoid re-fetching unchanged data on every page load.
- For transactions (964 rows), fetch ALL at once with `limit=1000` rather than paginating -- this is within NocoDB's max limit.

**Warning signs:**
- Portfolio overview page takes more than 2 seconds to load
- Network tab shows 10+ sequential NocoDB API calls
- Adding new views/pages requires exponentially more API calls

**Phase to address:**
Phase 1 (Foundation) -- design the NocoDB client (`nocodb.ts`) with parallel fetching patterns and appropriate caching from the start. This is an architectural decision that is expensive to change later.

---

### Pitfall 4: Options Assignment Creates Phantom Stock Transactions

**What goes wrong:**
When a put option is assigned in the wheel strategy, the trader receives 100 shares of stock at the strike price. This is simultaneously an options event (status changes to "Assigned") AND a stock acquisition (new transaction in the transactions table). If the system does not create a corresponding buy transaction when an option is assigned, the holdings calculation will be wrong -- the shares exist in the real portfolio but not in the data.

Similarly, when a covered call is assigned, 100 shares are sold. The options record shows "Assigned" but the transactions table is missing the sell.

**Why it happens:**
Options and stock transactions are tracked in separate tables with no automated linkage. Manual data entry is error-prone -- users assign the option but forget to add the corresponding stock transaction, or add it with slightly different parameters (wrong date, wrong price).

**How to avoid:**
- When an option status is changed to "Assigned," automatically prompt (or auto-create) the corresponding transaction record: Buy for put assignment (shares at strike price), Sell for call assignment (shares at strike price).
- Store a reference linking the option record to the generated transaction (e.g., a `notes` field on the transaction like "Auto: assigned from option #42").
- Add a reconciliation check: periodically compare holdings derived from transactions vs. what should exist based on option assignments.
- Include this in the option close/update API endpoint logic.

**Warning signs:**
- Holdings quantity does not match broker account
- Assigned options exist but no corresponding buy/sell transaction
- Cost basis calculations are wrong for symbols with wheel strategy activity

**Phase to address:**
Phase 2 or 3 (Options Dashboard) -- when building the option close/update flow, implement the automatic transaction generation. This must be done before the tax phase, as assignment cost basis affects capital gains calculations.

---

### Pitfall 5: price_history Table Grows Unbounded

**What goes wrong:**
The sync script inserts one row per symbol per day into `price_history`. At 120 symbols syncing daily on weekdays (~252 trading days/year), this adds ~30,000 rows per year. After 3 years: ~90,000 rows. NocoDB's offset pagination degrades noticeably with large tables -- users report count queries timing out at 4 minutes with millions of rows, and frontend lag with tables of 1,000-5,000 rows with many columns. While 90K rows is not catastrophic for the underlying database, querying this through NocoDB's REST API with offset pagination becomes increasingly slow.

**Why it happens:**
Time-series data accumulation is easy to ignore at launch. The table works fine for months. By the time it becomes a problem, there is too much data and no pruning strategy in place.

**How to avoid:**
- Implement a retention policy in the sync script: keep daily prices for the last 90 days, then only weekly closes (Friday) for older data, then monthly for data older than 1 year.
- Add the pruning logic to the daily sync cron job so it runs automatically.
- Alternative: store price history in `monthly_snapshots` instead (which already exists) and only keep recent daily data for short-term charts.
- Design chart components to work with sparse data (weekly/monthly points) for long time horizons.

**Warning signs:**
- Performance page chart loading time increases month over month
- NocoDB UI becomes sluggish when viewing the price_history table
- Sync script takes noticeably longer as the table grows

**Phase to address:**
Phase 1 (Price Sync) -- build the retention/pruning logic into the sync script from the start. It is trivial to add at creation time and painful to retrofit.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 6: FMP Free Tier Bandwidth Exhaustion

**What goes wrong:**
The FMP free plan has a 500MB rolling 30-day bandwidth limit and 250 API requests per day. The implementation plan estimates 3 API calls per sync (120 symbols / 50 per batch). However, the plan also includes: (a) the "Sync Now" button in the UI, (b) historical price data for charts (S&P 500 benchmark comparison), (c) symbol lookup when adding new transactions, (d) price history backfill. If a developer casually triggers syncs during development or adds endpoints that fetch historical data, the bandwidth depletes quickly. The 500MB limit is on response payloads, and batch quote responses for 50 symbols are approximately 15-25KB each -- but historical price endpoints return significantly more data.

**How to avoid:**
- Track FMP API usage: log every request with response size in the sync script.
- Implement aggressive caching: never re-fetch data that has not changed. Cache FMP responses with appropriate TTLs.
- For S&P 500 benchmark data, fetch once and store in NocoDB rather than fetching on each page load.
- Avoid fetching historical price data during the free tier -- use only daily quote endpoint for current prices.
- Rate limit the "Sync Now" button (at most once per 15 minutes).
- Consider: if FMP free tier proves too restrictive, the $19/month starter plan removes bandwidth caps.

**Warning signs:**
- API calls start returning errors or empty responses mid-month
- "Sync Now" works in the morning but fails in the afternoon
- New endpoint additions cause existing sync to break

**Phase to address:**
Phase 1 (Price Sync) -- add usage logging and rate limiting from the start. Also add an environment variable flag to disable FMP calls entirely for development/testing.

---

### Pitfall 7: Currency Blind Spot -- GBP vs USD Mismatch

**What goes wrong:**
All stock prices from FMP are in USD. The user's deposits are in GBP. The portfolio overview will show "Portfolio Value" in USD-denominated prices multiplied by share quantities, but "Total Deposited" in GBP. Comparing these directly produces meaningless numbers. P&L calculations mixing GBP deposits with USD market values are fundamentally wrong. UK tax calculations require GBP values at the time of each transaction.

**Why it happens:**
Single-currency dashboards are the default assumption. Developers display whatever numbers the API returns without considering that the user operates in a different currency. The implementation plan stores `default_currency: GBP` in settings but does not describe any FX conversion logic.

**How to avoid:**
- Decide on a display currency (GBP, since the user is UK-based) and convert all values consistently.
- FMP provides FX rates via the `/api/v3/forex` or `/api/v3/quote/GBPUSD` endpoint -- fetch GBP/USD rate during each sync and store it.
- For historical accuracy: store the FX rate on each transaction at the time of the transaction (or at minimum, use the daily rate for that date). This matters for tax calculations.
- Display currency clearly on all monetary values (prefix with GBP or $).
- For tax: HMRC requires gains to be calculated in GBP using the exchange rate on the date of acquisition and disposal.

**Warning signs:**
- Portfolio value does not match any broker's portfolio value
- P&L percentage seems unreasonably high or low
- Deposited amount exceeds portfolio value despite gains (because one is GBP, the other USD)

**Phase to address:**
Phase 1 (Foundation) -- make the currency decision and implement FX conversion early. Retrofitting currency conversion into every calculation is a significant rewrite.

---

### Pitfall 8: Data Migration Silently Drops or Corrupts Records

**What goes wrong:**
The numbers-parser library returns `DateCell` values as Python `datetime` objects, but Apple Numbers stores dates in various internal formats. Edge cases: (a) dates before 1970 (unlikely here but possible), (b) timezone-naive vs timezone-aware datetimes, (c) empty cells in optional columns returning `EmptyCell` (value is `None`), (d) summary/total rows in the spreadsheet that are not real transactions. The migration script may insert garbage rows (summary rows), skip valid rows (due to unexpected cell types), or corrupt dates (timezone conversion issues).

**How to avoid:**
- Run migration in dry-run mode first: parse and validate all data, print a summary, but do not insert. Compare record counts against known totals (964 transactions, 164 wheel options, 36 LEAPS, 74 deposit rows).
- Validate every row before insertion: symbol must be non-empty string, date must be valid, amounts must be numeric.
- Handle `EmptyCell` and `ErrorCell` explicitly -- skip or log, do not insert `None` into required fields.
- Normalise platform names with a mapping dict: `{"Etoro": "eToro", "Hood": "Robinhood"}`.
- Store the original row index in a `notes` or `migration_ref` field for traceability.
- Run the migration against a test NocoDB base first, not the production one.

**Warning signs:**
- Record count after migration does not match expected totals
- Dates appear as 1970-01-01 or far-future dates
- Sum of all transaction amounts does not match the original spreadsheet's total
- Symbols appear with extra whitespace or inconsistent casing

**Phase to address:**
Phase 0 (Migration) -- this is a one-time operation but it is the foundation for everything else. If migration data is wrong, every subsequent calculation is wrong. Budget time for validation and a re-run.

---

### Pitfall 9: NocoDB API Token Exposed to Client

**What goes wrong:**
Next.js has a subtle security boundary between server and client. If the NocoDB API token is accessed in a component that becomes a client component (or is imported by one), the token is bundled into the browser JavaScript. Anyone viewing page source or network requests can extract the token and gain full read/write access to all NocoDB data.

**How to avoid:**
- Add `import 'server-only'` at the top of `nocodb.ts` -- this causes a build error if the module is accidentally imported by a client component.
- NEVER prefix NocoDB credentials with `NEXT_PUBLIC_` in environment variables.
- All NocoDB calls must go through Server Components or API Route Handlers -- never from client components directly.
- Audit the import chain: if `calculations.ts` imports from `nocodb.ts` and a client component imports `calculations.ts`, the token leaks. Keep data-fetching and calculation logic in separate modules.

**Warning signs:**
- Build succeeds but browser DevTools Network tab shows requests to NocoDB URL
- Environment variables with API tokens appear in the browser's JavaScript bundles
- `nocodb.ts` is imported in files that have `"use client"` directive

**Phase to address:**
Phase 1 (Foundation) -- add `server-only` guard immediately when creating the NocoDB client module.

---

### Pitfall 10: Options P&L Double-Counting with Stock P&L

**What goes wrong:**
The wheel strategy creates a tight coupling between options P&L and stock P&L. Example: sell a put for $5 premium, get assigned at $100 strike. The cost basis for the stock should be $95 ($100 - $5 premium). If the options table records $5 profit AND the transactions table records the stock purchase at $100 (not $95), the $5 premium is counted as income in options stats AND again as unrealised gain when the stock is sold above $95.

The implementation plan shows `profit` on the options record AND a separate cost basis calculation on transactions. Without adjustment, total portfolio P&L is overstated by the premium amount on every assignment.

**How to avoid:**
- Define a clear accounting policy: either (a) options premium reduces stock cost basis (traditional accounting -- premium is NOT separate income), or (b) options premium is separate income and stock cost basis stays at strike price (simpler but different from broker reporting).
- Document the chosen approach prominently.
- If using approach (a): when an option is assigned, the auto-generated stock transaction should use `strike - premium` as the price for put assignments.
- If using approach (b): do NOT include assigned options premium in the "Total Premium Collected" stat card -- only count Closed and Expired.
- Either way, clearly document what "Total P&L" includes and excludes.

**Warning signs:**
- Total portfolio P&L does not reconcile with broker's reported P&L
- Options premium income + stock gains exceeds the actual money gained
- Assigned options show both premium profit AND the stock shows unrealised gain on the same dollars

**Phase to address:**
Phase 2 or 3 (Options Dashboard) -- decide the accounting policy before building the options stats cards. This affects both the options page and the portfolio overview.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: NocoDB Table IDs Hardcoded

**What goes wrong:**
NocoDB table IDs are opaque strings (e.g., `tbl_abc123`) that change if tables are recreated. Hardcoding them in the Next.js client or Python scripts means the entire application breaks if any table is deleted and recreated (common during development or schema changes).

**How to avoid:**
- Use the NocoDB meta API to look up table IDs by name at startup: `GET /api/v2/meta/bases/{baseId}/tables` and build a name-to-ID mapping.
- Cache this mapping with a reasonable TTL or refresh on 404 errors.
- Store the mapping in an environment variable as a fallback, but prefer runtime lookup.

**Phase to address:**
Phase 1 (Foundation) -- build into the NocoDB client wrapper from the start.

---

### Pitfall 12: Recharts Re-renders Kill Performance on Large Datasets

**What goes wrong:**
Recharts re-renders the entire SVG on every React state change. The performance chart with monthly snapshots (86+ rows) is fine, but the price history chart with thousands of data points causes visible jank and dropped frames, especially on the benchmark comparison overlay.

**How to avoid:**
- Use `React.memo` on chart wrapper components.
- Downsample data for charts: a line chart with 1,000+ points is visually indistinguishable from one with 200 points after downsampling.
- Use `isAnimationActive={false}` on Recharts components for large datasets.
- Consider virtualized charts or Canvas-based rendering (e.g., `visx` or `lightweight-charts`) only if Recharts proves insufficient.

**Phase to address:**
Performance phase -- address only if performance page becomes sluggish. Not a concern until price_history has thousands of rows.

---

### Pitfall 13: Stale Prices After Market Hours Display Misleads

**What goes wrong:**
The dashboard shows "current price" and "day change" that were fetched at the last sync (e.g., 9pm UK time). If the user views the dashboard the next morning before sync, the "day change" is yesterday's change. If they view on weekends, data is 2-3 days old. Without clear "last updated" timestamps, users may make decisions based on stale data.

**How to avoid:**
- Display the "Last synced: [timestamp]" prominently (the sidebar already plans this -- good).
- Show relative time ("Updated 14 hours ago") rather than absolute timestamps.
- Grey out or visually dim price data when it is more than 1 trading day old.
- Clearly label pre-market and post-market hours.

**Phase to address:**
Phase 1 (UI Foundation) -- a simple design decision, not technically complex.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Simple average cost basis instead of Section 104 pooling | Faster to implement, works for display | Tax calculations are wrong; need full rewrite of cost basis logic | MVP only, with clear "approximate" labelling |
| Fetching all transactions on every page load | Simple, no caching complexity | Slow page loads as transaction count grows past 2,000+ | Until transaction count exceeds ~1,500 |
| Storing all amounts in USD without FX rate | No currency conversion logic needed | Every GBP-denominated view is wrong; retrofitting FX is painful | Never -- make the currency decision in Phase 1 |
| No data validation on NocoDB writes | Faster form submission, fewer API calls | Corrupt data (negative shares, future dates, duplicate entries) | Never -- validate with Zod from day one |
| Single NocoDB base for everything | Simple setup, one API token | No way to test schema changes without affecting production data | Until schema stabilises; create a dev base early |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NocoDB REST API | Using `limit=25` (default) and not realising you are missing data | Always set `limit=1000` for tables with <1000 rows; paginate explicitly for larger tables |
| NocoDB REST API | Assuming column names in API match table header names | Column names in API use the `column_name` from schema, not the display title. Verify with a test GET request |
| NocoDB REST API | Not handling 429 (rate limit) responses | Implement retry with 30-second backoff as documented |
| FMP API | Fetching batch quotes with invalid/delisted symbols | FMP silently omits invalid symbols from the response array. Check that response count matches request count |
| FMP API | Assuming free tier data is real-time | Free tier quote data may have delays. Do not display prices as "real-time" or "live" -- use "latest available" |
| FMP API | Not handling market holidays and weekends | FMP returns the last available price on non-trading days. The sync script should not create duplicate price_history rows for the same date |
| numbers-parser | Assuming all cells have values | `EmptyCell` returns `None`; `ErrorCell` (formula errors in Numbers) also returns `None`. Check cell type before processing |
| numbers-parser | Expecting consistent date objects | Some "date" columns in Numbers may actually store dates as text strings, not `DateCell`. Implement fallback text-to-date parsing |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recalculating all holdings from raw transactions on every page load | Page load takes 3+ seconds | Cache holdings calculation in React; invalidate on new transaction or price sync | At ~2,000+ transactions |
| NocoDB offset pagination for large tables | Requests for later pages take 5+ seconds | Use `limit=1000` for sub-1000 row tables; implement cursor-based pagination for larger ones | At ~5,000+ rows with offset > 1000 |
| Fetching all price_history for chart rendering | Chart takes 10+ seconds to render | Fetch only the date range needed; downsample for long ranges | At ~50,000+ price_history rows (~2 years of data) |
| Sequential NocoDB API calls in Server Components | Page load stacks up latency from each call | Use `Promise.all()` for independent queries; preload data at layout level | Immediately noticeable with 5+ sequential calls |
| Recharts SVG rendering with thousands of data points | Browser jank, high CPU usage during chart interactions | Downsample to max ~300 points; disable animations for large datasets | At ~1,000+ chart data points |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| NocoDB API token in client-side code | Full read/write access to all portfolio data for anyone who inspects browser JS | Use `server-only` guard; only access token in Server Components and API Routes |
| FMP API key in client-side code | API key abuse; someone else uses your bandwidth quota | Same as above -- all FMP calls through server-side proxy (API Routes) |
| No authentication on the Next.js dashboard | Anyone on the local network (or internet if exposed) can view financial data and modify records | For local-only use: bind to `localhost` only. If exposing: add basic auth or session-based auth |
| Exposing real portfolio values in git/logs | Financial privacy breach if repo becomes public | Never log monetary values; use `.env.local` (gitignored) for all secrets; add `.env*` to `.gitignore` |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing too many decimal places | Cognitive overload; GBP 12,345.6789 is hard to parse | 2 decimal places for currency, 2 for percentages, 0 for share counts (unless fractional) |
| Red/green as only differentiation for gains/losses | Inaccessible to colour-blind users (~8% of males) | Use arrows/icons AND colour; add `+`/`-` prefix to numbers |
| No loading states on data-heavy pages | Users see empty tables, think data is missing | Show skeleton loaders matching table/card layout; show "Loading 964 transactions..." for context |
| Auto-refreshing prices while user is reading | Table rows jump around; user loses their place in a table | Only refresh on explicit "Sync Now" action; never auto-refresh mid-session |
| Showing all 120 symbols at once without filtering | Overwhelming wall of data | Default to a summary view; allow drill-down. Show top movers and worst performers prominently |
| Options expiration displayed without urgency indicators | User misses upcoming expirations | Colour-code: red for expired, amber for <7 days, yellow for <30 days |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Holdings calculation:** Often missing handling for fully-sold positions (shares net to zero) -- verify these do not appear in active holdings
- [ ] **Cost basis:** Often missing sell transactions reducing the position -- verify that selling half your shares correctly adjusts remaining cost basis
- [ ] **Options P&L:** Often missing rolled options -- verify that a roll (close + open) counts the close as realised P&L and the open as a new position
- [ ] **Dividends:** Often missing reinvested dividends (DRIP) -- verify that dividend reinvestment creates both a dividend record AND a buy transaction
- [ ] **Deposits table:** Often missing the unpivoting logic -- verify that one spreadsheet row with multiple platforms creates multiple NocoDB records
- [ ] **Price sync:** Often missing deduplication -- verify that running sync twice on the same day does not create duplicate price_history rows
- [ ] **Tax estimates:** Often missing the dividend allowance and CGT allowance -- verify these are subtracted before applying tax rates
- [ ] **Multi-broker aggregation:** Often missing cross-broker consolidation -- verify holdings show ONE entry per symbol, aggregated across all platforms
- [ ] **Fractional shares:** Often missing decimal handling -- verify that 0.5 shares of a stock are handled correctly in holdings and cost basis

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Floating-point errors in calculations | MEDIUM | Replace `number` operations with `Big.js` in `calculations.ts`; re-test all calculation functions; no data migration needed (stored data is correct, only runtime math was wrong) |
| Wrong UK tax calculation method | HIGH | Implement Section 104 pooling module; recalculate all historical cost bases; backfill FX rates for historical transactions |
| N+1 NocoDB query waterfalls | LOW | Refactor Server Components to use `Promise.all()`; add caching layer; no data changes needed |
| Missing assignment transactions | MEDIUM | Audit all "Assigned" options; manually create missing stock transactions; add automated generation going forward |
| price_history table too large | LOW | Run a one-time pruning script to downsample historical data; add pruning to the sync cron job |
| FMP bandwidth exhaustion | LOW | Wait for the 30-day rolling window to clear; reduce sync frequency; or upgrade to $19/month plan |
| Currency mismatch | HIGH | Add FX rate field to transactions table; backfill historical rates from FMP; rewrite all calculations to convert consistently |
| Corrupted migration data | MEDIUM | Re-run migration script against clean NocoDB base; add validation checks; compare totals against original spreadsheet |
| NocoDB token in client bundle | HIGH (if exploited) | Rotate the NocoDB API token immediately; audit NocoDB logs for unauthorised access; add `server-only` guard; rebuild and redeploy |
| Options double-counting | MEDIUM | Choose accounting policy; adjust either options P&L or cost basis calculations; re-verify against broker statements |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point arithmetic (1) | Phase 1: Foundation | Unit test: sum of 964 transaction amounts matches known total to the penny |
| UK tax matching rules (2) | Defer to Tax Phase; label estimates clearly until then | Compare tax estimate against manual calculation using HMRC HS284 examples |
| NocoDB N+1 waterfalls (3) | Phase 1: Foundation | Measure portfolio page load time; must be under 2 seconds with all 120 symbols |
| Assignment phantom transactions (4) | Phase: Options Dashboard | After marking an option as Assigned, verify a corresponding transaction exists |
| price_history growth (5) | Phase 1: Price Sync | After 90 days of operation, check row count stays under 30K |
| FMP bandwidth exhaustion (6) | Phase 1: Price Sync | Log total bandwidth used per sync; project monthly usage and alert at 80% |
| Currency mismatch (7) | Phase 1: Foundation | Portfolio value in sidebar matches (approximately) broker portfolio value in GBP |
| Migration data quality (8) | Phase 0: Migration | Row counts match: 964 transactions, ~120 symbols, ~200 options, ~74 deposit months |
| API token exposure (9) | Phase 1: Foundation | Browser DevTools search for NocoDB URL returns zero results in client bundles |
| Options double-counting (10) | Phase: Options Dashboard | Total P&L equals sum of options P&L + stock P&L with no overlap |
| NocoDB table ID hardcoding (11) | Phase 1: Foundation | Deleting and recreating a table does not require code changes |
| Recharts performance (12) | Performance Phase | Charts render in under 1 second with 1 year of daily data |
| Stale price display (13) | Phase 1: UI Foundation | "Last synced" timestamp is visible; data older than 24h is visually dimmed |

## Sources

- [NocoDB REST API documentation](https://nocodb.com/docs/product-docs/developer-resources/rest-apis) -- pagination limits, query parameters
- [NocoDB GitHub Issue #9692](https://github.com/nocodb/nocodb/issues/9692) -- linked record performance with SQLite vs PostgreSQL
- [NocoDB GitHub Issue #7761](https://github.com/nocodb/nocodb/issues/7761) -- API limiting to 100 rows
- [NocoDB GitHub Issue #12084](https://github.com/nocodb/nocodb/issues/12084) -- v3 pagination token bug
- [NocoDB GitHub Discussion #1441](https://github.com/nocodb/nocodb/discussions/1441) -- querying linked records via API
- [FMP FAQ page](https://site.financialmodelingprep.com/faqs) -- free tier: 250 requests/day, 500MB/30-day bandwidth, throttle guidance
- [FMP Pricing](https://site.financialmodelingprep.com/pricing-plans) -- free vs paid tier details
- [numbers-parser GitHub README](https://github.com/masaccio/numbers-parser/blob/main/README.md) -- cell types, date handling, known limitations
- [numbers-parser PyPI](https://pypi.org/project/numbers-parser/) -- latest version December 2025, supports Numbers 10.3-14.1
- [HMRC CG51560](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560) -- same-day and bed-and-breakfast identification rules
- [HMRC CG51565](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51565) -- Section 104 holding rules
- [HMRC HS284](https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet/hs284-shares-and-capital-gains-tax-2024) -- shares and CGT helpsheet with worked examples
- [Which.co.uk CGT on Shares](https://www.which.co.uk/money/tax/capital-gains-tax/capital-gains-tax-on-shares-aOus88Q1VUve) -- cross-broker Section 104 pooling
- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security) -- server-only imports, environment variable safety
- [Next.js Data Fetching Patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns) -- parallel vs sequential fetching, waterfall prevention
- [DEV Community: Financial Precision in JavaScript](https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc) -- Big.js recommendation, integer storage pattern
- [Robin Wieruch: JavaScript Rounding Errors](https://www.robinwieruch.de/javascript-rounding-errors/) -- IEEE 754 pitfalls in financial apps
- [Motley Fool UK: CGT Share Matching Rules](https://www.fool.co.uk/investing-basics/how-shares-are-taxed-2/cgt-share-matching-rules/) -- plain-English explanation of the three-step matching hierarchy

---
*Pitfalls research for: Personal investment tracking dashboard (Folio)*
*Researched: 2026-02-06*
