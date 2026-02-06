# Architecture Research

**Domain:** Personal investment tracking dashboard (Next.js App Router + NocoDB REST API + FMP pricing)
**Researched:** 2026-02-06
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
                           EXTERNAL
                    ========================
                    |  FMP API (pricing)   |
                    ========================
                           |           |
                      [daily cron] [on-demand]
                           |           |
  ==================       |           |
  | .numbers file |        |           |
  ==================       |           |
        |                  |           |
   [one-time]              |           |
        |                  |           |
        v                  v           |
  ==========================================
  |          NocoDB (self-hosted)          |
  |  REST API v2 on localhost:8080        |
  |  8 tables: symbols, transactions,     |
  |  options, deposits, dividends,        |
  |  monthly_snapshots, price_history,    |
  |  settings                             |
  ==========================================
                    ^
                    | xc-token auth
                    | (server-side only)
                    |
  ==========================================
  |         Next.js Dashboard             |
  |  (App Router, Server Components)      |
  |                                       |
  |  +----------------------------------+ |
  |  | Server Layer                     | |
  |  |                                  | |
  |  | lib/nocodb.ts (API client)       | |
  |  | lib/fmp.ts (pricing client)      | |
  |  | lib/calculations.ts (math)       | |
  |  |                                  | |
  |  | Route Handlers (app/api/*)       | |
  |  | Server Components (pages)        | |
  |  +----------------------------------+ |
  |              | props (serialised)      |
  |              v                         |
  |  +----------------------------------+ |
  |  | Client Layer                     | |
  |  |                                  | |
  |  | Interactive tables (sort/filter) | |
  |  | Charts (Recharts)                | |
  |  | Forms (react-hook-form + zod)    | |
  |  | Theme toggle (next-themes)       | |
  |  +----------------------------------+ |
  ==========================================
            |
            v
       [Browser]
  (minimal JS, no API keys)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| **NocoDB** | Data storage, REST API, CRUD operations | Self-hosted, already running. v2 API with `xc-token` auth. Pagination via `limit`/`offset`. Filtering via `where` clause. |
| **FMP API** | Live stock price data | External service. Batch quote endpoint (`/api/v3/quote/{SYMBOLS}`). Max ~50 symbols per call. Free tier with bandwidth limit. |
| **Python migration script** | One-time data import from `.numbers` file | Reads Apple Numbers, transforms, bulk-inserts into NocoDB. Run once, then archived. |
| **Python sync script** | Daily FMP price fetch and NocoDB update | Cron job (9pm UK, Mon-Fri). Also duplicated as Next.js Route Handler for UI trigger. |
| **NocoDB client (`lib/nocodb.ts`)** | Typed server-side API wrapper | All NocoDB HTTP calls. Uses `server-only` import guard. Handles pagination, filtering, error mapping. |
| **FMP client (`lib/fmp.ts`)** | Typed server-side pricing wrapper | Batch quote calls. Used by `/api/sync` Route Handler. Server-only. |
| **Calculations library (`lib/calculations.ts`)** | Portfolio math: holdings, P&L, allocations, tax | Pure functions. No I/O. Takes raw NocoDB data, returns computed results. Shared between server and client. |
| **Server Components (pages)** | Data fetching, layout, passing props | Each page is `async`, fetches from NocoDB, computes derived data, passes to client components. |
| **Route Handlers (`app/api/*`)** | Mutations: add transaction, sync prices, etc. | Validate with zod, call NocoDB, `revalidatePath()` to refresh Server Components. |
| **Client Components** | Interactive UI: charts, sortable tables, forms | Receive data via props. No direct API calls to NocoDB/FMP. Interact via Route Handlers for mutations. |

---

## Recommended Project Structure

```
folio/
+-- scripts/                        # Python tooling (outside Next.js)
|   +-- migrate.py                  # One-time .numbers import
|   +-- sync_prices.py              # Daily cron FMP sync
|   +-- utils/
|   |   +-- nocodb_client.py        # Python NocoDB wrapper
|   +-- requirements.txt
|   +-- .venv/                      # Python virtual environment
|
+-- dashboard/                      # Next.js application
|   +-- src/
|   |   +-- app/
|   |   |   +-- layout.tsx          # Root layout: sidebar, theme provider
|   |   |   +-- page.tsx            # Portfolio Overview (/)
|   |   |   +-- loading.tsx         # Root loading skeleton
|   |   |   +-- error.tsx           # Root error boundary
|   |   |   +-- transactions/
|   |   |   |   +-- page.tsx        # Transaction history
|   |   |   +-- options/
|   |   |   |   +-- page.tsx        # Options dashboard
|   |   |   +-- dividends/
|   |   |   |   +-- page.tsx        # Dividend tracking
|   |   |   +-- deposits/
|   |   |   |   +-- page.tsx        # Deposit tracking
|   |   |   +-- performance/
|   |   |   |   +-- page.tsx        # Performance analytics
|   |   |   +-- tax/
|   |   |   |   +-- page.tsx        # UK tax estimates
|   |   |   +-- api/
|   |   |       +-- sync/
|   |   |       |   +-- route.ts    # POST: trigger FMP price refresh
|   |   |       +-- transactions/
|   |   |       |   +-- route.ts    # POST: add transaction
|   |   |       +-- options/
|   |   |       |   +-- route.ts    # POST: add option
|   |   |       |   +-- [id]/
|   |   |       |       +-- route.ts # PATCH: close/update option
|   |   |       +-- deposits/
|   |   |       |   +-- route.ts    # POST: add deposit
|   |   |       +-- settings/
|   |   |           +-- route.ts    # GET/PATCH: read/update settings
|   |   |
|   |   +-- lib/                    # Shared server-side utilities
|   |   |   +-- nocodb.ts           # NocoDB REST client (server-only)
|   |   |   +-- fmp.ts              # FMP API client (server-only)
|   |   |   +-- calculations.ts     # Pure portfolio math functions
|   |   |   +-- types.ts            # TypeScript interfaces for all models
|   |   |   +-- validations.ts      # Zod schemas for API route input
|   |   |   +-- constants.ts        # Tax rates, platform enum, sector list
|   |   |   +-- utils.ts            # Formatting (currency, dates, percentages)
|   |   |
|   |   +-- components/
|   |   |   +-- ui/                 # shadcn/ui primitives (auto-generated)
|   |   |   |   +-- card.tsx
|   |   |   |   +-- table.tsx
|   |   |   |   +-- badge.tsx
|   |   |   |   +-- button.tsx
|   |   |   |   +-- dialog.tsx
|   |   |   |   +-- ...
|   |   |   +-- layout/
|   |   |   |   +-- sidebar.tsx     # Navigation sidebar (client: active state)
|   |   |   |   +-- header.tsx      # Page header with sync indicator
|   |   |   |   +-- theme-provider.tsx  # next-themes wrapper (client)
|   |   |   +-- charts/             # Recharts wrappers (all client components)
|   |   |   |   +-- sector-pie.tsx
|   |   |   |   +-- performance-line.tsx
|   |   |   |   +-- deposit-bar.tsx
|   |   |   |   +-- premium-bar.tsx
|   |   |   |   +-- dividend-bar.tsx
|   |   |   +-- portfolio/
|   |   |   |   +-- holdings-table.tsx  # Client: sortable, filterable
|   |   |   |   +-- summary-cards.tsx   # Server: static rendering is fine
|   |   |   |   +-- top-movers.tsx
|   |   |   +-- transactions/
|   |   |   |   +-- transaction-table.tsx  # Client: sortable, paginated
|   |   |   |   +-- transaction-form.tsx   # Client: react-hook-form
|   |   |   +-- options/
|   |   |   |   +-- options-table.tsx
|   |   |   |   +-- wheel-stats.tsx
|   |   |   |   +-- leaps-tracker.tsx
|   |   |   |   +-- option-form.tsx    # Client: react-hook-form
|   |   |   +-- dividends/
|   |   |   |   +-- dividend-table.tsx
|   |   |   |   +-- income-goal.tsx
|   |   |   +-- deposits/
|   |   |   |   +-- deposit-table.tsx
|   |   |   |   +-- deposit-form.tsx   # Client: react-hook-form
|   |   |   +-- performance/
|   |   |   |   +-- monthly-table.tsx
|   |   |   +-- tax/
|   |   |       +-- tax-calculator.tsx # Client: interactive inputs
|   |   |
|   |   +-- styles/
|   |       +-- globals.css         # Tailwind v4 @import, @theme, CSS variables
|   |
|   +-- public/
|   |   +-- favicon.ico
|   +-- next.config.ts
|   +-- tsconfig.json
|   +-- package.json
|   +-- .env.local                  # NocoDB + FMP secrets (never committed)
|
+-- .env.example                    # Template for all secrets
+-- .gitignore
+-- stocks-v2.numbers               # Source data (not committed after migration)
```

### Structure Rationale

- **`scripts/` separate from `dashboard/`:** Python tooling has its own dependency tree (numbers-parser, requests). Keeping it outside the Next.js project avoids confusion and makes the migration a standalone operation that can be run independently.

- **`src/lib/` for shared logic:** The NocoDB client, FMP client, calculations, types, and validations live in `lib/` because they are imported by both Server Components (pages) and Route Handlers (api/). This is the single source of truth for data access and business logic.

- **`components/` organised by domain, not by type:** Components are grouped by feature (portfolio, transactions, options) rather than by kind (tables, forms, cards). This keeps related code together -- the transaction table lives next to the transaction form because changes to one often require changes to the other.

- **`components/ui/` for shadcn primitives:** These are auto-generated by `shadcn add` and should not be modified heavily. They provide the base design system (Card, Table, Badge, Button, Dialog, etc.).

- **`components/charts/` as dedicated group:** All charts use Recharts and require `"use client"`. Grouping them makes the client boundary explicit and keeps chart-specific wrapper logic (ResponsiveContainer, colour schemes, tooltips) in one place.

- **Route Handlers mirror page routes:** `/api/transactions/route.ts` handles mutations for the `/transactions` page. This naming convention makes it obvious which API routes serve which pages.

- **No `services/` or `hooks/` directories:** For a single-user dashboard of this size, the indirection of a services layer is overhead. Server Components call `lib/nocodb.ts` directly. If the project grows, extract a services layer later.

---

## Architectural Patterns

### Pattern 1: Server Component Data Fetching with Client Rendering

**What:** Server Components fetch all data and compute derived values, then pass serialised results to Client Components for interactive rendering.

**When to use:** Every page in this dashboard. The Server Component is the data orchestration layer; the Client Component is the interactive display layer.

**Trade-offs:**
- Pro: API keys never reach the browser. Zero client-side data fetching. Fast initial render.
- Pro: Heavy calculations (holdings aggregation, P&L) happen on the server at request time.
- Con: Page-level granularity -- the entire page re-renders on navigation (mitigated by streaming).
- Con: Interactive elements (sorting, filtering) must work on pre-fetched data or trigger a new server request.

**Example:**

```typescript
// app/page.tsx (Server Component)
import { getSymbols, getTransactions } from '@/lib/nocodb'
import { calculateHoldings, calculatePortfolioSummary } from '@/lib/calculations'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { SummaryCards } from '@/components/portfolio/summary-cards'

export default async function PortfolioPage() {
  // Parallel data fetching -- both requests fire simultaneously
  const [symbols, transactions] = await Promise.all([
    getSymbols(),
    getTransactions(),
  ])

  // Compute derived data on the server
  const holdings = calculateHoldings(transactions, symbols)
  const summary = calculatePortfolioSummary(holdings)

  return (
    <div>
      <SummaryCards summary={summary} />
      <HoldingsTable holdings={holdings} />
    </div>
  )
}
```

```typescript
// components/portfolio/holdings-table.tsx (Client Component)
'use client'

import { useState } from 'react'
import type { Holding } from '@/lib/types'

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [sortBy, setSortBy] = useState<keyof Holding>('marketValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = [...holdings].sort((a, b) => {
    const val = sortDir === 'asc' ? 1 : -1
    return a[sortBy] > b[sortBy] ? val : -val
  })

  return (
    <table>
      {/* Interactive table with client-side sorting */}
    </table>
  )
}
```

### Pattern 2: Route Handler Mutation with Path Revalidation

**What:** Client forms submit to Next.js Route Handlers (not directly to NocoDB). The Route Handler validates input, writes to NocoDB, then calls `revalidatePath()` to refresh the Server Component that displays the data.

**When to use:** All write operations: add transaction, add option, close option, add deposit, sync prices, update settings.

**Trade-offs:**
- Pro: Validation happens server-side with zod. NocoDB token never exposed. Consistent error handling.
- Pro: `revalidatePath()` triggers a fresh server render -- no client-side cache invalidation logic needed.
- Con: Slightly more latency than direct client-to-API calls (extra hop through Next.js).
- Con: Must manually call `revalidatePath()` for every affected route (easy to forget a page).

**Example:**

```typescript
// app/api/transactions/route.ts
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createRecord } from '@/lib/nocodb'
import { transactionSchema } from '@/lib/validations'

