# Folio — Implementation Plan for Claude Code

## Project Overview

**Folio** is a personal investment tracking dashboard. It replaces an Apple Numbers spreadsheet that tracks stock transactions, options trading (wheel strategy + LEAPS), deposits, dividends, and UK tax calculations across 6 brokers.

The architecture is: **NocoDB** (already running, self-hosted) as the database/backend → **Next.js dashboard** as the frontend → **FMP API** (key already available) for live pricing.

NocoDB already exists and is running. The FMP API key is already available. You are building:
1. A Python data migration script (one-time import from the .numbers file)
2. A Python FMP price sync service
3. A Next.js dashboard frontend

---

## Part 1: Repository Structure

```
folio/
├── README.md
├── docker-compose.yml              # Optional: for running the dashboard
├── .env.example                     # Template for secrets
│
├── scripts/
│   ├── requirements.txt             # Python deps: numbers-parser, requests, python-dotenv
│   ├── migrate.py                   # One-time migration from .numbers → NocoDB
│   ├── sync_prices.py               # FMP → NocoDB price updater (run via cron)
│   └── utils/
│       └── nocodb_client.py         # Shared NocoDB API wrapper
│
├── dashboard/                       # Next.js app
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .env.local.example
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout with sidebar nav
│   │   │   ├── page.tsx             # Portfolio Overview (default page)
│   │   │   ├── transactions/
│   │   │   │   └── page.tsx
│   │   │   ├── options/
│   │   │   │   └── page.tsx
│   │   │   ├── dividends/
│   │   │   │   └── page.tsx
│   │   │   ├── deposits/
│   │   │   │   └── page.tsx
│   │   │   ├── performance/
│   │   │   │   └── page.tsx
│   │   │   └── tax/
│   │   │       └── page.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── nocodb.ts            # NocoDB API client (typed)
│   │   │   ├── fmp.ts               # FMP API client (for any client-side calls)
│   │   │   ├── calculations.ts      # Portfolio math: cost basis, P&L, returns
│   │   │   └── types.ts             # TypeScript interfaces for all data models
│   │   │
│   │   └── components/
│   │       ├── ui/                  # Shared primitives (Card, Table, Badge, etc.)
│   │       ├── charts/              # Recharts wrappers
│   │       │   ├── SectorPieChart.tsx
│   │       │   ├── PerformanceLineChart.tsx
│   │       │   ├── DepositBarChart.tsx
│   │       │   └── OptionsPremiumChart.tsx
│   │       ├── portfolio/
│   │       │   ├── HoldingsTable.tsx
│   │       │   ├── PortfolioSummaryCards.tsx
│   │       │   └── TopMovers.tsx
│   │       ├── transactions/
│   │       │   ├── TransactionTable.tsx
│   │       │   └── TransactionForm.tsx
│   │       ├── options/
│   │       │   ├── OptionsTable.tsx
│   │       │   ├── WheelStats.tsx
│   │       │   ├── LeapsTracker.tsx
│   │       │   └── OptionForm.tsx
│   │       └── layout/
│   │           ├── Sidebar.tsx
│   │           └── Header.tsx
│   │
│   └── public/
│       └── favicon.ico
│
└── .gitignore
```

---

## Part 2: Environment Variables

**.env.example** (root, for Python scripts):
```env
NOCODB_BASE_URL=http://localhost:8080
NOCODB_API_TOKEN=your_nocodb_api_token
NOCODB_BASE_ID=your_base_id
FMP_API_KEY=your_fmp_api_key
```

**dashboard/.env.local.example** (for Next.js):
```env
NOCODB_BASE_URL=http://localhost:8080
NOCODB_API_TOKEN=your_nocodb_api_token
NOCODB_BASE_ID=your_base_id
FMP_API_KEY=your_fmp_api_key
```

---

## Part 3: NocoDB Schema

The NocoDB instance is already running. The migration script should create these tables programmatically via the NocoDB REST API. If tables already exist, skip creation.

### NocoDB REST API Reference

**Auth header:** `xc-token: {NOCODB_API_TOKEN}`

**Create table:** `POST /api/v2/meta/bases/{baseId}/tables`
```json
{
  "table_name": "symbols",
  "columns": [
    { "column_name": "symbol", "uidt": "SingleLineText" },
    { "column_name": "name", "uidt": "SingleLineText" }
  ]
}
```

**Insert row:** `POST /api/v2/tables/{tableId}/records`
```json
{ "symbol": "AAPL", "name": "Apple Inc.", "sector": "Tech" }
```

