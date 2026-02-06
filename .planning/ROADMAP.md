# Roadmap: Folio

## Overview

Folio replaces a manually-maintained Apple Numbers spreadsheet with a live investment dashboard. The build progresses from data foundation (migration + NocoDB client) through live pricing and core calculations, into the primary portfolio view, then secondary display pages (transactions, options, dividends, deposits), write operations (forms and API routes), performance analytics, and finally advanced features (unified portfolio view, expiration calendar, dividend projections). Eight phases deliver all 62 v1 requirements, with each phase producing a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Data Migration** - NocoDB client, Python migration script, project scaffolding with dark theme shell
- [x] **Phase 2: Live Pricing & Core Calculations** - FMP price sync, holdings calculation engine with Big.js, daily cron
- [ ] **Phase 3: Portfolio Overview** - Primary dashboard page with holdings table, summary cards, allocation charts, top movers
- [ ] **Phase 4: Transactions & Options Display** - Transaction history and options dashboard (read-only views)
- [ ] **Phase 5: Dividends & Deposits Display** - Dividend tracking page and deposits page (read-only views)
- [ ] **Phase 6: Write Operations** - Add forms and API routes for transactions, options, deposits, dividends, and option close/roll workflow
- [ ] **Phase 7: Performance Analytics** - Portfolio value over time, monthly performance table, benchmark comparison
- [ ] **Phase 8: Advanced Features** - Unified stocks+options portfolio view, expiration calendar, dividend projections

## Phase Details

### Phase 1: Foundation & Data Migration
**Goal**: All historical data lives in NocoDB and the application shell renders with dark theme navigation
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-12, UI-01, UI-02, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Running the Python migration script imports all 964 transactions, ~200 options, 74 months of deposits, and monthly snapshots into NocoDB with correct record counts
  2. The NocoDB TypeScript client can fetch records from all tables with pagination, filtering, and parallel requests — and refuses to import on the client side
  3. The Next.js app renders a dark-themed shell with sidebar navigation listing all pages and a responsive layout that collapses to hamburger on mobile
  4. Brokers are distinguished as active (IBKR, Trading 212, Robinhood) or archived (Freetrade, Stake, eToro) in the data layer
  5. Platform names from the spreadsheet are normalised (Etoro to eToro, Hood to Robinhood) and symbols have correct sector/strategy mappings
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — Next.js project scaffolding with dark theme, sidebar layout, and responsive shell (Wave 1)
- [x] 01-02-PLAN.md — NocoDB TypeScript REST client with typed functions, server-only guard, parallel fetch, and auto-pagination (Wave 2, depends on 01-01)
- [x] 01-03-PLAN.md — Python migration script: read .numbers file, create tables, import all data with validation (Wave 1)

### Phase 2: Live Pricing & Core Calculations
**Goal**: Symbols have current prices from FMP and the holdings calculation engine produces accurate P&L using decimal arithmetic
**Depends on**: Phase 1
**Requirements**: DATA-09, DATA-10, DATA-11, UI-03
**Success Criteria** (what must be TRUE):
  1. Running the price sync (Python script or Sync Now button) updates all ~120 symbols with current price, change%, day high/low, year high/low, PE, EPS, market cap, and dividend yield from FMP
  2. Daily close prices are recorded in the price_history table after each sync
  3. The sidebar displays a "Last synced" timestamp and a "Sync Now" button that triggers a manual FMP refresh via the /api/sync route handler
  4. The calculations library computes holdings (shares, avg cost basis, P&L, weight) using Big.js decimal arithmetic with results matching broker statements to the penny
**Plans**: 3 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md — FMP client library, FMP types, NocoDB bulk operations (Wave 1)
- [x] 02-02-PLAN.md — Sync route handler with streaming, SWR hooks, sidebar Sync Now button + last-synced (Wave 2, depends on 02-01)
- [x] 02-03-PLAN.md — Calculations engine (Section 104 pool, P&L, weights) with Big.js via TDD (Wave 1)