export async function POST(request: Request) {
  const body = await request.json()

  // Validate input
  const result = transactionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    )
  }

  // Write to NocoDB
  const record = await createRecord('transactions', {
    ...result.data,
    amount: result.data.price * result.data.shares,
  })

  // Refresh affected pages
  revalidatePath('/')             // Portfolio overview recalculates
  revalidatePath('/transactions') // Transaction list updates

  return NextResponse.json(record, { status: 201 })
}
```

```typescript
// components/transactions/transaction-form.tsx (Client Component)
'use client'

export function TransactionForm() {
  async function onSubmit(data: TransactionInput) {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      // Show validation errors inline
      return
    }

    // Success -- page will refresh via revalidatePath
    // Close dialog, show toast
  }

  // react-hook-form with zodResolver
}
```

### Pattern 3: NocoDB REST Client with Typed Table Access

**What:** A single `lib/nocodb.ts` file provides typed functions for all NocoDB operations. Table IDs are resolved once (from environment variables or a lookup cache) and reused. All functions are server-only.

**When to use:** Every interaction with NocoDB, from both Server Components and Route Handlers.

**Trade-offs:**
- Pro: Centralised error handling, retry logic, pagination. Type safety for all data access.
- Pro: `server-only` import guard prevents accidental client-side usage.
- Con: Must maintain type mappings manually (NocoDB has no generated types for your custom schema).
- Con: Table ID management -- either hardcode in env vars or fetch from meta API and cache.

**Example:**

```typescript
// lib/nocodb.ts
import 'server-only'