**Bulk insert:** `POST /api/v2/tables/{tableId}/records` with array body

**Update row:** `PATCH /api/v2/tables/{tableId}/records`
```json
{ "Id": 1, "current_price": 185.50 }
```

**Query rows:** `GET /api/v2/tables/{tableId}/records?where=(symbol,eq,AAPL)&limit=100&offset=0`

**Field types (uidt values):** SingleLineText, LongText, Number, Decimal, Currency, Date, DateTime, SingleSelect, MultiSelect, Checkbox, Email, URL, Formula, LinkToAnotherRecord, Lookup, Rollup, CreatedTime, LastModifiedTime

### Table Definitions

**When creating tables, use these exact schemas:**

#### Table 1: `symbols`
```json
{
  "table_name": "symbols",
  "columns": [
    { "column_name": "symbol", "uidt": "SingleLineText" },
    { "column_name": "name", "uidt": "SingleLineText" },
    { "column_name": "sector", "uidt": "SingleSelect", "dtxp": "'Tech','Financial','Retail','Communication','Healthcare','Energy','Industrial','Real Estate','ETF','Crypto'" },
    { "column_name": "strategy", "uidt": "SingleSelect", "dtxp": "'Growth','Value','Risky'" },
    { "column_name": "current_price", "uidt": "Decimal" },
    { "column_name": "previous_close", "uidt": "Decimal" },
    { "column_name": "change_pct", "uidt": "Decimal" },
    { "column_name": "day_high", "uidt": "Decimal" },
    { "column_name": "day_low", "uidt": "Decimal" },
    { "column_name": "year_high", "uidt": "Decimal" },
    { "column_name": "year_low", "uidt": "Decimal" },
    { "column_name": "market_cap", "uidt": "Number" },
    { "column_name": "pe_ratio", "uidt": "Decimal" },
    { "column_name": "eps", "uidt": "Decimal" },
    { "column_name": "dividend_yield", "uidt": "Decimal" },
    { "column_name": "avg_volume", "uidt": "Number" },
    { "column_name": "last_price_update", "uidt": "DateTime" }
  ]
}
```

#### Table 2: `transactions`
```json
{
  "table_name": "transactions",
  "columns": [
    { "column_name": "symbol", "uidt": "SingleLineText" },
    { "column_name": "name", "uidt": "SingleLineText" },
    { "column_name": "type", "uidt": "SingleSelect", "dtxp": "'Buy','Sell'" },
    { "column_name": "price", "uidt": "Decimal" },
    { "column_name": "shares", "uidt": "Decimal" },
    { "column_name": "amount", "uidt": "Decimal" },
    { "column_name": "eps", "uidt": "Decimal" },
    { "column_name": "date", "uidt": "Date" },
    { "column_name": "platform", "uidt": "SingleSelect", "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'" }
  ]
}
```

#### Table 3: `options`
```json
{
  "table_name": "options",
  "columns": [
    { "column_name": "ticker", "uidt": "SingleLineText" },
    { "column_name": "opened", "uidt": "Date" },
    { "column_name": "strategy_type", "uidt": "SingleSelect", "dtxp": "'Wheel','LEAPS','Spread'" },
    { "column_name": "call_put", "uidt": "SingleSelect", "dtxp": "'Call','Put'" },
    { "column_name": "buy_sell", "uidt": "SingleSelect", "dtxp": "'Buy','Sell'" },
    { "column_name": "expiration", "uidt": "Date" },
    { "column_name": "strike", "uidt": "Decimal" },
    { "column_name": "delta", "uidt": "Decimal" },
    { "column_name": "iv_pct", "uidt": "Decimal" },
    { "column_name": "moneyness", "uidt": "SingleSelect", "dtxp": "'OTM','ATM','ITM'" },
    { "column_name": "qty", "uidt": "Number" },
    { "column_name": "premium", "uidt": "Decimal" },
    { "column_name": "collateral", "uidt": "Decimal" },
    { "column_name": "status", "uidt": "SingleSelect", "dtxp": "'Open','Closed','Expired','Rolled','Assigned'" },
    { "column_name": "close_date", "uidt": "Date" },
    { "column_name": "close_premium", "uidt": "Decimal" },
    { "column_name": "profit", "uidt": "Decimal" },
    { "column_name": "days_held", "uidt": "Number" },
    { "column_name": "return_pct", "uidt": "Decimal" },
    { "column_name": "annualised_return_pct", "uidt": "Decimal" },
    { "column_name": "notes", "uidt": "LongText" }
  ]
}
```

