# Phase 4: Transactions & Options Display - Research

**Researched:** 2026-02-06
**Domain:** Transaction history table with infinite scroll, options dashboard with tabs/stat cards/roll chains, bar charts, filter UI patterns
**Confidence:** HIGH

## Summary

Phase 4 builds two read-only display pages: (1) a transaction history browser at `/transactions` with infinite scroll, filtering, and sorting; and (2) an options dashboard at `/options` with Wheel/LEAPS/All tabs, stat cards, roll chain grouping, expiry highlighting, and a monthly premium bar chart. Both are read-only -- write operations (add/edit/delete) are deferred to Phase 6.

The core technical challenges are: (a) progressive loading of ~960 transactions with server-side pagination via NocoDB, (b) roll chain inference from existing data (no `chain_id` column exists -- must be computed client-side by matching ticker + status "Rolled" + close_date proximity to another position's opened date), (c) complex table layouts with conditional row styling (expiry highlighting, dimmed closed positions, indented sub-rows for roll chains), and (d) a stacked/grouped bar chart for monthly premium data.

The standard approach reuses the Phase 2/3 patterns: async Server Components fetch data from NocoDB, server-side data assembly functions prepare display-ready types, then Client Components handle interactive UI (table sorting/filtering, tab switching, chart interaction). TanStack Table provides the headless table logic. shadcn Chart (Recharts) provides the bar chart. New shadcn components needed: tabs, badge, select, calendar, popover, table, card, chart, toggle-group.

**Primary recommendation:** Use TanStack Table with server-side pagination via NocoDB `listRecords` for transactions (50 per page, load more on scroll using Intersection Observer). For options, fetch all records server-side (~198 total -- small enough for client-side processing). Infer roll chains by matching ticker + "Rolled" status + temporal proximity. Use shadcn Tabs for the Wheel/LEAPS/All views. Use Recharts BarChart wrapped in shadcn ChartContainer for the premium chart.

## Existing Codebase Assets (Phases 1-2)

### Data Layer (reuse as-is)
| Module | Location | What It Provides |
|--------|----------|------------------|
| NocoDB client | `src/lib/nocodb.ts` | `getAllRecords<T>(table)`, `listRecords<T>(table, params)`, `fetchParallel(...)` |
| Type definitions | `src/lib/types.ts` | `TransactionRecord`, `OptionRecord`, `SymbolRecord` + broker constants, `ListParams`, `PageInfo` |
| Calculations engine | `src/lib/calculations.ts` | `toDisplay()` for Big-to-number conversion (used if any Big.js values needed) |
| Provider abstraction | `src/lib/providers/` | Not directly needed (no live pricing in this phase), but `SymbolRecord.current_price` is consumed |

### Key Data Types for This Phase

**TransactionRecord** (from `src/lib/types.ts`):
```typescript
interface TransactionRecord {
  Id: number
  symbol: string
  name: string
  type: "Buy" | "Sell"
  price: number
  shares: number
  amount: number
  eps: number | null
  date: string           // ISO date string
  platform: Broker       // "IBKR" | "Trading 212" | "Robinhood" | ...
}
```

**OptionRecord** (from `src/lib/types.ts`):
```typescript
interface OptionRecord {
  Id: number
  ticker: string
  opened: string                                    // ISO date
  strategy_type: "Wheel" | "LEAPS" | "Spread"
  call_put: "Call" | "Put"
  buy_sell: "Buy" | "Sell"
  expiration: string                                // ISO date
  strike: number
  delta: number | null
  iv_pct: number | null
  moneyness: "OTM" | "ATM" | "ITM" | null
  qty: number
  premium: number
  collateral: number | null
  status: "Open" | "Closed" | "Expired" | "Rolled" | "Assigned"
  close_date: string | null
  close_premium: number | null
  profit: number | null
  days_held: number | null
  return_pct: number | null
  annualised_return_pct: number | null
  notes: string | null
}
```

### Data Volume (from migration)
| Table | Records | Notes |
|-------|---------|-------|
| Transactions | ~963 | Need pagination -- too many for single fetch |
| Options (Wheel) | ~163 | Small enough for single fetch |
| Options (LEAPS) | ~35 | Small enough for single fetch |
| Options (Total) | ~198 | All fit in one `getAllRecords` call |

### NocoDB Query Capabilities
| Feature | Syntax | Example |
|---------|--------|---------|
| Sort descending | `-field` | `sort: "-date"` |
| Sort ascending | `field` | `sort: "date"` |
| Filter equality | `(field,eq,value)` | `where: "(type,eq,Buy)"` |
| Filter contains | `(field,like,value)` | `where: "(symbol,like,AA)"` |
| Combined filters | `~and` / `~or` | `where: "(type,eq,Buy)~and(platform,eq,IBKR)"` |
| Pagination | `limit` + `offset` | `{ limit: 50, offset: 100 }` |
| Date filters | `(field,eq,exactDate,value)` | `where: "(date,gte,exactDate,2024-01-01)"` |
| Field selection | `fields` array | `fields: ["symbol", "date", "type"]` |
| Page info | Returned in response | `{ totalRows, page, pageSize, isFirstPage, isLastPage }` |

### Existing UI Components (already installed)
| Component | Location | Notes |
|-----------|----------|-------|
| Button | `src/components/ui/button.tsx` | For filter controls, sort headers |
| Input | `src/components/ui/input.tsx` | For symbol search filter |
| Skeleton | `src/components/ui/skeleton.tsx` | For loading states |
| Tooltip | `src/components/ui/tooltip.tsx` | For DTE indicator tooltips |

### Existing CSS Variables (relevant for this phase)
- `--color-gain: oklch(0.723 0.191 142.5)` -- green for profit/gains
- `--color-loss: oklch(0.637 0.237 25.3)` -- red for losses
- `--color-chart-1` through `--color-chart-5` -- chart colour palette
- Tailwind utilities: `text-gain`, `text-loss` available via `@theme inline`

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Headless table: sorting, filtering, column visibility, expandable rows | De facto standard for React data tables; shadcn data table guide built on it |
| recharts | ^3.7.0 | Bar chart for monthly premium | Already chosen chart library; shadcn Chart component wraps it |
| date-fns | ^4.1.0 | Date formatting, comparison, parsing | Standard date utility; shadcn calendar/date-picker depends on it |
| react-day-picker | ^9.13.1 | Calendar component for date range filter | Dependency of shadcn calendar component |

### shadcn Components to Install
| Component | Install Command | Purpose |
|-----------|----------------|---------|
| table | `pnpm dlx shadcn@latest add table` | Table/TableHeader/TableBody/TableRow/TableHead/TableCell |
| tabs | `pnpm dlx shadcn@latest add tabs` | Tabs/TabsList/TabsTrigger/TabsContent for Wheel/LEAPS/All |
| card | `pnpm dlx shadcn@latest add card` | Card/CardHeader/CardTitle/CardContent for stat cards |
| badge | `pnpm dlx shadcn@latest add badge` | Buy/Sell type badges, status badges (Open/Closed/Expired/Assigned/Rolled) |
| chart | `pnpm dlx shadcn@latest add chart` | ChartContainer/ChartTooltip/ChartLegend for Recharts wrapper |
| select | `pnpm dlx shadcn@latest add select` | Select/SelectTrigger/SelectContent/SelectItem for platform dropdown, year selector |
| calendar | `pnpm dlx shadcn@latest add calendar` | Calendar component for date range picker |
| popover | `pnpm dlx shadcn@latest add popover` | Popover for date range picker container |
| toggle-group | `pnpm dlx shadcn@latest add toggle-group` | ToggleGroup for Buy/Sell filter toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side pagination (NocoDB) | Client-side fetch all 963 transactions | 963 rows is borderline; server-side avoids sending all data upfront but adds complexity. With ~960 rows, a single fetch is ~50-80KB -- acceptable. Decision: server-side with progressive loading for better UX per context decision. |
| Intersection Observer (native) | react-intersection-observer library | Native API is well-supported and simple for this use case. Adding a library for one `useInView` call is unnecessary. Use native IntersectionObserver. |
| TanStack Virtual (virtualization) | Render all loaded rows | ~960 rows max -- DOM can handle this without virtualization. Virtualization adds complexity for no measurable benefit at this scale. |
| Server Actions for load-more | API Route for pagination | Server Actions are the Next.js 16 recommended pattern for mutations and data fetching. Use a Server Action for loading more transaction pages. |

**Installation:**
```bash
pnpm add @tanstack/react-table recharts date-fns react-day-picker
pnpm dlx shadcn@latest add table tabs card badge chart select calendar popover toggle-group
```

Note: If Phase 3 is implemented first, `@tanstack/react-table`, `recharts`, `table`, `card`, `badge`, and `chart` may already be installed. The planner should check and skip duplicates.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── transactions/
│   │   └── page.tsx                    # Server Component: initial data fetch, pass to client
│   └── options/
│       └── page.tsx                    # Server Component: fetch all options + symbols
├── components/
│   ├── transactions/
│   │   ├── transactions-table.tsx      # Client: TanStack Table + infinite scroll
│   │   ├── transactions-columns.tsx    # Column definitions
│   │   ├── transactions-filters.tsx    # Client: filter bar (search, platform, date range, buy/sell)
│   │   └── load-more-trigger.tsx       # Client: Intersection Observer sentinel
│   ├── options/
│   │   ├── options-dashboard.tsx       # Client: tab container + stat cards
│   │   ├── options-stat-cards.tsx      # Client: 4 stat cards
│   │   ├── wheel-table.tsx            # Client: Wheel positions with roll chains
│   │   ├── leaps-table.tsx            # Client: LEAPS positions with additional columns
│   │   ├── all-options-table.tsx      # Client: unified view
│   │   ├── options-columns.tsx         # Column definitions for all option tables
│   │   ├── premium-chart.tsx           # Client: monthly premium bar chart (full)
│   │   └── premium-chart-summary.tsx   # Client: summary version for portfolio page
│   └── ui/                             # (shadcn add)
├── lib/
│   ├── transactions.ts                 # Server: data assembly for transaction page
│   ├── options.ts                      # Server: data assembly for options page
│   └── format.ts                       # Shared: number/date/currency formatters
└── actions/
    └── load-transactions.ts            # Server Action: paginated transaction fetch
```

### Pattern 1: Server-Side Paginated Transaction Loading
**What:** Initial page load fetches first 50 transactions server-side. Client-side Intersection Observer triggers a Server Action to load the next 50 when the user scrolls near the bottom.
**When to use:** The transactions page (TRAN-01, TRAN-04)
**Why:** ~960 transactions is too many to show at once (user wants progressive loading per context). NocoDB supports offset/limit pagination natively.

```typescript
// src/lib/transactions.ts
import "server-only"
import { listRecords } from "./nocodb"
import type { TransactionRecord, ListParams } from "./types"

export const TRANSACTIONS_PAGE_SIZE = 50

export interface TransactionsPage {
  transactions: TransactionRecord[]
  totalRows: number
  hasMore: boolean
}

export async function getTransactionsPage(
  offset: number = 0,
  filters?: { symbol?: string; platform?: string; type?: string; dateFrom?: string; dateTo?: string },
  sortField: string = "date",
  sortDir: "asc" | "desc" = "desc",
): Promise<TransactionsPage> {
  // Build NocoDB where clause from filters
  const conditions: string[] = []
  if (filters?.symbol) conditions.push(`(symbol,like,${filters.symbol})`)
  if (filters?.platform) conditions.push(`(platform,eq,${filters.platform})`)
  if (filters?.type) conditions.push(`(type,eq,${filters.type})`)
  if (filters?.dateFrom) conditions.push(`(date,gte,exactDate,${filters.dateFrom})`)
  if (filters?.dateTo) conditions.push(`(date,lte,exactDate,${filters.dateTo})`)

  const where = conditions.length > 0 ? conditions.join("~and") : undefined
  const sort = sortDir === "desc" ? `-${sortField}` : sortField

  const result = await listRecords<TransactionRecord>("transactions", {
    where,
    sort,
    limit: TRANSACTIONS_PAGE_SIZE,
    offset,
  })

  return {
    transactions: result.list,
    totalRows: result.pageInfo.totalRows,
    hasMore: !result.pageInfo.isLastPage,
  }
}
```

```typescript
// src/actions/load-transactions.ts
"use server"
import { getTransactionsPage, type TransactionsPage } from "@/lib/transactions"

export async function loadMoreTransactions(
  offset: number,
  filters?: { symbol?: string; platform?: string; type?: string; dateFrom?: string; dateTo?: string },
  sortField?: string,
  sortDir?: "asc" | "desc",
): Promise<TransactionsPage> {
  return getTransactionsPage(offset, filters, sortField, sortDir)
}
```

```typescript
// src/app/transactions/page.tsx (Server Component)
import { getTransactionsPage } from "@/lib/transactions"
import { TransactionsTable } from "@/components/transactions/transactions-table"

export default async function TransactionsPage() {
  const initialData = await getTransactionsPage()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <TransactionsTable initialData={initialData} />
    </div>
  )
}
```

### Pattern 2: Intersection Observer Load-More Trigger
**What:** A sentinel div at the bottom of the transaction list triggers loading more data when it becomes visible.
**When to use:** Infinite scroll for transactions
**Why:** Simpler than scroll event listeners, handles edge cases (fast scroll, resize), works with the native browser API.

```typescript
// src/components/transactions/load-more-trigger.tsx
"use client"
import { useEffect, useRef } from "react"