const BASE_URL = process.env.NOCODB_BASE_URL!
const API_TOKEN = process.env.NOCODB_API_TOKEN!

// Table IDs from environment or resolved at startup
const TABLE_IDS = {
  symbols: process.env.NOCODB_TABLE_SYMBOLS!,
  transactions: process.env.NOCODB_TABLE_TRANSACTIONS!,
  options: process.env.NOCODB_TABLE_OPTIONS!,
  deposits: process.env.NOCODB_TABLE_DEPOSITS!,
  dividends: process.env.NOCODB_TABLE_DIVIDENDS!,
  monthly_snapshots: process.env.NOCODB_TABLE_SNAPSHOTS!,
  price_history: process.env.NOCODB_TABLE_PRICE_HISTORY!,
  settings: process.env.NOCODB_TABLE_SETTINGS!,
} as const

type TableName = keyof typeof TABLE_IDS

interface ListParams {
  where?: string
  sort?: string
  limit?: number
  offset?: number
  fields?: string[]
}

async function nocodbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'xc-token': API_TOKEN,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`NocoDB ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

export async function getRecords<T>(
  table: TableName,
  params?: ListParams
): Promise<T[]> {
  const tableId = TABLE_IDS[table]
  const query = new URLSearchParams()

  if (params?.where) query.set('where', params.where)
  if (params?.sort) query.set('sort', params.sort)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.fields) query.set('fields', params.fields.join(','))

  const result = await nocodbFetch<{ list: T[] }>(
    `/api/v2/tables/${tableId}/records?${query}`
  )
  return result.list
}

// Convenience: fetch ALL records with auto-pagination
export async function getAllRecords<T>(
  table: TableName,
  params?: Omit<ListParams, 'limit' | 'offset'>
): Promise<T[]> {
  const pageSize = 200
  let offset = 0
  let all: T[] = []

  while (true) {
    const page = await getRecords<T>(table, {
      ...params,
      limit: pageSize,
      offset,
    })
    all = all.concat(page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}
```