#### Table 4: `deposits`
```json
{
  "table_name": "deposits",
  "columns": [
    { "column_name": "month", "uidt": "Date" },
    { "column_name": "amount", "uidt": "Decimal" },
    { "column_name": "platform", "uidt": "SingleSelect", "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'" }
  ]
}
```

#### Table 5: `dividends`
```json
{
  "table_name": "dividends",
  "columns": [
    { "column_name": "symbol", "uidt": "SingleLineText" },
    { "column_name": "amount", "uidt": "Decimal" },
    { "column_name": "date", "uidt": "Date" },
    { "column_name": "platform", "uidt": "SingleSelect", "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'" }
  ]
}
```

#### Table 6: `monthly_snapshots`
This replaces the "Monthly Tracker" sheet. One row per month, updated by the sync script.
```json
{
  "table_name": "monthly_snapshots",
  "columns": [
    { "column_name": "month", "uidt": "Date" },
    { "column_name": "total_invested", "uidt": "Decimal" },
    { "column_name": "portfolio_value", "uidt": "Decimal" },
    { "column_name": "gain_loss", "uidt": "Decimal" },
    { "column_name": "gain_loss_pct", "uidt": "Decimal" },
    { "column_name": "dividend_income", "uidt": "Decimal" },
    { "column_name": "options_premium", "uidt": "Decimal" },
    { "column_name": "options_capital_gains", "uidt": "Decimal" },
    { "column_name": "total_deposits", "uidt": "Decimal" }
  ]
}
```

#### Table 7: `price_history`
Daily close prices for portfolio charting.
```json
{
  "table_name": "price_history",
  "columns": [
    { "column_name": "symbol", "uidt": "SingleLineText" },
    { "column_name": "date", "uidt": "Date" },
    { "column_name": "close_price", "uidt": "Decimal" },
    { "column_name": "volume", "uidt": "Number" }
  ]
}
```

#### Table 8: `settings`
Key-value store for user preferences and goals.
```json
{
  "table_name": "settings",
  "columns": [
    { "column_name": "key", "uidt": "SingleLineText" },
    { "column_name": "value", "uidt": "SingleLineText" },
    { "column_name": "description", "uidt": "SingleLineText" }
  ]
}
```

Seed with these default rows during migration:
| key | value | description |
|-----|-------|-------------|
| dividend_income_goal | 5000 | Annual dividend income target in £ |
| salary | 45000 | Annual salary for UK tax calculations |
| tax_year | 2024-25 | Current tax year |
| default_currency | GBP | Display currency |

---

## Part 4: Data Migration Script (`scripts/migrate.py`)

### Purpose
One-time script to read the `stocks-v2.numbers` file and import all historical data into NocoDB.

### Dependencies
```
numbers-parser
requests
python-dotenv
```

### Source Data Mapping

The .numbers file has 5 sheets. Here is the exact structure of each sheet and table, with the column names as they appear in the file:

**Sheet: "Transactions"**

Table: "Transactions" — 964 rows, 8 columns:
- `Symbol` (text, e.g. "AAPL")
- `Name` (text, e.g. "Apple Inc.")
- `Price` (number, e.g. 150.25)
- `Shares` (number, can be decimal, e.g. 0.5. Negative values = sells)
- `EPS` (number)
- `Date` (date, various formats)
- `Platform` (text: "Trading 212", "IBKR", "Freetrade", "Stake", "Etoro", "Hood")
- `Amount` (number, = Price × Shares)

→ Map to NocoDB `transactions` table. Determine `type` (Buy/Sell) from whether Shares is positive or negative.

Table: "Deposited" — 74 rows, 9 columns:
- `Month` (date)
- `Total` (number)
- `IBKR` (number)
- `Trading 212` (number)
- `Freetrade` (number)
- `Stake` (number)
- `Etoro` (number)
- `Hood` (number)

→ Unpivot this: for each row, create one `deposits` record per platform that has a non-zero value. So a single row with IBKR=500, Trading 212=300 becomes two deposit records.

Table: "Monthly Tracker" — 86 rows, 11 columns:
- `Month` (date)
- `Invested so far` (number)
- `Portfolio Value` (number)
- `Gain/Loss` (number)
- Plus columns for dividends, options capital, premium, etc.