interface LoadMoreTriggerProps {
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
}

export function LoadMoreTrigger({ onLoadMore, hasMore, isLoading }: LoadMoreTriggerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    const current = ref.current
    if (current) observer.observe(current)

    return () => {
      if (current) observer.unobserve(current)
    }
  }, [onLoadMore, hasMore, isLoading])

  if (!hasMore) return null

  return (
    <div ref={ref} className="flex justify-center py-4">
      {isLoading ? <Skeleton className="h-8 w-32" /> : null}
    </div>
  )
}
```

### Pattern 3: Roll Chain Inference Algorithm
**What:** Infer roll chains from options data where no explicit `chain_id` column exists. Group by ticker + match "Rolled" status with temporal proximity.
**When to use:** Options dashboard roll chain grouping
**Why:** The OptionRecord schema has `status: "Rolled"` but no chain linking field. Chains must be inferred.

```typescript
// Algorithm for inferring roll chains:
// 1. Group all options by ticker
// 2. Within each ticker group, find options with status "Rolled"
// 3. For each "Rolled" option, find the next option opened for the same ticker
//    where opened date is within 5 days of the rolled option's close_date
// 4. Build chains: Rolled -> next position (which may itself be Rolled -> next, etc.)
// 5. The chain head is the most recent non-Rolled position (or the latest Rolled if all are rolled)
// 6. Chain members are ordered chronologically

