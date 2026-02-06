# Requirements: Folio

**Defined:** 2026-02-06
**Core Value:** One place to see the full portfolio — stocks and bought options together with live prices — without manually maintaining a spreadsheet.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Foundation

- [x] **DATA-01**: Python migration script reads stocks-v2.numbers and imports all data into NocoDB (symbols, transactions, options, deposits, monthly snapshots, sector mappings)
- [x] **DATA-02**: Migration creates NocoDB tables programmatically via REST API if they don't exist
- [x] **DATA-03**: Migration unpivots deposit rows (one per platform per month) from the pivot format in the spreadsheet
- [x] **DATA-04**: Migration normalises platform names (Etoro → eToro, Hood → Robinhood)
- [x] **DATA-05**: Migration extracts unique symbols from transactions and populates symbols table with sector and strategy
- [x] **DATA-06**: Migration imports both Wheel (164 rows) and LEAPS (36 rows) options into a single options table with strategy_type distinction
- [x] **DATA-07**: Migration prints summary of imported record counts and validates against expected totals
- [x] **DATA-08**: Typed NocoDB REST client in TypeScript with parallel fetching, auto-pagination, and server-only import guard
- [x] **DATA-09**: FMP price sync updates all symbols with current price, change%, day high/low, year high/low, PE, EPS, market cap, dividend yield
- [x] **DATA-10**: FMP sync inserts daily close prices into price_history table
- [x] **DATA-11**: FMP sync runs via daily cron (9pm UK, after US market close) and via manual "Sync Now" button in UI
- [x] **DATA-12**: Brokers marked as active (IBKR, Trading 212, Robinhood) or archived (Freetrade, Stake, eToro) in settings or symbols

### Portfolio Overview

- [ ] **PORT-01**: Holdings table showing symbol, name, shares, avg cost, current price, market value, P&L (£), P&L (%), day change (%), sector, strategy, weight (%)
- [ ] **PORT-02**: Holdings table is sortable by any column and filterable by symbol search
- [ ] **PORT-03**: Only symbols with current shares > 0 shown (fully sold positions excluded)
- [ ] **PORT-04**: Summary cards: Total Portfolio Value, Total P&L, Day Change, Total Deposited, Options Premium Collected
- [ ] **PORT-05**: Sector allocation donut chart
- [ ] **PORT-06**: Strategy allocation donut chart (Growth/Value/Risky)
- [ ] **PORT-07**: Unified portfolio view showing stocks AND bought options together for weight/allocation visibility
- [ ] **PORT-08**: Bought options (LEAPS and other) appear as positions with manually-updated market values for P&L and weight
- [ ] **PORT-09**: Top 5 gainers and top 5 losers cards (by day change and overall P&L)
- [ ] **PORT-10**: Per-broker P&L and allocation breakdown (donut chart + summary)
- [ ] **PORT-11**: Benchmark comparison: portfolio vs S&P 500 normalised to 100 at start date (line chart)
- [ ] **PORT-12**: Clicking a symbol row shows detail view with all transactions for that symbol

### Transactions

- [ ] **TRAN-01**: Transaction history table with columns: Date, Symbol, Name, Type (Buy/Sell badge), Price, Shares, Amount, Platform, EPS
- [ ] **TRAN-02**: Filter bar: symbol search, platform dropdown, date range picker, buy/sell toggle
- [ ] **TRAN-03**: Sortable by any column, default sort by date descending
- [ ] **TRAN-04**: Paginated (50 per page)
- [ ] **TRAN-05**: Add Transaction form: symbol (autocomplete), type, price, shares, date, platform — amount auto-calculates
- [ ] **TRAN-06**: Adding a new symbol via transaction form creates the symbol in the symbols table

### Options