### Pattern 4: Parallel Data Fetching with Promise.all

**What:** Server Components that need data from multiple NocoDB tables fetch them in parallel rather than sequentially, using `Promise.all`.

**When to use:** Any page that reads from more than one table. Portfolio overview needs symbols + transactions. Options page needs options + symbols. Tax page needs dividends + transactions + settings.

**Trade-offs:**
- Pro: Cuts total fetch time. If symbols takes 100ms and transactions takes 150ms, parallel = 150ms vs sequential = 250ms.
- Con: All-or-nothing error handling with `Promise.all` (if one fails, all fail). Use `Promise.allSettled` if partial rendering is acceptable.

**Example:**

```typescript
// app/options/page.tsx
export default async function OptionsPage() {
  const [options, symbols] = await Promise.all([
    getAllRecords<Option>('options'),
    getAllRecords<Symbol>('symbols'),
  ])

  const wheelOptions = options.filter(o => o.strategy_type === 'Wheel')
  const leapsOptions = options.filter(o => o.strategy_type === 'LEAPS')
  const stats = calculateOptionsStats(options)

  return (
    <div>
      <OptionsStatCards stats={stats} />
      <WheelTable options={wheelOptions} />
      <LeapsTracker options={leapsOptions} symbols={symbols} />
    </div>
  )
}
```

### Pattern 5: Streaming with Suspense Boundaries

**What:** Wrap slower-loading sections in `<Suspense>` boundaries so the page shell renders immediately while data-heavy sections stream in.

**When to use:** Pages where some data loads quickly (settings, counts) but other data requires heavy computation (holdings with 964 transactions, options stats). Also useful for the performance page where chart data may be large.

**Trade-offs:**
- Pro: User sees the page layout instantly. Cards and navigation appear before tables.
- Pro: Each section can fail independently (combine with error boundaries).
- Con: More complex component composition. Must extract data-fetching sections into their own async Server Components.

**Example:**

```typescript
// app/page.tsx
import { Suspense } from 'react'
import { SummaryCardsSkeleton, HoldingsTableSkeleton } from '@/components/skeletons'

export default function PortfolioPage() {
  return (
    <div>
      <Suspense fallback={<SummaryCardsSkeleton />}>
        <PortfolioSummary />
      </Suspense>
      <Suspense fallback={<HoldingsTableSkeleton />}>
        <HoldingsSection />
      </Suspense>
    </div>
  )
}

// Each section is its own async Server Component
async function PortfolioSummary() {
  const [symbols, transactions] = await Promise.all([
    getSymbols(),
    getTransactions(),
  ])
  const holdings = calculateHoldings(transactions, symbols)
  const summary = calculatePortfolioSummary(holdings)
  return <SummaryCards summary={summary} />
}
```

---

## Data Flow

### Read Flow (Page Load)