→ Map to NocoDB `monthly_snapshots` table.

**Sheet: "Options"**

Table: "Options Wheel Strategy" — 164 rows, 33 columns:
- `Ticker`, `Opened`, `Strategy`, `C/P`, `Buy/Sell`, `Expiration`, `Strike`, `Delta`, `Moneyness`, `QTY`, `Premium`, `Profit`, `Days Held`, `Return`, `Status`, `Close Date`, and more
- Status values: "Closed", "Expired", "Rolled", "Assigned"

→ Map to NocoDB `options` table with `strategy_type` = "Wheel"

Table: "Options LEAPS" — 36 rows, 34 columns:
- Same structure as Wheel but for long-term options
- Tickers include: SOFI, HOOD, PYPL, QUBT, RGTI

→ Map to NocoDB `options` table with `strategy_type` = "LEAPS"

**Sheet: "Portfolio"**

Table: "Sectors-1" — 13 rows, mapping symbols to sectors. Use this to populate the `sector` field in the `symbols` table.

### Migration Logic

```
1. Read .numbers file with numbers-parser
2. Extract unique symbols from Transactions sheet → create `symbols` table rows
3. Cross-reference Sectors-1 table to populate sector for each symbol
4. Insert all 964 transaction rows into `transactions`
5. Unpivot and insert deposit data into `deposits`
6. Insert Wheel options (164 rows) + LEAPS options (36 rows) into `options`
7. Insert monthly tracker data into `monthly_snapshots`
8. Print summary: X symbols, Y transactions, Z options, W deposits imported
```

### Important Notes
- Use bulk insert (send arrays of records) for performance
- NocoDB bulk insert accepts max ~100 records per call, so batch accordingly
- Handle date parsing carefully — the .numbers file may have dates as datetime objects
- Platform name normalisation: "Etoro" → "eToro", "Hood" → "Robinhood"
- Skip any rows where Symbol is empty/None (summary rows in the spreadsheet)

---

## Part 5: FMP Price Sync Service (`scripts/sync_prices.py`)

### Purpose
Runs daily (via cron) or on-demand. Fetches live prices from FMP and updates NocoDB.

### FMP API Endpoints Used

**Batch Quote** — `GET https://financialmodelingprep.com/api/v3/quote/{SYMBOLS}?apikey={KEY}`

Where `{SYMBOLS}` is comma-separated (e.g. `AAPL,AMZN,NFLX`). Max ~50 per call.

Response shape (array):
```json
[
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 185.50,
    "changesPercentage": -1.25,
    "change": -2.35,
    "dayLow": 183.20,
    "dayHigh": 187.90,
    "yearHigh": 199.62,
    "yearLow": 164.08,
    "marketCap": 2850000000000,
    "priceAvg50": 182.40,
    "priceAvg200": 178.90,
    "volume": 52000000,
    "avgVolume": 58000000,
    "exchange": "NASDAQ",
    "open": 186.00,
    "previousClose": 187.85,
    "eps": 6.43,
    "pe": 28.85,
    "earningsAnnouncement": "2025-01-28"
  }
]
```

### Sync Logic

```
1. GET all symbols from NocoDB `symbols` table
2. Split into batches of 50
3. For each batch, call FMP /api/v3/quote/{batch}
4. For each quote in response:
   a. PATCH the matching `symbols` row in NocoDB:
      - current_price = quote.price
      - previous_close = quote.previousClose
      - change_pct = quote.changesPercentage
      - day_high = quote.dayHigh
      - day_low = quote.dayLow
      - year_high = quote.yearHigh
      - year_low = quote.yearLow
      - market_cap = quote.marketCap
      - pe_ratio = quote.pe
      - eps = quote.eps
      - avg_volume = quote.avgVolume
      - last_price_update = now()
   b. INSERT a row into `price_history`:
      - symbol, date=today, close_price=quote.price, volume=quote.volume
5. Log: "Updated X symbols, Y failed"
```

### Cron Setup
Add a note in the README:
```bash
# Run daily at 9pm UK time (after US market close)
0 21 * * 1-5 cd /path/to/folio && python scripts/sync_prices.py
```

### API Budget
~120 symbols ÷ 50 per batch = 3 API calls per sync. Even running 5x per day = 15 calls. Well within the 250/day free limit.

---

## Part 6: Dashboard Frontend (`dashboard/`)

### Tech Stack
- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **shadcn/ui** for base components (Card, Table, Badge, Button, Tabs, Select, Dialog)
- **Recharts** for all charts
- **next-themes** for dark mode support (default to dark — this is a finance app)

