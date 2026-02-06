# Feature Research

**Domain:** Personal investment tracking dashboard (stocks + options wheel/LEAPS, multi-broker, UK tax)
**Researched:** 2026-02-06
**Confidence:** HIGH

This research is tailored to Folio's specific context: a single-user, self-hosted tool replacing an Apple Numbers spreadsheet. It tracks ~120 symbols across 6 brokers, ~964 stock transactions, ~200 options trades (wheel strategy + LEAPS), deposits, dividends, and UK tax estimates. The "user" is the developer. There is no multi-user, no SaaS, no onboarding flow.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the tool to replace the spreadsheet. Without these, the user goes back to Numbers.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Holdings overview with live prices** | Core purpose of the tool. See all positions, current value, P&L at a glance. The spreadsheet already has this (minus live prices). | MEDIUM | Requires: symbols table with FMP-synced prices, cost basis calculation from transactions. FMP batch quote API already planned. |
| **Cost basis and P&L per symbol** | Fundamental portfolio metric. Must calculate average cost, total cost, unrealised P&L, P&L %. | MEDIUM | Use weighted average cost basis (sum of buy amounts / sum of buy shares). Must handle partial sells correctly -- reduce share count but keep avg cost stable (this is how most UK trackers work; it also aligns with Section 104 pooling). |
| **Portfolio weight / allocation view** | Spreadsheet has sector and strategy breakdowns. Need pie/donut charts by sector, by strategy. | LOW | Straightforward once holdings are calculated. Recharts PieChart. |
| **Multi-broker support** | 6 brokers (3 active, 3 archived). Every transaction and deposit is tagged with a platform. | LOW | Already in schema as SingleSelect. No broker API integration needed -- all manual/migrated data. |
| **Transaction history with filtering** | The spreadsheet has 964 rows. Must be searchable, sortable, filterable by symbol/platform/date/type. | MEDIUM | Paginated table, server-side filtering via NocoDB query params. |
| **Options trades table (Wheel)** | 164 wheel trades with full lifecycle: open, closed, expired, rolled, assigned. This is a core activity. | MEDIUM | Need separate views for open vs closed positions. Key columns: ticker, strike, expiration, premium, profit, status, days held, return %, annualised return %. |
| **Options trades table (LEAPS)** | 36 LEAPS positions. Bought options that appear alongside stocks for weight/allocation. | MEDIUM | LEAPS are bought options (unlike wheel which is sold). Need: break-even price, days to expiry, current P&L estimate. Market value updated manually (no free options pricing API). |
| **Wheel strategy aggregate stats** | Total premium collected, win rate, average return, average days held. The spreadsheet has these. | LOW | Pure calculation from options table: sum profit where closed, count profitable / count total, mean return %, mean days_held. |
| **Deposit tracking by month and platform** | Tracks capital inflows. The spreadsheet has a pivot table of deposits by month x platform. | LOW | Simple table + bar chart. Already have deposits schema. |
| **Dividend tracking by symbol** | Tracks dividend income. Spreadsheet has this. Need annual total, by-symbol breakdown, monthly breakdown. | LOW | Query dividends table, group by symbol and by month. |
| **Monthly performance snapshots** | Historical record of portfolio value, invested amount, gain/loss each month. Spreadsheet's "Monthly Tracker." | LOW | Read-only display of monthly_snapshots table. Line chart of portfolio value over time. |
| **Portfolio value over time chart** | Visual portfolio growth. Most basic charting feature of any tracker. | LOW | Line chart from monthly_snapshots: X = month, Y = portfolio_value, with total_invested as overlay. |
| **Add new transactions** | Without this, user still needs to open NocoDB directly. Defeats the purpose. | MEDIUM | Form with validation (zod + react-hook-form). Auto-calculate amount. Upsert symbol if new. |
| **Add new options trades** | Same rationale as transactions. Wheel trades happen weekly. | MEDIUM | Form with all options fields. Strike, expiration, premium required. Delta, IV optional. |
| **Dark theme** | Finance dashboards are dark by default (Bloomberg, TradingView, every broker). Bright white would feel wrong. | LOW | Default dark with CSS variables. shadcn/ui supports this natively with next-themes. |
| **Manual price sync trigger** | User needs to be able to refresh prices on-demand, not just via cron. | LOW | "Sync Now" button calling /api/sync. Show last sync timestamp. |