```
Browser requests /
    |
    v
Next.js Server Component (app/page.tsx)
    |
    +--- fetch symbols from NocoDB (GET /api/v2/tables/{symbolsId}/records)
    +--- fetch transactions from NocoDB (GET /api/v2/tables/{txId}/records)
    |    (parallel via Promise.all)
    |
    v
lib/calculations.ts
    |
    +--- calculateHoldings(transactions, symbols) -> Holding[]
    +--- calculatePortfolioSummary(holdings) -> PortfolioSummary
    +--- calculateSectorAllocation(holdings) -> SectorAllocation[]
    |
    v
Server renders HTML with computed data
    |
    v
Stream to browser (Suspense boundaries if used)
    |
    v
Client Components hydrate for interactivity
    (sorting, filtering, chart tooltips)
```

### Write Flow (Add Transaction)

```
User fills form in TransactionForm (Client Component)
    |
    v
Client-side validation (zod + react-hook-form)
    |
    v
POST /api/transactions (Next.js Route Handler)
    |
    v
Server-side validation (zod)
    |
    v
POST /api/v2/tables/{txTableId}/records (NocoDB)
    |
    +--- Also upsert symbol if new ticker
    |
    v
revalidatePath('/') + revalidatePath('/transactions')
    |
    v
Response to client (201 Created or 400 Error)
    |
    v
Client closes dialog, shows toast
    |
    v
Next navigation/refresh serves fresh data from Server Components
```

### Price Sync Flow

```
Trigger: Cron (Python) OR "Sync Now" button (Route Handler)
    |
    v
Fetch all symbols from NocoDB
    |
    v
Batch symbols into groups of 50
    |
    v
For each batch:
    +--- GET /api/v3/quote/{AAPL,MSFT,...} from FMP
    |
    v
For each quote:
    +--- PATCH /api/v2/tables/{symbolsId}/records (update price fields)
    +--- POST /api/v2/tables/{priceHistoryId}/records (daily snapshot)
    |
    v
revalidatePath('/') (if triggered from UI)
    |
    v
Log: "Updated X symbols, Y failed"
```

### Key Data Flows

1. **Holdings Computation:** Transactions (raw) -> group by symbol -> sum shares (buys positive, sells negative) -> calculate avg cost -> join with current price from symbols -> produce Holding[]. This is the most critical computation and happens on every Portfolio page load. With 964 transactions across ~120 symbols, this is sub-millisecond on the server.

2. **Options Lifecycle:** Option created (POST) -> appears in "Open" table -> at expiry, user updates status via PATCH (close/expire/roll/assign) -> moves to "Closed" table -> profit calculated -> aggregate stats update. If assigned, user also adds a stock Buy transaction manually.

3. **Monthly Snapshot:** The Python sync script (or a future Route Handler) writes a row to `monthly_snapshots` at month-end. This captures a point-in-time record of portfolio value, total invested, dividends, and options income. The Performance page reads this historical data for the line chart.

4. **Tax Estimation:** Tax page reads salary from settings, sum of dividends for the tax year from dividends table, and realised gains from sell transactions. Calculations library applies UK tax bands. This is read-only computation -- no writes.

---

## Server/Client Component Boundary Map

Understanding which components are Server vs Client is critical for this architecture. The boundary determines where API keys are safe and where interactivity lives.

| Component | Type | Why |
|-----------|------|-----|
| `app/layout.tsx` | Server | Root layout, sidebar structure. Wraps children in ThemeProvider (client). |
| `app/page.tsx` | Server | Fetches symbols + transactions, computes holdings. |
| `app/transactions/page.tsx` | Server | Fetches transactions with pagination params. |
| `app/options/page.tsx` | Server | Fetches options + symbols, computes stats. |
| `app/dividends/page.tsx` | Server | Fetches dividends, computes income. |
| `app/deposits/page.tsx` | Server | Fetches deposits. |
| `app/performance/page.tsx` | Server | Fetches monthly_snapshots. |
| `app/tax/page.tsx` | Server | Fetches settings + dividends + sells. Passes to client calculator. |
| `components/layout/theme-provider.tsx` | Client | `next-themes` requires client context. |
| `components/layout/sidebar.tsx` | Client | Active route highlighting, mobile menu toggle, "Sync Now" button. |
| `components/portfolio/summary-cards.tsx` | Server | Static rendering of computed values. No interactivity. |
| `components/portfolio/holdings-table.tsx` | Client | Sortable columns, filterable rows, clickable symbol detail. |
| `components/charts/*` | Client | Recharts requires DOM access (D3/SVG rendering). |
| `components/transactions/transaction-table.tsx` | Client | Sortable, paginated, filterable. |
| `components/transactions/transaction-form.tsx` | Client | react-hook-form state, form submission. |
| `components/options/options-table.tsx` | Client | Tab switching (Wheel/LEAPS/All), sortable. |
| `components/options/option-form.tsx` | Client | Form state. |
| `components/tax/tax-calculator.tsx` | Client | Interactive salary input, tax year selector, live recalculation. |
| `lib/nocodb.ts` | Server-only | `import 'server-only'`. NocoDB token access. |
| `lib/fmp.ts` | Server-only | `import 'server-only'`. FMP key access. |
| `lib/calculations.ts` | Shared | Pure functions. No `server-only`. Can be imported anywhere. |
| `lib/types.ts` | Shared | TypeScript interfaces. No runtime code. |
| `lib/validations.ts` | Shared | Zod schemas used both client-side (form validation) and server-side (route handler validation). |
| `lib/utils.ts` | Shared | Formatting functions (currency, dates, percentages). |