### Design Direction
- Dark theme by default (dark navy/charcoal background, similar to Bloomberg Terminal or TradingView)
- Green for gains, red for losses (standard finance colours)
- Clean card-based layout
- Sidebar navigation
- Responsive but primarily desktop-focused

### NocoDB Client (`src/lib/nocodb.ts`)
A typed API client that wraps NocoDB REST calls. All data fetching happens server-side (Next.js Server Components or Route Handlers) to keep the API token hidden.

```typescript
// Core functions needed:
async function getRecords(tableId: string, params?: { where?: string; limit?: number; offset?: number; sort?: string }): Promise<any[]>
async function getRecord(tableId: string, rowId: number): Promise<any>
async function createRecord(tableId: string, data: Record<string, any>): Promise<any>
async function updateRecord(tableId: string, rowId: number, data: Record<string, any>): Promise<any>
async function deleteRecord(tableId: string, rowId: number): Promise<void>
```

### Calculations Library (`src/lib/calculations.ts`)

These calculations should be done in the frontend from raw NocoDB data:

```typescript
// Portfolio calculations
function calculateHoldings(transactions: Transaction[], symbols: Symbol[]): Holding[]
  // Group transactions by symbol
  // Sum shares (buys positive, sells negative) → current shares
  // Calculate avg cost basis (total buy amount / total buy shares)
  // Current value = shares × current_price
  // P&L = current value - cost basis
  // P&L % = P&L / cost basis × 100

function calculatePortfolioSummary(holdings: Holding[]): PortfolioSummary
  // Total value, total cost, total P&L, total P&L %

function calculateSectorAllocation(holdings: Holding[]): SectorAllocation[]
  // Group holdings by sector, sum market values

function calculateStrategyAllocation(holdings: Holding[]): StrategyAllocation[]
  // Group holdings by strategy, sum market values

// Options calculations
function calculateOptionsStats(options: Option[]): OptionsStats
  // Total premium collected (sum of profit where status != 'Open')
  // Win rate (profitable trades / total closed trades × 100)
  // Avg days held
  // Avg return %
  // Total collateral deployed
  // Premium by month (for bar chart)

function calculateLeapsBreakeven(leap: Option, currentPrice: number): LeapAnalysis
  // Break-even = strike + premium paid (for calls) or strike - premium (for puts)
  // Current P&L vs premium paid
  // Days to expiry

// Dividend calculations
function calculateDividendIncome(dividends: Dividend[]): DividendSummary
  // Annual total, monthly breakdown
  // By symbol
  // Yield on cost (annual dividend / cost basis per symbol)
  // Forward projected (dividend_yield × current_value per holding)

// UK Tax calculations
function calculateUKTax(salary: number, dividends: number, capitalGains: number): TaxBreakdown
  // Personal allowance: £12,570
  // Basic rate: £12,571–£50,270 @ 20%
  // Higher rate: £50,271–£125,140 @ 40%
  // Additional rate: >£125,140 @ 45%
  // Dividend allowance: £1,000 (2024/25)
  // Dividend basic: 8.75%, higher: 33.75%, additional: 39.35%
  // CGT allowance: £3,000 (2024/25)
  // CGT basic: 10%, higher: 20% (for stocks)
```

### TypeScript Types (`src/lib/types.ts`)

```typescript
interface Symbol {
  Id: number
  symbol: string
  name: string
  sector: string
  strategy: string
  current_price: number
  previous_close: number
  change_pct: number
  day_high: number
  day_low: number
  year_high: number
  year_low: number
  market_cap: number
  pe_ratio: number
  eps: number
  dividend_yield: number
  avg_volume: number
  last_price_update: string
}

interface Transaction {
  Id: number
  symbol: string
  name: string
  type: 'Buy' | 'Sell'
  price: number
  shares: number
  amount: number
  eps: number
  date: string
  platform: string
}

interface Option {
  Id: number
  ticker: string
  opened: string
  strategy_type: 'Wheel' | 'LEAPS' | 'Spread'
  call_put: 'Call' | 'Put'
  buy_sell: 'Buy' | 'Sell'
  expiration: string
  strike: number
  delta: number
  iv_pct: number
  moneyness: 'OTM' | 'ATM' | 'ITM'
  qty: number
  premium: number
  collateral: number
  status: 'Open' | 'Closed' | 'Expired' | 'Rolled' | 'Assigned'
  close_date: string | null
  close_premium: number
  profit: number
  days_held: number
  return_pct: number
  annualised_return_pct: number
  notes: string
}

interface Deposit {
  Id: number
  month: string
  amount: number
  platform: string
}

interface Dividend {
  Id: number
  symbol: string
  amount: number
  date: string
  platform: string
}

interface MonthlySnapshot {
  Id: number
  month: string
  total_invested: number
  portfolio_value: number
  gain_loss: number
  gain_loss_pct: number
  dividend_income: number
  options_premium: number
  options_capital_gains: number
  total_deposits: number
}

// Computed types (not stored in DB)
interface Holding {
  symbol: string
  name: string
  sector: string
  strategy: string
  shares: number
  avgCost: number
  costBasis: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlPct: number
  changePct: number
  weight: number  // % of total portfolio
}

interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalPnl: number
  totalPnlPct: number
  totalDeposited: number
  dayChange: number
  dayChangePct: number
}
```