### Differentiators (Competitive Advantage)

Features that make Folio better than the spreadsheet AND better than generic trackers. These are the reasons to build a custom tool rather than use Ghostfolio/Sharesight.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Stocks + options unified portfolio view** | No mainstream tracker shows sold options premium alongside stock holdings in one allocation view. This is the primary pain point. LEAPS bought options should appear as portfolio positions with weight allocation, and wheel premium should appear as income. | HIGH | Requires: calculate LEAPS market value (manually entered) + stock market value, show combined weights. Wheel premium as separate income line. This is the killer feature. |
| **UK tax estimates (income + dividend + CGT)** | Generic trackers either don't do UK tax or charge for it (Sharesight). Having live tax estimates from actual portfolio data saves end-of-year scrambling. | HIGH | Income tax bands, dividend tax with allowance, CGT with allowance. Auto-populate from dividends table and realised gains. Needs Section 104 pooling for CGT cost basis (see pitfalls). Tax rates change annually -- store in settings or code constants that are easy to update. |
| **Wheel strategy cycle tracking** | Dedicated trackers like TrackTheta, Wheelytics, CoveredWheel exist but are separate tools. Having wheel analytics inside the portfolio tracker eliminates context-switching. | MEDIUM | Key metrics: premium yield (annualised), win rate, avg DTE, capital efficiency (premium / collateral). Monthly premium income chart. Per-ticker wheel performance breakdown. |
| **Annualised return per options trade** | Most spreadsheets track raw return. Annualised return normalises for DTE and shows which trades actually performed best on a time-adjusted basis. | LOW | Formula: (profit / collateral) * (365 / days_held) * 100. Already in schema as annualised_return_pct. |
| **Dividend income goal tracking** | Progress bar toward annual dividend income target. Motivational and strategic -- shows how far from passive income goal. | LOW | Settings table has dividend_income_goal. Sum current year dividends. Show progress bar + projected forward income (shares * dividend_yield * price). |
| **Forward dividend projection** | Estimate next 12 months of dividend income based on current holdings and yields. Most generic trackers only show historical. | MEDIUM | For each holding: shares * (dividend_yield / 100) * current_price. Sum all. Show monthly projection assuming even distribution (or use ex-dividend dates if available from FMP). |
| **Options expiration calendar/timeline** | Visual display of upcoming expirations. At a glance, see what needs attention this week/month. | MEDIUM | Calendar or timeline view of open options positions. Colour-code by DTE: green (>30 days), amber (7-30 days), red (<7 days or expired). |
| **Per-broker P&L and allocation** | See which broker is performing best. Useful for deciding where to consolidate. | LOW | Group holdings by platform, sum market value and P&L per platform. Donut chart. |
| **Benchmark comparison** | Portfolio vs S&P 500 normalised to same start date. Shows if active management is worth the effort. | MEDIUM | Fetch SPY historical from FMP. Normalise both to 100 at portfolio start date. Overlay line chart. Requires price_history data for portfolio and SPY. |
| **Top movers (gainers/losers)** | Quick view of best and worst performing holdings today and overall. Saves scanning the entire holdings table. | LOW | Sort holdings by change_pct (day) and pnl_pct (overall). Show top/bottom 5. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately NOT build. Common in the tracker space but wrong for this project.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Broker API auto-import** | Eliminates manual data entry. TrackTheta/Wheelytics offer IBKR integration. | Broker APIs are fragile, rate-limited, and require OAuth/credential management. IBKR's Flex reports change format. Multi-broker makes this 6x harder. For a personal tool, the migration is one-time and ongoing entry is low-volume (~5-10 trades/week). | Manual entry forms with good UX (autocomplete, defaults). One-time migration script from .numbers file. CSV import as a stretch goal. |
| **Real-time streaming prices** | Bloomberg-style live tickers feel professional. | FMP free tier has 250 calls/day. Real-time websocket feeds are expensive and complex. Portfolio decisions are not made on tick-level data. The user checks the dashboard a few times a day, not every second. | On-demand sync (button + daily cron). Prices are fresh enough at daily granularity. |
| **Options pricing/Greeks calculation** | Show live theoretical value of options positions using Black-Scholes. | No free API provides reliable options chain data. Calculating Greeks requires volatility surface data. LEAPS are illiquid and theoretical prices diverge from reality. The user already enters market values manually. | Manual market value entry for LEAPS. Store delta/IV at entry as static reference. Display but don't try to calculate live Greeks. |
| **Multi-currency with live FX** | Portfolio spans USD stocks bought in GBP. Show everything in GBP equivalent. | FX conversion adds complexity to every calculation (cost basis, P&L, portfolio value). FX rates add another API dependency. For a personal tool where the user thinks in both currencies, the cognitive overhead of "is this GBP or USD?" is worse than showing native prices. | Display prices in native listing currency (USD for US stocks). Show a simple GBP total using a single stored FX rate that updates with price sync. Do not try to apply historical FX rates to historical transactions. |
| **Mobile-first responsive design** | Access portfolio on the go. | This is a desktop-first analytics tool. Finance dashboards have dense data tables, charts, multi-column layouts. Mobile-optimising these is massive effort for low value. The user is at a desk when making trading decisions. | Responsive enough not to break on mobile (horizontal scroll tables, stacked cards). But design for desktop viewport first. |
| **Automated rebalancing suggestions** | "Your tech allocation is 40%, target is 30%, sell X shares." | Rebalancing across 6 brokers with different fee structures, tax implications, and options positions is not a simple calculation. Naive suggestions would be misleading. | Show allocation percentages clearly. Let the user decide. |
| **News feed / research integration** | Seeking Alpha, Yahoo Finance news for held symbols. | Adds complexity, API dependencies, and clutter. The user has separate research tools and workflows. A dashboard should show numbers, not articles. | Link symbol names to external finance pages (Yahoo Finance, TradingView) for quick reference. |
| **Trade journaling / notes system** | Record rationale for each trade for later review. | Scope creep. The options schema already has a notes field. A full journaling system with tags, screenshots, and search is a separate product. | Use the existing notes field on options trades. Keep it simple. |
| **Watchlist / paper trading** | Track stocks you don't own yet. | Separate concern from portfolio tracking. Adds UI complexity (watched vs owned symbols). The user uses broker apps for watchlists. | Out of scope. The user has broker apps and TradingView for watchlists. |
| **Full Section 104 CGT calculation** | Proper UK CGT with same-day rule, 30-day bed-and-breakfast rule, and Section 104 pooling. | Implementing HMRC-compliant share matching is genuinely complex. Same-day matching, then 30-day matching, then pooled average -- across multiple brokers. This is what CGTCalculator and similar tools exist for. Getting it wrong is worse than not having it. | Provide estimated CGT using simple average cost basis (which approximates Section 104 pooling for buy-and-hold). Flag that it's an estimate. Link to dedicated CGT tools for tax return filing. |