interface RollChain {
  /** The current/head position (latest in the chain) */
  head: OptionRecord
  /** Previous legs in the chain, oldest first */
  legs: OptionRecord[]
  /** Cumulative P&L across all legs */
  totalProfit: number
  /** Total premium collected/paid across all legs */
  totalPremium: number
}

function inferRollChains(options: OptionRecord[]): {
  chains: RollChain[]
  standalone: OptionRecord[]  // Options not part of any chain
} {
  // Group by ticker
  const byTicker = new Map<string, OptionRecord[]>()
  for (const opt of options) {
    const group = byTicker.get(opt.ticker) ?? []
    group.push(opt)
    byTicker.set(opt.ticker, group)
  }

  const chains: RollChain[] = []
  const inChain = new Set<number>()  // Track option IDs already in a chain

  for (const [, tickerOptions] of byTicker) {
    // Sort by opened date ascending
    const sorted = [...tickerOptions].sort(
      (a, b) => new Date(a.opened).getTime() - new Date(b.opened).getTime()
    )

    // Find rolled options and build chains
    for (const opt of sorted) {
      if (opt.status !== "Rolled" || inChain.has(opt.Id)) continue

      // Build chain forward from this rolled option
      const chain: OptionRecord[] = [opt]
      let current = opt

      while (current.status === "Rolled" && current.close_date) {
        const closeDate = new Date(current.close_date).getTime()
        // Find next option opened within 5 days of close
        const next = sorted.find(
          (o) =>
            !inChain.has(o.Id) &&
            o.Id !== current.Id &&
            !chain.includes(o) &&
            Math.abs(new Date(o.opened).getTime() - closeDate) <= 5 * 86400000
        )
        if (!next) break
        chain.push(next)
        current = next
      }

      if (chain.length > 1) {
        for (const c of chain) inChain.add(c.Id)
        chains.push({
          head: chain[chain.length - 1],
          legs: chain.slice(0, -1),
          totalProfit: chain.reduce((sum, c) => sum + (c.profit ?? 0), 0),
          totalPremium: chain.reduce((sum, c) => sum + c.premium, 0),
        })
      }
    }
  }

  const standalone = options.filter((o) => !inChain.has(o.Id))
  return { chains, standalone }
}
```

### Pattern 4: Options Data Assembly (Server-Side)
**What:** Fetch all options + current prices, compute stat card metrics, infer roll chains, prepare display-ready data.
**When to use:** The options page Server Component.

```typescript
// src/lib/options.ts
import "server-only"
import { getAllRecords, fetchParallel } from "./nocodb"
import type { OptionRecord, SymbolRecord } from "./types"