- [ ] **OPTS-01**: Options dashboard with tab group: Wheel | LEAPS | All
- [ ] **OPTS-02**: Stat cards: Total Premium Collected, Capital Gains P&L (assigned), Win Rate, Avg Days Held
- [ ] **OPTS-03**: Wheel open positions table: Ticker, Opened, C/P, Strike, Expiration, Days to Expiry, Delta, Premium, Collateral, Status
- [ ] **OPTS-04**: Wheel open positions highlight rows where expiration is within 7 days (amber) or past (red)
- [ ] **OPTS-05**: Wheel closed positions table: Ticker, Opened, Closed, C/P, Strike, Premium, Profit, Days Held, Return%, Annualised Return%, Status
- [ ] **OPTS-06**: LEAPS table: Ticker, Opened, C/P, Strike, Current Price, Expiration, Days to Expiry, Premium Paid, Current P&L, Delta, IV%
- [ ] **OPTS-07**: Monthly premium bar chart (X = month, Y = premium collected, grouped by Wheel vs LEAPS)
- [ ] **OPTS-08**: Add Option form: ticker, strategy_type, call/put, buy/sell, strike, expiration, qty, premium (required); delta, IV, moneyness, collateral, notes (optional)
- [ ] **OPTS-09**: Close/roll option workflow: update status, close date, close premium, profit — auto-calculate days held and return%
- [ ] **OPTS-10**: Expiration calendar/timeline: visual display of upcoming expirations colour-coded by DTE (green >30d, amber 7-30d, red <7d)

### Dividends

- [ ] **DIVD-01**: Individual dividend payment tracking: symbol, amount, date, platform
- [ ] **DIVD-02**: Annual dividend income total card
- [ ] **DIVD-03**: Dividend income goal progress bar (configurable goal in settings)
- [ ] **DIVD-04**: Monthly dividend bar chart (current year vs previous year grouped bars)
- [ ] **DIVD-05**: By-symbol horizontal bar chart (sorted by highest income first)
- [ ] **DIVD-06**: Forward dividend projection: shares × dividend_yield × current_price for each holding
- [ ] **DIVD-07**: Dividend history table
- [ ] **DIVD-08**: Add Dividend form or ability to record dividend payments

### Deposits

- [ ] **DEPS-01**: Summary cards: Total Deposited All Time, This Year's Deposits
- [ ] **DEPS-02**: Cumulative deposits line chart (running total over time)
- [ ] **DEPS-03**: Deposits by platform donut chart
- [ ] **DEPS-04**: Monthly deposit table (Month, Total, and per-platform columns mirroring spreadsheet format)
- [ ] **DEPS-05**: Add Deposit form: month, amount, platform

### Performance

- [ ] **PERF-01**: Summary cards: Time-Weighted Return, Best Month, Worst Month
- [ ] **PERF-02**: Portfolio value over time line chart (from monthly_snapshots) with total_invested overlay
- [ ] **PERF-03**: Monthly performance table: Month, Invested, Portfolio Value, Gain/Loss (£), Gain/Loss (%), Dividends, Options Premium, Total Income

### UI & Layout

- [x] **UI-01**: Dark theme by default (dark navy/charcoal, finance-standard green gains / red losses)
- [x] **UI-02**: Sidebar navigation: Portfolio, Transactions, Options, Dividends, Deposits, Performance
- [x] **UI-03**: Last synced timestamp and "Sync Now" button in sidebar
- [ ] **UI-04**: Active vs archived broker distinction visible in UI (archived brokers greyed or labelled)
- [x] **UI-05**: Responsive layout: desktop-first, tables horizontally scrollable on mobile, cards stack vertically
- [x] **UI-06**: Sidebar collapses to hamburger on mobile

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Tax Estimates

- **TAX-01**: UK income tax calculation with current bands (personal allowance, basic, higher, additional)
- **TAX-02**: UK dividend tax calculation with allowance and band-specific rates
- **TAX-03**: UK capital gains tax estimate using average cost basis (labelled as estimate)
- **TAX-04**: Configurable salary and tax year inputs
- **TAX-05**: Auto-populate dividends and realised gains from portfolio data

### Advanced Analytics