### Phase 3: Portfolio Overview
**Goal**: The primary dashboard page shows all current holdings with live prices, P&L, allocation breakdowns, and top movers
**Depends on**: Phase 2
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-09, PORT-10, PORT-12
**Success Criteria** (what must be TRUE):
  1. The holdings table shows symbol, shares, avg cost, current price, market value, P&L, day change, sector, strategy, and weight — sortable by any column and filterable by symbol search
  2. Only symbols with shares > 0 appear in the holdings table (fully sold positions are excluded)
  3. Summary cards display total portfolio value, total P&L, day change, total deposited, and options premium collected
  4. Sector and strategy allocation donut charts show the portfolio breakdown by sector and by investment strategy
  5. Top 5 gainers and top 5 losers cards are visible (by day change and overall P&L), and clicking a symbol row shows all transactions for that symbol
**Plans**: TBD

Plans:
- [ ] 03-01: Portfolio page server component with parallel data fetching and holdings computation
- [ ] 03-02: Holdings table client component (sortable, filterable, symbol detail drill-down)
- [ ] 03-03: Summary cards, allocation charts, per-broker breakdown, and top movers

### Phase 4: Transactions & Options Display
**Goal**: Users can browse full transaction history and the complete options dashboard with Wheel and LEAPS views (read-only)
**Depends on**: Phase 2
**Requirements**: TRAN-01, TRAN-02, TRAN-03, TRAN-04, OPTS-01, OPTS-02, OPTS-03, OPTS-04, OPTS-05, OPTS-06, OPTS-07
**Success Criteria** (what must be TRUE):
  1. The transaction history table displays date, symbol, name, type (Buy/Sell badge), price, shares, amount, platform, and EPS — sortable by any column with default date descending, paginated at 50 per page
  2. Transaction filters work: symbol search, platform dropdown, date range picker, and buy/sell toggle all narrow results correctly
  3. The options dashboard shows Wheel, LEAPS, and All tabs with stat cards (total premium, capital gains P&L, win rate, avg days held)
  4. Wheel open positions highlight rows where expiration is within 7 days (amber) or past due (red), and closed positions show profit, return%, and annualised return%
  5. The LEAPS table shows current price, days to expiry, premium paid, current P&L, delta, and IV% for each position
**Plans**: TBD

Plans:
- [ ] 04-01: Transaction history page with sortable/filterable/paginated table
- [ ] 04-02: Options dashboard page with Wheel/LEAPS/All tabs and stat cards
- [ ] 04-03: Wheel open/closed tables with expiry highlighting and LEAPS tracker table
- [ ] 04-04: Monthly premium bar chart (Wheel vs LEAPS grouped by month)

### Phase 5: Dividends & Deposits Display
**Goal**: Users can view dividend income tracking and deposit history with charts and breakdowns (read-only)
**Depends on**: Phase 2
**Requirements**: DIVD-01, DIVD-02, DIVD-03, DIVD-04, DIVD-05, DIVD-07, DEPS-01, DEPS-02, DEPS-03, DEPS-04
**Success Criteria** (what must be TRUE):
  1. The dividends page shows annual income total, dividend goal progress bar, monthly bar chart (current year vs previous year), and by-symbol horizontal bar chart sorted by highest income
  2. Individual dividend payments are tracked by symbol, amount, date, and platform in a dividend history table
  3. The deposits page shows total deposited all time, this year's deposits, a cumulative deposits line chart, a by-platform donut chart, and a monthly deposit table with per-platform columns
**Plans**: TBD

Plans:
- [ ] 05-01: Dividends page with income cards, goal progress, monthly and by-symbol charts, and history table
- [ ] 05-02: Deposits page with summary cards, cumulative line chart, platform donut chart, and monthly table

