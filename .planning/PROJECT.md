# Folio

## What This Is

A personal investment tracking dashboard that replaces an Apple Numbers spreadsheet. Tracks stock transactions, options trading (wheel strategy selling + LEAPS/bought options), deposits, dividends, and UK tax estimates across 6 brokers. NocoDB (self-hosted, already running) serves as the database, Next.js as the frontend, and FMP API (free tier, key available) for live stock pricing.

## Core Value

One place to see the full portfolio — stocks and bought options together with live prices — without manually maintaining a spreadsheet.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] One-time data migration from `stocks-v2.numbers` into NocoDB (964 transactions, 200 options, 74 months of deposits)
- [ ] Live stock price sync via FMP API with daily cron + manual "Sync Now" from UI
- [ ] Portfolio overview showing stocks and bought options together with weight allocation, P&L, sector/strategy breakdowns
- [ ] Holdings table with current prices, cost basis, P&L, day change — sortable and filterable
- [ ] Options dashboard with separate views for wheel selling history and LEAPS/bought options
- [ ] Full options detail tracking: IV, delta, greeks, moneyness, expiry, premium, profit, annualised return
- [ ] Transaction log with filtering by symbol, platform, date, buy/sell — plus add transaction form
- [ ] Dividend tracking with annual income, goal progress, monthly breakdown, by-symbol breakdown
- [ ] Deposit tracking with cumulative chart, platform breakdown, monthly table
- [ ] Performance page with portfolio value over time, monthly performance table, benchmark vs S&P 500
- [ ] UK tax estimates (income tax, dividend tax, CGT) with configurable salary and tax year
- [ ] Broker distinction: active (IBKR, Trading 212, Robinhood) vs archived (Freetrade, Stake, eToro)
- [ ] Add forms for transactions, options, deposits via the UI (NocoDB direct edit as fallback)
- [ ] Dark theme by default (finance-standard: green gains, red losses)
- [ ] Sidebar navigation across all pages with last-synced indicator

### Out of Scope

- Live option contract pricing — no reliable free API; option market values updated manually
- OAuth/multi-user auth — personal tool, single user, no login needed
- Mobile app — web-first, responsive but desktop-focused
- Real-time streaming prices — daily sync + manual refresh is sufficient
- Automated broker data imports — manual entry or NocoDB direct

## Context

- The `stocks-v2.numbers` file is in the project root and is the current source of truth
- NocoDB instance is already running and accessible (self-hosted)
- FMP API key is already available; free tier allows ~250 calls/day (3 batch calls per sync for ~120 symbols)
- User actively trades options (wheel strategy for premium income, LEAPS for leveraged exposure)
- Bought options (including LEAPS) appear in portfolio alongside stocks for weight/P&L visibility but with simplified data — full detail lives in the options table
- When wheel puts get assigned, user manually adds a stock buy transaction at the strike price
- Option market values are updated manually from time to time (no automated pricing)
- The existing implementation plan (`FOLIO-IMPLEMENTATION-PLAN.md`) contains detailed NocoDB schemas, API specs, page layouts, and calculation logic

## Constraints

- **Backend**: NocoDB REST API only — no direct database access, no custom backend server
- **Pricing API**: FMP free tier — ~250 calls/day, stock quotes only (no options chain)
- **Tech stack**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Data migration**: Python scripts using numbers-parser for one-time import
- **Server-side only**: All API keys stay server-side (Next.js Server Components / Route Handlers)
- **Brokers**: Platform enum — IBKR, Trading 212, Freetrade, Stake, eToro, Robinhood (fixed set)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NocoDB as backend instead of custom DB | Already running, self-hosted, REST API, no extra infra | — Pending |
| FMP for pricing instead of alternatives | Key already available, free tier sufficient for portfolio size | — Pending |
| Manual option pricing instead of automated | No free reliable options pricing API; matches current workflow | — Pending |
| Bought options in portfolio view | User tracks weight/P&L of all positions together, not just stocks | — Pending |
| Active/archived broker distinction | 3 of 6 brokers are historical; keep data but visually separate | — Pending |
| Python for migration, TypeScript for dashboard | numbers-parser is Python; dashboard is Next.js ecosystem | — Pending |

---
*Last updated: 2026-02-06 after initialization*