---

## Feature Dependencies

```
[Data Migration]
    |
    v
[Symbols + Transactions + Options in NocoDB]
    |
    +---> [Holdings Calculation] ---> [Portfolio Overview]
    |         |                           |
    |         +---> [Sector/Strategy Allocation Charts]
    |         +---> [Top Movers]
    |         +---> [Per-Broker P&L]
    |         +---> [Benchmark Comparison] (also needs price_history)
    |
    +---> [Options Stats Calculation] ---> [Options Dashboard]
    |         |
    |         +---> [Wheel Aggregate Stats]
    |         +---> [LEAPS Break-even/P&L]
    |         +---> [Monthly Premium Chart]
    |         +---> [Expiration Calendar]
    |
    +---> [Dividends Query] ---> [Dividends Page]
    |         |
    |         +---> [Income Goal Progress]
    |         +---> [Forward Projection]
    |
    +---> [Monthly Snapshots] ---> [Performance Page]
    |
    +---> [Deposits Query] ---> [Deposits Page]
    |
    +---> [Tax Calculation] ---> [Tax Page]
              |
              +--- requires: dividends (for dividend tax)
              +--- requires: realised gains from sells (for CGT)
              +--- requires: salary setting (for income tax bands)

[FMP Price Sync]
    |
    +---> [Live Prices in Symbols Table]
    +---> [Price History for Charts]

[Add Transaction Form] ---> [Recalculates Holdings]
[Add Option Form] ---> [Recalculates Options Stats]

[Unified Portfolio View (Differentiator)]
    |
    +--- requires: Holdings Calculation (stocks)
    +--- requires: LEAPS with manual market values
    +--- combines both into single weight/allocation view
```