export interface OptionsStats {
  totalPremiumCollected: number    // Sum of premium where buy_sell === "Sell"
  capitalGainsPnl: number          // Sum of profit where status === "Assigned"
  winRate: number                   // % of closed positions with profit > 0
  avgDaysHeld: number               // Mean days_held for closed positions
}

export interface OptionsPageData {
  options: OptionRecord[]
  stats: OptionsStats
  symbolPrices: Map<string, number>   // For LEAPS current price column
  premiumByMonth: MonthlyPremium[]    // For the bar chart
}

export interface MonthlyPremium {
  month: string         // "YYYY-MM" format
  wheel: number         // Premium from Wheel positions closed/opened in this month
  leaps: number         // Premium from LEAPS positions closed/opened in this month
}

export async function getOptionsPageData(): Promise<OptionsPageData> {
  const [options, symbols] = await fetchParallel(
    () => getAllRecords<OptionRecord>("options"),
    () => getAllRecords<SymbolRecord>("symbols", { fields: ["symbol", "current_price"] }),
  )

  // Build symbol price lookup
  const symbolPrices = new Map<string, number>()
  for (const s of symbols) {
    if (s.current_price != null) {
      symbolPrices.set(s.symbol, s.current_price)
    }
  }

  // Compute stats
  const closedStatuses = ["Closed", "Expired", "Assigned", "Rolled"]
  const closedOptions = options.filter((o) => closedStatuses.includes(o.status))
  const profitable = closedOptions.filter((o) => (o.profit ?? 0) > 0)

  const stats: OptionsStats = {
    totalPremiumCollected: options
      .filter((o) => o.buy_sell === "Sell")
      .reduce((sum, o) => sum + o.premium, 0),
    capitalGainsPnl: options
      .filter((o) => o.status === "Assigned")
      .reduce((sum, o) => sum + (o.profit ?? 0), 0),
    winRate: closedOptions.length > 0
      ? (profitable.length / closedOptions.length) * 100
      : 0,
    avgDaysHeld: closedOptions.length > 0
      ? closedOptions.reduce((sum, o) => sum + (o.days_held ?? 0), 0) / closedOptions.length
      : 0,
  }

  // Build premium by month for chart
  const premiumByMonth = buildPremiumByMonth(options)

  return { options, stats, symbolPrices, premiumByMonth }
}
```

### Pattern 5: Expiry Highlighting with Conditional Row Styling
**What:** Apply amber/red background to table rows based on days to expiry.
**When to use:** Wheel and LEAPS tables for open positions (OPTS-04).

```typescript
// Utility for DTE classification
import { differenceInDays } from "date-fns"

type DteStatus = "normal" | "warning" | "danger"

function getDteStatus(expirationDate: string): DteStatus {
  const dte = differenceInDays(new Date(expirationDate), new Date())
  if (dte < 0) return "danger"   // Past expiration
  if (dte <= 7) return "warning"  // Within 7 days
  return "normal"
}

// In the table row:
// className={cn(
//   getDteStatus(row.expiration) === "danger" && "bg-destructive/10",
//   getDteStatus(row.expiration) === "warning" && "bg-amber-500/10",
//   row.status !== "Open" && "opacity-60",
// )}
```

### Pattern 6: Stacked Bar Chart for Premium
**What:** Monthly premium bar chart with Wheel and LEAPS series stacked, year selector dropdown.
**When to use:** Options page (OPTS-07) and portfolio overview summary.

```typescript
// Data format for the bar chart
const chartData = [
  { month: "Jan", wheel: 450, leaps: 120 },
  { month: "Feb", wheel: 380, leaps: 200 },
  // ...
]