**Rule of thumb:** If it fetches data or touches secrets, it is a Server Component/server-only module. If it manages interactive state (sorting, forms, chart tooltips), it is a Client Component.

---

## NocoDB Integration Architecture

### Table ID Management

NocoDB tables are identified by alphanumeric IDs (e.g., `m3hk92j5`), not by name. These IDs must be known at runtime.

**Recommended approach:** Store table IDs in environment variables.

```env
# .env.local
NOCODB_BASE_URL=http://localhost:8080
NOCODB_API_TOKEN=your_token
NOCODB_TABLE_SYMBOLS=mxxxxxxxxx
NOCODB_TABLE_TRANSACTIONS=mxxxxxxxxx
NOCODB_TABLE_OPTIONS=mxxxxxxxxx
NOCODB_TABLE_DEPOSITS=mxxxxxxxxx
NOCODB_TABLE_DIVIDENDS=mxxxxxxxxx
NOCODB_TABLE_SNAPSHOTS=mxxxxxxxxx
NOCODB_TABLE_PRICE_HISTORY=mxxxxxxxxx
NOCODB_TABLE_SETTINGS=mxxxxxxxxx
```

**Why not fetch from meta API?** The meta API (`GET /api/v2/meta/bases/{baseId}/tables`) could resolve table names to IDs at startup. But for 8 fixed tables in a single-user app, env vars are simpler, have zero runtime cost, and fail loudly if misconfigured (missing env var vs. silent table name mismatch).

**How to find table IDs:** Open NocoDB UI, navigate to the table, copy the ID from the URL or use the API explorer. Document IDs in `.env.example` with placeholder values.

### Pagination Strategy

NocoDB defaults to 25 rows per page (`limit=25`). For this project:

| Table | Typical row count | Fetch strategy |
|-------|-------------------|----------------|
| `symbols` | ~120 | Single fetch (`limit=200`) |
| `transactions` | ~964+ (growing) | Paginated for display (50/page). Full fetch for holdings calculation. |
| `options` | ~200+ (growing) | Single fetch (`limit=300`) for stats. Paginated for display. |
| `deposits` | ~74+ (growing) | Single fetch (`limit=200`) |
| `dividends` | ~50-200 | Single fetch (`limit=300`) |
| `monthly_snapshots` | ~86+ (growing) | Single fetch (`limit=200`) |
| `price_history` | ~120/day * 365 = ~43,800/year | Filtered fetch by date range. Never fetch all. |
| `settings` | ~4-10 | Single fetch (`limit=50`) |

**Critical insight:** The `price_history` table grows fast (one row per symbol per day). Always filter by date range when querying. For chart data, fetch only the last N months. For the sync script, only insert today's data.

**Auto-pagination helper (`getAllRecords`):** For tables under ~1000 rows where the full dataset is needed for computation (symbols, transactions, options), use the auto-pagination wrapper that fetches in chunks of 200 until exhausted. This is simpler than implementing server-side pagination for the calculation engine.

### Error Handling Strategy

| Error | Source | Handling |
|-------|--------|----------|
| `401 Unauthorized` | Bad/expired NocoDB token | Surface as connection error banner. Log. Cannot auto-recover. |
| `404 Not Found` | Wrong table ID | Fail loudly at startup (env var validation). |
| `422 Validation` | Bad data in create/update | Return structured error to form. Show field-level messages. |
| `500 Server Error` | NocoDB internal | Retry once. If still fails, show "NocoDB unavailable" error boundary. |
| `ECONNREFUSED` | NocoDB not running | Show "Cannot connect to database" error boundary. Check URL. |
| FMP `429 Rate Limit` | Too many pricing calls | Exponential backoff in sync script. Log and skip batch. |
| FMP `403/401` | Bad/expired API key | Log error. Show "Price sync failed" in UI. Continue with stale prices. |

---

## Scaling Considerations

This is a single-user personal tool. "Scaling" means data volume growth, not user count.

| Concern | Now (~1K transactions) | In 2 years (~5K transactions) | In 5 years (~15K transactions) |
|---------|------------------------|-------------------------------|-------------------------------|
| Holdings calculation | Sub-ms. 964 rows trivial. | Still sub-ms. Linear scan. | ~5ms. Still fine. Consider caching. |
| Page load (NocoDB round-trip) | ~50-100ms (localhost) | ~50-100ms (data size barely matters for 5K rows) | ~100-200ms. Consider filtering server-side. |
| Price history table | ~5K rows (6 months) | ~90K rows (2 years) | ~220K rows (5 years). Must filter by date. |
| Monthly snapshots | ~90 rows | ~110 rows | ~150 rows. Trivial forever. |