- **ANLYT-01**: Per-ticker wheel strategy performance breakdown
- **ANLYT-02**: Capital efficiency metric (premium / collateral) for options
- **ANLYT-03**: CSV import for bulk transaction entry

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Broker API auto-import | Fragile APIs, OAuth complexity, 6x effort for multi-broker. Manual entry + one-time migration sufficient. |
| Real-time streaming prices | FMP free tier limited. Daily sync + manual refresh sufficient for portfolio decisions. |
| Live options pricing / Greeks | No free reliable API. Manual market value entry matches current workflow. |
| Multi-currency with live FX | Adds complexity to every calculation. Display native currency, use stored FX rate for GBP totals. |
| Full Section 104 CGT compliance | Same-day rule, 30-day bed-and-breakfast, pooling is genuinely complex. Use average cost basis as estimate, defer full compliance. |
| Mobile-first design | Desktop analytics tool. Responsive fallback only. |
| Automated rebalancing | Misleading across 6 brokers with different fees/tax implications. Show allocation, let user decide. |
| News feed / research | Separate concern. Link symbols to Yahoo Finance / TradingView instead. |
| Watchlist / paper trading | Separate from portfolio tracking. User has broker apps for this. |
| Trade journaling | Options notes field sufficient. Full journaling is a separate product. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| DATA-08 | Phase 1 | Complete |
| DATA-09 | Phase 2 | Complete |
| DATA-10 | Phase 2 | Complete |
| DATA-11 | Phase 2 | Complete |
| DATA-12 | Phase 1 | Complete |
| PORT-01 | Phase 3 | Pending |
| PORT-02 | Phase 3 | Pending |
| PORT-03 | Phase 3 | Pending |
| PORT-04 | Phase 3 | Pending |
| PORT-05 | Phase 3 | Pending |
| PORT-06 | Phase 3 | Pending |
| PORT-07 | Phase 8 | Pending |
| PORT-08 | Phase 8 | Pending |
| PORT-09 | Phase 3 | Pending |
| PORT-10 | Phase 3 | Pending |
| PORT-11 | Phase 7 | Pending |
| PORT-12 | Phase 3 | Pending |
| TRAN-01 | Phase 4 | Pending |
| TRAN-02 | Phase 4 | Pending |
| TRAN-03 | Phase 4 | Pending |
| TRAN-04 | Phase 4 | Pending |
| TRAN-05 | Phase 6 | Pending |
| TRAN-06 | Phase 6 | Pending |
| OPTS-01 | Phase 4 | Pending |
| OPTS-02 | Phase 4 | Pending |
| OPTS-03 | Phase 4 | Pending |
| OPTS-04 | Phase 4 | Pending |
| OPTS-05 | Phase 4 | Pending |
| OPTS-06 | Phase 4 | Pending |
| OPTS-07 | Phase 4 | Pending |
| OPTS-08 | Phase 6 | Pending |
| OPTS-09 | Phase 6 | Pending |
| OPTS-10 | Phase 8 | Pending |
| DIVD-01 | Phase 5 | Pending |
| DIVD-02 | Phase 5 | Pending |
| DIVD-03 | Phase 5 | Pending |
| DIVD-04 | Phase 5 | Pending |
| DIVD-05 | Phase 5 | Pending |
| DIVD-06 | Phase 8 | Pending |
| DIVD-07 | Phase 5 | Pending |
| DIVD-08 | Phase 6 | Pending |
| DEPS-01 | Phase 5 | Pending |
| DEPS-02 | Phase 5 | Pending |
| DEPS-03 | Phase 5 | Pending |
| DEPS-04 | Phase 5 | Pending |
| DEPS-05 | Phase 6 | Pending |
| PERF-01 | Phase 7 | Pending |
| PERF-02 | Phase 7 | Pending |
| PERF-03 | Phase 7 | Pending |
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| UI-03 | Phase 2 | Complete |
| UI-04 | Phase 6 | Pending |
| UI-05 | Phase 1 | Complete |
| UI-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after Phase 2 completion*