const chartConfig = {
  wheel: { label: "Wheel", color: "var(--chart-1)" },
  leaps: { label: "LEAPS", color: "var(--chart-2)" },
} satisfies ChartConfig

// Chart component
<ChartContainer config={chartConfig} className="h-[300px] w-full">
  <BarChart data={chartData} accessibilityLayer>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <YAxis tickFormatter={(v) => `$${v}`} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="wheel" stackId="premium" fill="var(--color-wheel)" radius={[4, 4, 0, 0]} />
    <Bar dataKey="leaps" stackId="premium" fill="var(--color-leaps)" radius={[4, 4, 0, 0]} />
  </BarChart>
</ChartContainer>
```

### Pattern 7: TanStack Table Expandable Rows for Roll Chains
**What:** Use TanStack Table's `getExpandedRowModel` and sub-rows feature for roll chain display.
**When to use:** Wheel and LEAPS tables with roll chains.

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  type ExpandedState,
} from "@tanstack/react-table"

// Data shape with sub-rows:
interface OptionsRow {
  option: OptionRecord
  isChainHead: boolean
  cumulativeProfit: number | null
  cumulativePremium: number | null
  subRows?: OptionsRow[]  // Roll chain legs (TanStack Table uses this property name)
}

// Table setup:
const table = useReactTable({
  data: optionsRows,
  columns,
  state: { sorting, expanded },
  onExpandedChange: setExpanded,
  getSubRows: (row) => row.subRows,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
})

// In the table body, sub-rows are automatically indented:
// Check row.depth to apply indentation: pl-${row.depth * 6}
```

### Anti-Patterns to Avoid
- **Fetching all 963 transactions on initial page load:** Use server-side pagination with NocoDB limit/offset. Load 50 at a time via infinite scroll.
- **Using client-side sorting with server-paginated data:** When the table only has a partial dataset (50 of 963), client-side sort only sorts the loaded page. Sorting must be done server-side via NocoDB `sort` parameter, then re-fetch from page 1.
- **Using client-side filtering with server-paginated data:** Same issue. Filters must be sent to NocoDB `where` parameter. Re-fetch from offset 0 when filters change.
- **Rendering all loaded rows without limit:** As the user scrolls and loads 200, 400, 600+ rows, the DOM grows. At ~960 rows this is still acceptable (no virtualization needed), but avoid unnecessary re-renders by memoizing row components.
- **Putting roll chain inference in the render path:** Roll chain computation should happen once in the data assembly layer, not on every render. Compute chains in the Server Component or a useMemo in the Client Component.
- **Passing OptionRecord directly to sub-row components:** Create a display-ready type that includes computed fields (DTE, intrinsic value, extrinsic value) rather than computing in JSX.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting with paginated data | Custom sort + refetch logic | TanStack Table `SortingState` + NocoDB `sort` param | TanStack handles UI state; NocoDB handles actual sorting |
| Expandable/collapsible row groups | Custom DOM manipulation | TanStack Table `getExpandedRowModel()` + `subRows` | Built-in expand/collapse, handles nested depth, keyboard navigation |
| Date range picker UI | Custom calendar + popover | shadcn Calendar + Popover composition | Handles all edge cases (leap years, locale, range selection) |
| Platform dropdown | Custom dropdown | shadcn Select component | Accessibility, keyboard nav, styling consistency |
| Tab navigation | Custom tab state | shadcn Tabs (Radix UI) | ARIA roles, keyboard nav, focus management |
| Monthly premium chart | Custom SVG | Recharts BarChart + shadcn ChartContainer | Tooltips, responsive sizing, accessibility |
| Date difference calculations | Manual date math | date-fns `differenceInDays`, `format`, `parseISO` | Handles timezones, DST, edge cases |
| Financial number formatting | Inline `toFixed(2)` | Centralised `formatCurrency`, `formatPercent` utilities | Consistent locale-aware formatting |

**Key insight:** This phase is primarily about data display and UI construction. The data layer (NocoDB client, types) and calculation engine already exist. The main engineering effort is building the UI components, handling the server/client data flow for paginated transactions, and the roll chain inference logic.

## Common Pitfalls

### Pitfall 1: Client-Side Sort/Filter With Server-Side Pagination
**What goes wrong:** User sorts by "Symbol" but only the currently loaded 50 rows get sorted. The sort looks wrong because rows 51-963 are not included.
**Why it happens:** TanStack Table sorts/filters the in-memory data. If only 50 rows are loaded, sorting only affects those 50.
**How to avoid:** When sort or filter changes: (1) reset the data array to empty, (2) set offset back to 0, (3) re-fetch from NocoDB with the new sort/filter params, (4) replace the data with the new first page. The Server Action must accept sort field, sort direction, and all filter parameters.
**Warning signs:** Sorting shows results that don't match expected order, or filtering shows unexpected results.

### Pitfall 2: Stale Closure in Intersection Observer Callback
**What goes wrong:** The load-more function uses stale offset/filter values, fetching the same page repeatedly or using old filter criteria.
**Why it happens:** The Intersection Observer callback captures the closure at creation time. If offset or filters change but the observer isn't recreated, the callback uses old values.
**How to avoid:** Include the offset, filters, and loading state in the useEffect dependency array. Re-create the observer when these change. Use a ref for the loading flag to prevent double-fetching.
**Warning signs:** Same 50 rows load repeatedly, or load-more uses old filter criteria.