---

### Page Specifications

#### Page 1: Portfolio Overview (`/` — default page)

**Layout:**
- Top row: 4 summary cards (Total Value, Total P&L, Day Change, Total Deposited)
- Second row: Holdings table (sortable, full width)
- Third row: 2-column — Sector donut chart | Strategy donut chart
- Fourth row: Top 5 gainers / Top 5 losers cards

**Summary Cards:**
Each card shows the value prominently and a subtitle with % change. Green/red colouring.

| Card | Value | Subtitle |
|------|-------|----------|
| Portfolio Value | Sum of (shares × current_price) for all holdings | Day change £ and % |
| Total P&L | Portfolio value - total cost basis | P&L % |
| Total Deposited | Sum of all deposits | — |
| Options Premium | Sum of options profit (closed/expired) | YTD premium |

**Holdings Table Columns:**
Symbol (with name below in smaller text), Shares, Avg Cost, Current Price, Market Value, P&L (£), P&L (%), Day Change (%), Sector, Strategy, Weight (%)

- Sortable by any column
- Clicking a symbol row opens a detail drawer/modal showing all transactions for that symbol
- Filter/search by symbol name
- Only show symbols where current shares > 0 (exclude fully sold positions)

**Charts:**
- Sector allocation: Recharts PieChart, show sector name + % on hover
- Strategy allocation: Recharts PieChart

---

#### Page 2: Transactions (`/transactions`)

**Layout:**
- Top row: filter bar (symbol search, platform dropdown, date range, buy/sell toggle)
- Main: full-width data table
- Side panel or modal: "Add Transaction" form

**Table Columns:**
Date, Symbol, Name, Type (Buy/Sell badge), Price, Shares, Amount, Platform, EPS

- Paginated (50 per page) or virtualised
- Default sort: date descending (newest first)
- All columns sortable

**Add Transaction Form:**
Fields: Symbol (autocomplete from existing symbols), Type (Buy/Sell), Price, Shares, Date, Platform (dropdown), Notes
- Amount auto-calculates from Price × Shares
- On submit: POST to NocoDB `transactions` table
- Also upsert into `symbols` table if new symbol

---

#### Page 3: Options Dashboard (`/options`)

**Layout:**
- Top row: 4 stat cards (Total Premium Collected, Win Rate, Avg Days Held, Capital Deployed)
- Tab group: "Wheel" | "LEAPS" | "All"
- Under Wheel tab: open positions table + closed positions table
- Under LEAPS tab: LEAPS positions table
- Bottom row: Monthly Premium bar chart | Status breakdown donut chart

**Stat Cards:**

| Card | Calculation |
|------|-------------|
| Total Premium | Sum of `profit` where status in (Closed, Expired) |
| Capital Gains P&L | Sum of `profit` where status = Assigned (can be negative) |
| Win Rate | Count(profit > 0) / Count(all closed) × 100 |
| Avg Days Held | Mean of `days_held` for closed trades |

**Wheel Open Positions Table:**
Ticker, Opened, C/P, Strike, Expiration, Days to Expiry (calculated: expiration - today), Delta, Premium, Collateral, Status

- Highlight rows where expiration is within 7 days (amber) or past (red)

**Wheel Closed Positions Table:**
Ticker, Opened, Closed, C/P, Strike, Premium, Profit, Days Held, Return %, Annualised Return %, Status

- Colour profit column green/red