### Dependency Notes

- **Holdings Calculation requires Data Migration:** Cannot show portfolio without transaction data in NocoDB.
- **FMP Price Sync requires Symbols Table:** Must have symbols populated before prices can be fetched.
- **Tax Page requires Dividends + Realised Gains:** Both must be calculated before tax estimates work.
- **Benchmark Comparison requires Price History:** Need historical data for both portfolio and SPY, which accumulates over time from the daily sync.
- **Unified Portfolio View requires LEAPS market values:** LEAPS need manually entered market values to show alongside stock holdings. Without this, LEAPS are invisible in allocation charts.
- **Options Dashboard is independent of stock portfolio:** Can be built in parallel with portfolio overview since they query different tables.
- **Deposits and Dividends pages are read-only:** Simplest pages -- just query and display. Can be built early as quick wins.

---

## MVP Definition

### Launch With (v1)

The minimum to stop using the spreadsheet entirely.

- [ ] **Data migration from .numbers to NocoDB** -- Without data, nothing works
- [ ] **FMP price sync (cron + manual trigger)** -- Live prices are the primary upgrade over the spreadsheet
- [ ] **Portfolio overview page** -- Holdings table with P&L, summary cards, sector/strategy charts
- [ ] **Transaction history page** -- Searchable, sortable, filterable list of all 964 transactions
- [ ] **Options dashboard** -- Open and closed positions tables, aggregate stats (premium, win rate)
- [ ] **Add transaction form** -- Must be able to add new trades without opening NocoDB
- [ ] **Add option form** -- Wheel trades happen frequently
- [ ] **Dark theme** -- Non-negotiable for a finance dashboard

### Add After Validation (v1.x)

Features to add once the core is working and the user has lived with it for a few weeks.

- [ ] **Dividends page** -- Trigger: first dividend payment after launch. Low complexity.
- [ ] **Deposits page** -- Trigger: monthly deposit. Very low complexity.
- [ ] **Monthly performance page** -- Trigger: first month-end snapshot. Historical data is already migrated.
- [ ] **Unified stocks + options allocation view** -- Trigger: user wants to see LEAPS weight in portfolio. This is the big differentiator but requires manual LEAPS value entry workflow to be smooth.
- [ ] **Top movers cards** -- Trigger: portfolio overview feels sparse. Quick addition.
- [ ] **Dividend income goal progress bar** -- Trigger: dividend page exists. Low complexity.
- [ ] **Options expiration calendar** -- Trigger: missed an expiration because it wasn't visible. Medium complexity.

### Future Consideration (v2+)

Features to defer until the tool has proven its value.

- [ ] **UK tax estimates page** -- Complex calculation, only needed at tax season (April). Build when approaching first tax deadline.
- [ ] **Benchmark comparison (portfolio vs S&P 500)** -- Requires accumulated price_history data. More meaningful after months of daily syncs.
- [ ] **Forward dividend projection** -- Nice to have, needs dividend_yield data from FMP which may not be fully reliable for all holdings.
- [ ] **Per-broker P&L breakdown** -- Interesting but not urgent. The user knows which brokers they use.
- [ ] **CSV import for transactions** -- Only if manual entry becomes burdensome for large batches.
- [ ] **Close/roll option workflow** -- PATCH endpoint for updating option status. Currently can be done in NocoDB directly.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Data migration | HIGH | MEDIUM | P1 |
| FMP price sync | HIGH | LOW | P1 |
| Portfolio overview | HIGH | MEDIUM | P1 |
| Transaction history | HIGH | MEDIUM | P1 |
| Options dashboard | HIGH | MEDIUM | P1 |
| Add transaction form | HIGH | MEDIUM | P1 |
| Add option form | HIGH | MEDIUM | P1 |
| Dark theme | MEDIUM | LOW | P1 |
| Dividends page | MEDIUM | LOW | P2 |
| Deposits page | LOW | LOW | P2 |
| Performance page | MEDIUM | LOW | P2 |
| Unified stock+options view | HIGH | HIGH | P2 |
| Top movers | LOW | LOW | P2 |
| Dividend goal tracking | MEDIUM | LOW | P2 |
| Expiration calendar | MEDIUM | MEDIUM | P2 |
| UK tax estimates | MEDIUM | HIGH | P3 |
| Benchmark comparison | LOW | MEDIUM | P3 |
| Forward dividend projection | LOW | MEDIUM | P3 |
| Per-broker breakdown | LOW | LOW | P3 |
| CSV import | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the spreadsheet replacement
- P2: Should have -- the spreadsheet upgrade
- P3: Nice to have -- the custom tool advantage