### Pitfall 3: Roll Chain Inference Mismatch
**What goes wrong:** A "Rolled" option doesn't get linked to its successor, creating orphan positions.
**Why it happens:** The temporal proximity threshold is too strict (e.g., requiring same-day match) or too loose (matching unrelated positions). Different tickers getting mixed.
**How to avoid:** Match on: (1) same ticker, (2) same call_put type, (3) close_date within 5 calendar days of the next position's opened date. Also match buy_sell direction. Log unmatched "Rolled" positions for manual review.
**Warning signs:** "Rolled" status options appearing as standalone rows instead of chain members.

### Pitfall 4: LEAPS Additional Columns Require Current Price
**What goes wrong:** Intrinsic Value, Extrinsic Value, and Current P&L columns show null or incorrect values.
**Why it happens:** These columns depend on the underlying stock's current price, which is in the symbols table, not the options table. If the symbol price lookup misses, all derived columns are null.
**How to avoid:** Fetch symbols table in parallel with options. Build a `Map<string, number>` of ticker -> current_price. Compute derived fields server-side before passing to client. Handle null current_price gracefully (show "N/A").
**Warning signs:** LEAPS table shows all N/A for current price-dependent columns.

### Pitfall 5: Bar Chart Month Labels Don't Align
**What goes wrong:** Premium chart shows gaps for months with no activity, or bars are out of order.
**Why it happens:** Only months with premium data exist in the array. Missing months create gaps. The chart doesn't auto-fill missing months.
**How to avoid:** Generate a complete array of months for the selected year (Jan-Dec or up to current month). Fill months with no premium data with `{ wheel: 0, leaps: 0 }`. This ensures the X-axis is continuous.
**Warning signs:** Chart has gaps between bars or months appear out of order.

### Pitfall 6: Date Range Filter Timezone Issues
**What goes wrong:** Filtering by date range misses transactions on the boundary dates.
**Why it happens:** NocoDB stores dates as ISO strings. JavaScript Date parsing can introduce timezone offsets. A filter for "2024-01-15" might miss records stored as "2024-01-15T00:00:00.000Z" if the comparison is timezone-shifted.
**How to avoid:** Use date-only strings ("2024-01-15") for NocoDB `where` clauses with `exactDate` operator. Don't convert to Date objects for the filter -- pass strings directly. Use `format(date, "yyyy-MM-dd")` from date-fns for consistent formatting.
**Warning signs:** Transactions on filter boundary dates appear or disappear depending on user's timezone.

### Pitfall 7: Stat Cards Show Wrong Totals After Tab Switch
**What goes wrong:** User switches from Wheel tab to LEAPS tab, and stat cards show LEAPS-only numbers.
**Why it happens:** Context specifies "Stat cards always show overall totals regardless of active tab." If stat cards are inside the tab content and re-render with tab-specific data, totals change.
**How to avoid:** Place stat cards ABOVE the tabs, outside the TabsContent. Compute stats once from all options data. Stat cards are independent of tab state.
**Warning signs:** Total premium changes when switching tabs.

### Pitfall 8: Excessive NocoDB Requests During Filter Changes
**What goes wrong:** Typing "AAPL" into symbol search sends 4 requests: "A", "AA", "AAP", "AAPL".
**Why it happens:** Each keystroke triggers a filter change, which triggers a data refetch.
**How to avoid:** Debounce the symbol search input. Wait 300ms after the last keystroke before sending the NocoDB request. Use `setTimeout`/`clearTimeout` pattern in the onChange handler.
**Warning signs:** NocoDB rate limit errors or visible flicker as results change rapidly.

## Code Examples

### Transaction Filter Bar
```typescript
// src/components/transactions/transactions-filters.tsx
"use client"
import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BROKERS, type Broker } from "@/lib/types"
// Date range picker using shadcn Calendar + Popover composition

interface TransactionFilters {
  symbol: string
  platform: string    // "" for all
  type: string        // "" for all, "Buy", "Sell"
  dateFrom: string    // ISO date or ""
  dateTo: string      // ISO date or ""
}

interface Props {
  filters: TransactionFilters
  onFiltersChange: (filters: TransactionFilters) => void
}

export function TransactionsFilters({ filters, onFiltersChange }: Props) {
  const allBrokers = [...BROKERS.active, ...BROKERS.archived]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Symbol search with debounce */}
      <Input
        placeholder="Search symbol..."
        value={filters.symbol}
        onChange={(e) => onFiltersChange({ ...filters, symbol: e.target.value })}
        className="w-[200px]"
      />

      {/* Platform dropdown */}
      <Select
        value={filters.platform}
        onValueChange={(v) => onFiltersChange({ ...filters, platform: v })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Platforms</SelectItem>
          {allBrokers.map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Buy/Sell toggle */}
      <ToggleGroup
        type="single"
        value={filters.type}
        onValueChange={(v) => onFiltersChange({ ...filters, type: v })}
      >
        <ToggleGroupItem value="">All</ToggleGroupItem>
        <ToggleGroupItem value="Buy">Buy</ToggleGroupItem>
        <ToggleGroupItem value="Sell">Sell</ToggleGroupItem>
      </ToggleGroup>

      {/* Date range picker (Calendar + Popover composition) */}
      {/* Implementation follows shadcn date-picker range pattern */}
    </div>
  )
}
```