**LEAPS Table:**
Ticker, Opened, C/P, Strike, Current Price (from symbols table), Expiration, Days to Expiry, Premium Paid, Current P&L estimate, Delta, IV%

**Monthly Premium Chart:**
Recharts BarChart. X-axis = month, Y-axis = total premium collected that month. Group by Wheel vs LEAPS if both have closed trades that month.

**Add Option Form:**
All fields from the options schema. Strike, expiration, premium are required. Delta, IV are optional.

---

#### Page 4: Dividends & Income (`/dividends`)

**Layout:**
- Top row: 3 cards (Annual Income, Income Goal Progress, After Tax Income)
- Monthly dividend calendar/heatmap or bar chart
- Dividend by symbol horizontal bar chart
- Dividend history table

**Income Goal:**
The user's spreadsheet has a dividend goal. Make this configurable (stored in a NocoDB `settings` table or just a constant). Show a progress bar: current annual income / goal.

**Monthly Bar Chart:**
X-axis = month (Jan-Dec), Y-axis = dividend income. Show current year vs previous year as grouped bars.

**By Symbol Chart:**
Horizontal bar chart. Each symbol's annual dividend income. Sort by highest first.

**Projected Forward Income:**
For each holding: shares × dividend_yield × current_price / 100. Sum for total projected annual income.

---

#### Page 5: Deposits & Capital (`/deposits`)