---

## Competitor Feature Analysis

| Feature | Ghostfolio (FOSS) | Sharesight (SaaS, UK) | TrackTheta (Options) | Folio (Our Approach) |
|---------|-------------------|-----------------------|----------------------|---------------------|
| Stock portfolio tracking | Yes, multi-asset | Yes, 200+ exchanges | No (options only) | Yes, with live FMP prices |
| Options tracking | No | No | Yes (wheel focus) | Yes, wheel + LEAPS |
| Combined stock+options view | N/A | N/A | N/A | Yes -- this is the differentiator |
| Cost basis calculation | Yes (FIFO) | Yes (multiple methods) | Per-trade only | Weighted average (Section 104 compatible) |
| UK tax reporting | No | Yes (paid plan) | No | Estimated, with caveats |
| Dividend tracking | Yes | Yes (automatic) | No | Yes, manual from data |
| Broker auto-import | Via data providers | Yes (200+ brokers) | IBKR only | No -- manual + migration |
| Benchmark comparison | Yes | Yes | No | Yes (v2, SPY via FMP) |
| Self-hosted | Yes (Docker) | No (SaaS) | No (SaaS) | Yes (NocoDB + Next.js) |
| Price source | Yahoo Finance | Own data | N/A | FMP API |
| Wheel strategy metrics | No | No | Yes (core feature) | Yes (premium, win rate, annualised return) |
| LEAPS tracking | No | No | Partial | Yes (break-even, DTE, P&L) |
| Dark theme | Yes | No | Yes | Yes (default) |
| Mobile app | No | Yes | No | No (desktop-first, responsive fallback) |

**Key insight:** No single existing tool combines stock portfolio tracking with options wheel strategy analytics and UK tax awareness. Folio fills a genuine gap by unifying these three concerns. Ghostfolio is the closest for stocks but has zero options support. TrackTheta is excellent for wheel tracking but knows nothing about the broader portfolio. Sharesight handles UK tax but charges for it and has no options tracking.

---

## Sources

- [Benzinga: 15 Best Stock Portfolio Trackers (Jan 2026)](https://www.benzinga.com/money/best-portfolio-tracker)
- [Stock Analysis: 9 Best Stock Portfolio Trackers](https://stockanalysis.com/article/best-stock-portfolio-tracker/)
- [Wall Street Zen: 10 Best Stock Portfolio Trackers 2026](https://www.wallstreetzen.com/blog/best-stock-portfolio-tracker/)
- [Ghostfolio GitHub](https://github.com/ghostfolio/ghostfolio)
- [Wealthfolio](https://wealthfolio.app/)
- [TrackTheta Features](https://www.tracktheta.com/features)
- [Wheelytics Demo](https://wheelytics.com/demo)
- [Option Wheel Tracker](https://optionwheeltracker.com/)
- [CoveredWheel](https://www.coveredwheel.com/)
- [Wheel Strategy Options: Trade Tracking](https://wheelstrategyoptions.com/blog/optimizing-wheel-strategy-the-imperative-of-meticulous-trade-tracking-for-superior-returns/)
- [Sharesight UK Tax Reporting](https://www.sharesight.com/uk/investment-portfolio-tax/)
- [HMRC HS284: Shares and Capital Gains Tax](https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet)
- [Financial Software Ltd: UK CGT Rules](https://www.financialsoftware.co.uk/uk-capital-gains-tax-30-day-same-day-section-104-rules/)
- [Nestor: UK Dividend Tracker](https://www.nestordividendtracker.co.uk/)
- [Snowball Analytics](https://www.snowballanalytics.com/)

---
*Feature research for: Personal investment tracking dashboard (stocks + options, UK tax)*
*Researched: 2026-02-06*