### Status Badge Component
```typescript
// Reusable badge for option status and transaction type
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type OptionStatus = "Open" | "Closed" | "Expired" | "Rolled" | "Assigned"

const statusVariants: Record<OptionStatus, string> = {
  Open: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Closed: "bg-muted text-muted-foreground",
  Expired: "bg-muted text-muted-foreground",
  Rolled: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Assigned: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
}

function StatusBadge({ status }: { status: OptionStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", statusVariants[status])}>
      {status}
    </Badge>
  )
}

// Transaction type badge
function TypeBadge({ type }: { type: "Buy" | "Sell" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        type === "Buy"
          ? "bg-gain/15 text-gain"
          : "bg-loss/15 text-loss"
      )}
    >
      {type}
    </Badge>
  )
}
```

### LEAPS Derived Column Calculations
```typescript
// Computed columns for LEAPS (not stored in DB)
interface LeapsDisplayRow {
  // ... all OptionRecord fields ...
  currentPrice: number | null          // From symbols table
  intrinsicValue: number | null        // max(0, currentPrice - strike) for Call
  extrinsicValue: number | null        // premium - intrinsicValue
  valueLostPerMonth: number | null     // (extrinsicValue / daysHeldSoFar) * 30 * 100
  costBasis: number | null             // strike + premium for Call, strike - premium for Put
  premiumFeePct: number | null         // (premium / strike) * 100
  daysToExpiry: number                 // differenceInDays(expiration, today)
  currentPnl: number | null            // For open: (currentPrice - costBasis) * qty * 100
}

function computeLeapsDisplay(opt: OptionRecord, currentPrice: number | null): LeapsDisplayRow {
  const dte = differenceInDays(new Date(opt.expiration), new Date())
  const daysOpen = differenceInDays(new Date(), new Date(opt.opened))

  let intrinsicValue: number | null = null
  let extrinsicValue: number | null = null
  let costBasis: number | null = null

  if (currentPrice != null) {
    if (opt.call_put === "Call") {
      intrinsicValue = Math.max(0, currentPrice - opt.strike)
      costBasis = opt.strike + opt.premium
    } else {
      intrinsicValue = Math.max(0, opt.strike - currentPrice)
      costBasis = opt.strike - opt.premium
    }
    extrinsicValue = opt.premium - intrinsicValue
  }

  return {
    ...opt,
    currentPrice,
    intrinsicValue,
    extrinsicValue,
    valueLostPerMonth: extrinsicValue != null && daysOpen > 0
      ? (extrinsicValue / daysOpen) * 30 * 100
      : null,
    costBasis,
    premiumFeePct: opt.strike > 0 ? (opt.premium / opt.strike) * 100 : null,
    daysToExpiry: dte,
    currentPnl: currentPrice != null && costBasis != null
      ? (currentPrice - costBasis) * opt.qty * 100
      : null,
  }
}
```