### First Bottleneck: price_history Query Performance

The `price_history` table is the only table that will grow significantly. At 120 symbols with daily syncs, that is ~30,000 rows per year.

**Mitigation:**
- Always filter by date range: `where=(date,gte,2025-01-01)~and(date,lte,2025-12-31)`
- For charts, aggregate server-side or limit to weekly/monthly data points
- Consider a cleanup script that removes data older than 3 years

### Second Bottleneck: Holdings Recalculation on Every Page Load

Every visit to the portfolio page fetches all transactions and recomputes holdings. At 5K+ transactions this is still fast in absolute terms, but wasteful.

**Mitigation (when needed, not now):**
- Use `use cache` directive on the holdings computation with a `cacheLife('minutes')` profile
- Invalidate with `cacheTag('holdings')` when new transactions are added
- This turns a per-request computation into a cached result refreshed on mutation

---

## Anti-Patterns

### Anti-Pattern 1: Client-Side NocoDB Calls

**What people do:** Expose NocoDB URL and token to the browser via `NEXT_PUBLIC_` environment variables so Client Components can fetch data directly.

**Why it is wrong:** The `xc-token` gives full read/write access to the entire NocoDB instance -- all bases, all tables. Exposing it client-side means anyone who inspects network requests has your database credentials.

**Do this instead:** All NocoDB calls go through Server Components or Route Handlers. The `lib/nocodb.ts` file imports `'server-only'` to enforce this at build time. Client Components receive data via props or fetch via Route Handlers.

### Anti-Pattern 2: SWR/React Query for a Server Component Dashboard

**What people do:** Install SWR or React Query and make all components Client Components so they can use hooks like `useSWR` or `useQuery`.

**Why it is wrong:** This turns every page into a client-rendered loading spinner. The server has direct access to NocoDB (same network, sub-ms latency). Fetching on the server and streaming HTML is faster, sends less JavaScript, and protects API keys.

**Do this instead:** Use Server Components for data fetching. For interactive filtering that needs new data (e.g., changing the date range on the performance chart), use the `useRouter().refresh()` pattern with URL search params, or accept the slightly less dynamic UX of server-side rendering. For this single-user dashboard, the simplicity gain vastly outweighs any interactivity loss.

### Anti-Pattern 3: Monolithic Page Components

**What people do:** Put all data fetching, computation, and rendering in a single 500-line `page.tsx`.

**Why it is wrong:** Blocks streaming (Suspense requires separate async components). Makes the code untestable. Mixing data access with rendering logic.

**Do this instead:** Page components orchestrate. They call `lib/nocodb.ts` for data, `lib/calculations.ts` for computation, and render domain-specific components. Each page should be 30-60 lines.

### Anti-Pattern 4: Fetching Data Inside Client Components via useEffect

**What people do:** Use `useEffect` to fetch data after mount because it is "the React way."

**Why it is wrong:** For a dashboard, this creates a loading waterfall: page loads -> JS loads -> component mounts -> useEffect fires -> fetch starts -> data arrives -> render. Server Components eliminate this entirely by including data in the initial HTML.

**Do this instead:** Fetch in Server Components. Pass data as props. The only client-side fetches should be form submissions (POST to Route Handlers) and the "Sync Now" button.

### Anti-Pattern 5: Bypassing NocoDB with Direct Database Access

**What people do:** Connect to NocoDB's underlying PostgreSQL/SQLite directly with an ORM like Prisma or Drizzle for "better performance."

**Why it is wrong:** NocoDB owns the database schema and may change internal table structures between versions. Direct access bypasses NocoDB's access control, audit logging, and API contract. If NocoDB migrates its internal schema, your queries break silently.

**Do this instead:** Use the NocoDB REST API exclusively. The overhead is negligible for a single-user app on localhost. If API performance becomes a genuine bottleneck (unlikely), consider NocoDB's bulk endpoints or server-side caching before bypassing the API layer.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **NocoDB** | REST API via `lib/nocodb.ts` (server-only) | Auth: `xc-token` header. Base URL from env var. Self-hosted on same machine or local network. |
| **FMP API** | REST API via `lib/fmp.ts` (server-only) and `scripts/sync_prices.py` | Auth: `apikey` query parameter. Free tier with bandwidth limit. Batch quote endpoint for up to 50 symbols. |
| **Apple Numbers** | One-time read via `numbers-parser` (Python) | Migration script only. No ongoing integration. File sits in project root until migration is complete. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Python scripts <-> NocoDB | Direct REST API (Python `requests`) | Scripts use their own NocoDB client (`scripts/utils/nocodb_client.py`). Same API, different language. |
| Next.js server <-> NocoDB | REST API via `lib/nocodb.ts` | All table operations. Server Components for reads, Route Handlers for writes. |
| Next.js server <-> FMP | REST API via `lib/fmp.ts` | Only used by `/api/sync` Route Handler. Not used by page rendering (prices are in NocoDB). |
| Server Components <-> Client Components | Serialised props | Data flows down. Holdings[], PortfolioSummary, OptionsStats passed as props. No two-way binding. |
| Client Components <-> Route Handlers | `fetch()` to `/api/*` endpoints | Mutations only. Client sends form data, receives success/error response. |
| Route Handlers <-> Server Components | `revalidatePath()` | After a mutation, Route Handler triggers re-render of affected pages. No direct communication. |