### Phase 6: Write Operations
**Goal**: Users can add transactions, options, deposits, and dividends through the dashboard and close/roll options with auto-calculated fields
**Depends on**: Phase 4, Phase 5
**Requirements**: TRAN-05, TRAN-06, OPTS-08, OPTS-09, DIVD-08, DEPS-05, UI-04
**Success Criteria** (what must be TRUE):
  1. The Add Transaction form accepts symbol (with autocomplete), type, price, shares, date, and platform — amount auto-calculates — and submitting creates the transaction in NocoDB, with new symbols auto-created in the symbols table
  2. The Add Option form accepts all required fields (ticker, strategy_type, call/put, buy/sell, strike, expiration, qty, premium) plus optional fields (delta, IV, moneyness, collateral, notes) and creates the option in NocoDB
  3. The Close/Roll option workflow updates status, close date, close premium, and profit — with days held and return% auto-calculated
  4. Add Deposit and Add Dividend forms create records in NocoDB and the affected pages refresh to show new data
  5. Archived brokers (Freetrade, Stake, eToro) are visually distinguished from active brokers in the UI (greyed or labelled)
**Plans**: TBD

Plans:
- [ ] 06-01: Validation schemas (zod) and route handlers for transactions, options, deposits, dividends
- [ ] 06-02: Add Transaction form with symbol autocomplete, auto-calculated amount, and new symbol creation
- [ ] 06-03: Add Option form and Close/Roll option workflow with auto-calculated fields
- [ ] 06-04: Add Deposit form, Add Dividend form, and archived broker visual distinction

### Phase 7: Performance Analytics
**Goal**: Users can see portfolio performance over time with monthly breakdowns and a benchmark comparison against the S&P 500
**Depends on**: Phase 3
**Requirements**: PERF-01, PERF-02, PERF-03, PORT-11
**Success Criteria** (what must be TRUE):
  1. Summary cards show time-weighted return, best month, and worst month
  2. A portfolio value over time line chart (from monthly_snapshots) shows portfolio value with a total_invested overlay line
  3. The monthly performance table shows month, invested, portfolio value, gain/loss, gain/loss %, dividends, options premium, and total income for each period
  4. A benchmark comparison line chart plots portfolio vs S&P 500 both normalised to 100 at the portfolio start date
**Plans**: TBD

Plans:
- [ ] 07-01: Performance page with summary cards and portfolio value over time chart
- [ ] 07-02: Monthly performance table and benchmark comparison chart (portfolio vs S&P 500)

### Phase 8: Advanced Features
**Goal**: The portfolio view includes bought options alongside stocks for unified allocation visibility, with an expiration calendar and forward dividend projections
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: PORT-07, PORT-08, OPTS-10, DIVD-06
**Success Criteria** (what must be TRUE):
  1. The portfolio overview shows stocks AND bought options (LEAPS and other) together in a unified view for weight and allocation visibility
  2. Bought options appear as positions with manually-updated market values contributing to P&L and portfolio weight calculations
  3. An expiration calendar/timeline displays upcoming option expirations colour-coded by days to expiry (green >30d, amber 7-30d, red <7d)
  4. Forward dividend projection estimates next 12 months income based on shares x dividend_yield x current_price for each holding
**Plans**: TBD

Plans:
- [ ] 08-01: Unified stocks + bought options portfolio view with combined weight and allocation
- [ ] 08-02: Options expiration calendar/timeline with DTE colour coding
- [ ] 08-03: Forward dividend projection calculations and display

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 (and 4, 5 in parallel) -> 6 -> 7 -> 8

Note: Phases 3, 4, and 5 all depend on Phase 2 and can be worked on in parallel. Phase 6 depends on Phases 4 and 5 (needs the display pages to attach forms to). Phase 7 depends on Phase 3. Phase 8 depends on Phases 3, 4, and 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Migration | 3/3 | ✓ Complete | 2026-02-06 |
| 2. Live Pricing & Core Calculations | 3/3 | ✓ Complete | 2026-02-06 |
| 3. Portfolio Overview | 0/3 | Not started | - |
| 4. Transactions & Options Display | 0/4 | Not started | - |
| 5. Dividends & Deposits Display | 0/2 | Not started | - |
| 6. Write Operations | 0/4 | Not started | - |
| 7. Performance Analytics | 0/2 | Not started | - |
| 8. Advanced Features | 0/3 | Not started | - |