**Layout:**
- Top row: 2 cards (Total Deposited All Time, This Year's Deposits)
- Cumulative deposits line chart (X = month, Y = running total)
- Deposits by platform donut chart
- Monthly deposit table

**Cumulative Line Chart:**
Running sum of all deposits over time. One line.

**By Platform Chart:**
Donut chart showing total deposits per platform.

**Table:**
Month, Total, IBKR, Trading 212, Freetrade, Stake, eToro, Robinhood — mirroring the original spreadsheet format. Each row = one month.

**Add Deposit Form:**
Month (date picker), Amount, Platform (dropdown).

---

#### Page 6: Performance & Analytics (`/performance`)

**Layout:**
- Top row: 3 cards (Time-Weighted Return, Best Month, Worst Month)
- Portfolio value over time line chart
- Monthly performance table (replicates the Monthly Tracker)
- Benchmark comparison chart (portfolio vs S&P 500)

**Portfolio Value Over Time:**
Recharts LineChart using `monthly_snapshots` data. X = month, Y = portfolio_value. Optionally overlay total_invested as a second line to show the gap (gains).

**Monthly Performance Table:**
Columns: Month, Invested, Portfolio Value, Gain/Loss (£), Gain/Loss (%), Dividends, Options Premium, Total Income

**Benchmark Comparison:**
Fetch S&P 500 (^GSPC or SPY) historical from FMP. Normalise both portfolio and S&P to 100 at start date. Plot both lines.

---

#### Page 7: UK Tax Estimates (`/tax`)

**Layout:**
- Input section: Salary input, Tax year selector
- Calculations section: shows income tax + dividend tax + CGT
- Summary card: total estimated tax liability

**Tax Calculations (2024/25 UK rates):**

Income Tax:
- Personal Allowance: £0–£12,570 @ 0%
- Basic Rate: £12,571–£50,270 @ 20%
- Higher Rate: £50,271–£125,140 @ 40%
- Additional Rate: >£125,140 @ 45%

Dividend Tax:
- Allowance: first £1,000 tax-free
- Basic Rate: 8.75%
- Higher Rate: 33.75%
- Additional Rate: 39.35%

Capital Gains Tax:
- Annual exempt amount: £3,000
- Basic rate: 10%
- Higher rate: 18% (from Oct 2024 Budget: 18% basic, 24% higher for shares)

Auto-populate dividends from the dividends table (sum for selected tax year). Auto-populate capital gains from sell transactions (realised P&L).

---

### Sidebar Navigation

```
[Folio logo/icon]

Portfolio          → /
Transactions       → /transactions
Options            → /options
Dividends          → /dividends
Deposits           → /deposits
Performance        → /performance
Tax                → /tax

[Last synced: 6 Feb 2026, 21:00]
[Sync Now button]
```

The "Sync Now" button calls an API route (`/api/sync`) that triggers the FMP price update (runs the same logic as `sync_prices.py` but as a Next.js API route, so it can be triggered from the UI).

---

## Part 7: Additional Implementation Notes

### Data Refresh Strategy
- On page load, the dashboard reads from NocoDB (which has cached prices from the last sync)
- The "Sync Now" button triggers a fresh FMP fetch and NocoDB update, then revalidates the page
- Prices are not fetched client-side — everything goes through the server to protect the API key

### Error Handling
- If NocoDB is unreachable, show a connection error banner
- If FMP returns errors (rate limit, invalid symbol), log them and skip those symbols
- Handle missing data gracefully (new symbols with no price yet, options with no close date, etc.)

### Mobile Responsiveness
- Sidebar collapses to a hamburger menu on mobile
- Tables become horizontally scrollable
- Cards stack vertically
- Charts resize via ResponsiveContainer

### Dark Mode
- Default to dark theme
- Use CSS variables for theme colours so light mode can be added later
- Finance-standard colours: green (#22c55e) for gains, red (#ef4444) for losses

---

## Part 8: API Routes (Next.js Route Handlers)

The dashboard needs these server-side API routes under `src/app/api/`:

### `POST /api/sync` — Trigger FMP Price Refresh
```
src/app/api/sync/route.ts
```
- Fetch all symbols from NocoDB
- Batch-call FMP `/api/v3/quote/{symbols}` (50 per batch)
- Update each symbol's price fields in NocoDB
- Insert today's price into `price_history`
- Return `{ updated: number, failed: string[], lastSync: string }`
- On error, return `{ error: string }` with 500 status

### `POST /api/transactions` — Add Transaction
```
src/app/api/transactions/route.ts
```
- Validate with zod: symbol (required, string), type (Buy|Sell), price (positive number), shares (positive number), date (ISO string), platform (enum)
- Auto-calculate `amount = price × shares`
- POST to NocoDB `transactions` table
- If symbol doesn't exist in `symbols` table, create it (with name from FMP if available)
- Return the created record
- Revalidate the `/` and `/transactions` pages

### `POST /api/options` — Add Option Trade
```
src/app/api/options/route.ts
```
- Validate: ticker, call_put, buy_sell, strike, expiration, qty, premium (all required). delta, iv_pct, moneyness, notes (optional)
- POST to NocoDB `options` table
- Return created record
- Revalidate `/options`

### `PATCH /api/options/[id]` — Close/Update Option
```
src/app/api/options/[id]/route.ts
```
- Accept: status, close_date, close_premium, profit
- Auto-calculate days_held if close_date and opened are present
- PATCH the NocoDB row
- Revalidate `/options`

### `POST /api/deposits` — Add Deposit
```
src/app/api/deposits/route.ts
```
- Validate: month (date), amount (positive number), platform (enum)
- POST to NocoDB `deposits` table
- Revalidate `/deposits`

### `GET /api/settings` and `PATCH /api/settings` — Read/Update Settings
```
src/app/api/settings/route.ts
```
- GET: fetch all settings from NocoDB, return as `{ key: value }` object
- PATCH: accept `{ key: newValue }`, update the matching row in NocoDB

---

## Part 9: Form Validation

Use **zod** for validation and **react-hook-form** for form state.

### Install
```bash
npm install zod react-hook-form @hookform/resolvers
```

### Validation Schemas (define in `src/lib/validations.ts`)

```typescript
import { z } from 'zod'

const platforms = ['IBKR', 'Trading 212', 'Freetrade', 'Stake', 'eToro', 'Robinhood'] as const

export const transactionSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  name: z.string().optional(),
  type: z.enum(['Buy', 'Sell']),
  price: z.number().positive(),
  shares: z.number().positive(),
  date: z.string().datetime(),
  platform: z.enum(platforms),
  notes: z.string().optional(),
})

export const optionSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  opened: z.string().datetime(),
  strategy_type: z.enum(['Wheel', 'LEAPS', 'Spread']),
  call_put: z.enum(['Call', 'Put']),
  buy_sell: z.enum(['Buy', 'Sell']),
  expiration: z.string().datetime(),
  strike: z.number().positive(),
  qty: z.number().int().positive(),
  premium: z.number(),
  delta: z.number().min(-1).max(1).optional(),
  iv_pct: z.number().min(0).max(500).optional(),
  moneyness: z.enum(['OTM', 'ATM', 'ITM']).optional(),
  collateral: z.number().positive().optional(),
  notes: z.string().optional(),
})

export const depositSchema = z.object({
  month: z.string().datetime(),
  amount: z.number().positive(),
  platform: z.enum(platforms),
})
```

Forms should show inline field-level errors and disable the submit button while submitting. On success, close the form dialog and show a toast notification.