---

## Build Order Implications

The architecture has clear dependency chains that dictate what must be built first.

### Phase 1: Foundation (must be first)

1. **NocoDB client (`lib/nocodb.ts`)** -- Everything depends on this. Cannot render any page without data access.
2. **TypeScript types (`lib/types.ts`)** -- Defines the data contracts used everywhere.
3. **Python migration script** -- Populates NocoDB with data. Dashboard is useless without data.
4. **Root layout + sidebar** -- App shell that all pages live within.

**Dependency:** Migration script requires NocoDB to be running (it already is). NocoDB client requires table IDs (obtained after migration creates tables).

### Phase 2: Core Data + Read Pages

5. **Calculations library (`lib/calculations.ts`)** -- Holdings, P&L, allocations. Pure functions, testable in isolation.
6. **Portfolio overview page** -- The primary page. Requires: NocoDB client, calculations, holdings table component, summary cards, sector chart.
7. **FMP price sync** -- Both Python cron script and `/api/sync` Route Handler. Populates current prices in symbols table.

**Dependency:** Portfolio page requires calculations library. Calculations require transaction data (from migration). Price sync requires symbols in NocoDB (from migration).

### Phase 3: Secondary Read Pages

8. **Transaction history page** -- Data already in NocoDB from migration. Paginated table.
9. **Options dashboard** -- Wheel + LEAPS tables, aggregate stats.
10. **Dividends page** -- Simple query + display.
11. **Deposits page** -- Simplest page.

**Dependency:** These pages depend only on Phase 1 (NocoDB client, types) and data from migration. They can be built in parallel with each other.

### Phase 4: Write Operations

12. **Validation schemas (`lib/validations.ts`)** -- Zod schemas shared between forms and route handlers.
13. **Add transaction form + route handler** -- First write path.
14. **Add option form + route handler** -- Second write path.
15. **Add deposit form + route handler** -- Third write path.
16. **Close/update option route handler** -- PATCH endpoint.

**Dependency:** Forms and route handlers depend on validation schemas. Route handlers depend on NocoDB client. Forms are Client Components that depend on the corresponding page being built (they are rendered within that page).

### Phase 5: Advanced Features

17. **Performance page** -- Monthly snapshots chart, benchmark comparison.
18. **Tax page** -- UK tax calculations, interactive inputs.
19. **Unified stock + options allocation view** -- Combines LEAPS into portfolio weights.

**Dependency:** Performance page requires accumulated price history data (needs time after sync is running). Tax page requires dividends + realised gains calculations. Unified view requires both holdings and LEAPS data to be correct.

---

## Sources

- [Next.js App Router: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- Official folder conventions, special files, organisation strategies -- HIGH confidence
- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) -- Boundary rules, composition patterns, `server-only` package -- HIGH confidence
- [Next.js: Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) -- Server Component fetching, parallel requests, streaming, `use()` hook -- HIGH confidence
- [Next.js: `use cache` Directive](https://nextjs.org/docs/app/api-reference/directives/use-cache) -- Cache Components, `cacheLife`, `cacheTag`, cache key generation -- HIGH confidence
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) -- Turbopack stable, Cache Components, React 19 foundation -- HIGH confidence
- [NocoDB REST API Overview](https://nocodb.com/docs/product-docs/developer-resources/rest-apis/overview) -- v2 endpoints, query parameters (where, sort, limit, offset, fields), pagination defaults -- HIGH confidence
- [NocoDB API v2 Data Documentation](https://nocodb.com/apis/v2/data) -- Swagger specification, endpoint structure -- MEDIUM confidence (dynamic content)
- [Next.js Architecture in 2026: Server-First Patterns](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router) -- Server-first, client-islands, scalable App Router patterns -- MEDIUM confidence
- [Next.js Composition Patterns](https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns) -- Server/Client interleaving, Context Providers, third-party component wrapping -- HIGH confidence
- [Semaphore: Why Your Next.js Site Needs an API Layer](https://semaphore.io/blog/next-js-site-api-layer) -- Centralised server-side API logic pattern -- MEDIUM confidence

---
*Architecture research for: Personal investment tracking dashboard (Folio)*
*Researched: 2026-02-06*