### Financial Formatters (shared utility)
```typescript
// src/lib/format.ts
import { format, parseISO, differenceInDays } from "date-fns"

export function formatCurrency(value: number, currency: "USD" | "GBP" = "USD"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function formatNumber(value: number, dp: number = 2): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd MMM yyyy")
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yy")
}

export function daysToExpiry(expirationDate: string): number {
  return differenceInDays(parseISO(expirationDate), new Date())
}

export function pnlClassName(value: number): string {
  if (value > 0) return "text-gain"
  if (value < 0) return "text-loss"
  return "text-muted-foreground"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useEffect + fetch for pagination | Server Actions for data loading | Next.js 14+ (2024), stable in 16 | Simpler server/client boundary, no API route needed for pagination |
| Custom intersection observer hooks | Native IntersectionObserver in useEffect | Well-supported since 2020+ | No extra dependency needed; `react-intersection-observer` is overkill for single use |
| Recharts 2.x BarChart | Recharts 3.7.0 with shadcn ChartContainer | Recharts 3.0 (2024+) | Better TypeScript support, fixed accessibility, shadcn integration |
| Manual tab state management | Radix UI Tabs via shadcn | Radix UI 1.x+ | Full ARIA support, keyboard navigation, focus management |
| react-datepicker | shadcn Calendar + Popover (react-day-picker 9.x) | 2024+ | Better integration with shadcn design system, range selection built-in |
| TanStack Table v7 | TanStack Table v8.21.3 | v8 (2022+) | Complete rewrite, better TypeScript, headless architecture |

**Deprecated/outdated:**
- `react-datepicker` -- Use shadcn Calendar + Popover (react-day-picker) instead for design consistency
- Recharts `<ResponsiveContainer>` -- Use shadcn `ChartContainer` instead
- `getServerSideProps` for pagination -- Use Server Actions in App Router
- Manual API routes for data fetching -- Server Actions are simpler for same-origin data operations

## Open Questions

1. **Roll Chain Inference Accuracy**
   - What we know: Options have `status: "Rolled"` but no `chain_id` or linking field. Chains must be inferred from ticker + temporal proximity.
   - What's unclear: How reliable is the 5-day proximity heuristic? Are there cases where multiple options for the same ticker roll on the same day?
   - Recommendation: Implement the inference algorithm with the heuristic. Log unmatched "Rolled" positions. After Phase 6 (write operations), add a `chain_id` field to the options table for explicit linking, and backfill from the inferred chains.

2. **LEAPS "Current P&L" Without Live Options Pricing**
   - What we know: Memory notes say "Option market values updated manually (no free options pricing API)." LEAPS P&L depends on the option's current market value.
   - What's unclear: Is "Current P&L" for LEAPS based on the underlying stock price (intrinsic value calculation) or on the option's market price (which would require manual updates)?
   - Recommendation: Display P&L based on intrinsic value calculation using the underlying stock's current price (from symbols table). Add a note/tooltip explaining this is intrinsic-value-based, not market-value-based. This provides useful directional information without requiring manual option price updates.

3. **Premium Chart: Which Date Determines Month Assignment?**
   - What we know: OPTS-07 says "monthly premium bar chart" grouped by Wheel vs LEAPS.
   - What's unclear: For the chart, should premium be assigned to the month the option was opened, closed, or the expiration month?
   - Recommendation: Use the `opened` date for the month assignment. This reflects when premium was received (for sold options) or paid (for bought options), which is the financially meaningful date.

4. **Transaction Server-Side Sort: Column Name Mapping**
   - What we know: The NocoDB sort param uses the column name directly (e.g., `-date`). Transaction columns map to DB column names.
   - What's unclear: Whether NocoDB sort is case-sensitive or handles column names that differ from the API field names.
   - Recommendation: Use the exact NocoDB column names (lowercase with underscores) for sort parameters. Test all sortable columns during implementation.

5. **Phase 3 Dependency: Shared Components**
   - What we know: Phase 4 depends on Phase 2, not Phase 3. But Phase 3 research identified the same libraries (TanStack Table, Recharts, shadcn components).
   - What's unclear: If Phase 3 is implemented first, many shadcn components and npm packages will already be installed. If Phase 4 is implemented before Phase 3, all must be installed fresh.
   - Recommendation: The planner should check which components/packages already exist and skip redundant installations. The installation commands in this research assume nothing is pre-installed.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Data Table Guide](https://ui.shadcn.com/docs/components/radix/data-table) - TanStack Table integration, column definitions, sorting, filtering, pagination patterns
- [shadcn/ui Chart Docs](https://ui.shadcn.com/docs/components/radix/chart) - ChartContainer, ChartConfig, ChartTooltip, bar chart data format
- [shadcn/ui Tabs Docs](https://ui.shadcn.com/docs/components/radix/tabs) - Tabs/TabsList/TabsTrigger/TabsContent API
- [shadcn/ui Select Docs](https://ui.shadcn.com/docs/components/radix/select) - Select/SelectTrigger/SelectContent/SelectItem API
- [shadcn/ui Date Picker Docs](https://ui.shadcn.com/docs/components/radix/date-picker) - Calendar + Popover date range composition
- [shadcn/ui Bar Charts](https://ui.shadcn.com/charts/bar) - Stacked bar chart examples with ChartConfig
- [TanStack Table v8 Docs](https://tanstack.com/table/v8/docs/guide/sorting) - Sorting, filtering, expandable rows, pagination
- Codebase: `src/lib/types.ts` - TransactionRecord, OptionRecord data shapes
- Codebase: `src/lib/nocodb.ts` - listRecords, getAllRecords, fetchParallel API

### Secondary (MEDIUM confidence)
- [Recharts stacked bar chart with stackId](https://spin.atomicobject.com/stacked-bar-charts-recharts/) - stackId prop for grouped/stacked bars
- [Next.js Infinite Scroll with Server Actions](https://blog.logrocket.com/implementing-infinite-scroll-next-js-server-actions/) - Intersection Observer + Server Action pattern
- [TanStack Table Virtualized Infinite Scrolling Example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-infinite-scrolling) - fetchMoreOnBottomReached pattern
- npm: @tanstack/react-table@8.21.3, recharts@3.7.0, date-fns@4.1.0, react-day-picker@9.13.1 - Versions verified on npm

### Tertiary (LOW confidence)
- Roll chain inference algorithm - Custom design, not based on any standard library. Heuristic (5-day proximity) needs validation against actual data.
- LEAPS intrinsic value P&L calculation - Standard options math, but the decision to use intrinsic-value-based P&L (vs market-value) is a design choice that may need user validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Same libraries as Phase 3 (TanStack Table, Recharts, shadcn), versions verified on npm
- Architecture: HIGH - Server Component data assembly + Client Component interactivity follows established Next.js App Router patterns. Server Actions for pagination well-documented.
- Data layer: HIGH - All NocoDB query capabilities verified from existing codebase. Transaction/Option record types fully understood.
- Roll chain inference: MEDIUM - Custom algorithm, no standard solution exists. Heuristic approach is sound but needs validation against actual data.
- LEAPS derived columns: MEDIUM - Standard options math, but design choice for intrinsic-value-based P&L needs user validation.
- Pitfalls: HIGH - Server-side pagination + client sort/filter interaction is the most common source of bugs in paginated table implementations. Well-documented in TanStack Table community.

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days -- stable domain, libraries mature)
