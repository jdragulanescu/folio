# Phase 3: Portfolio Overview - Research

**Researched:** 2026-02-06
**Domain:** Portfolio dashboard UI, data tables, charting, server-to-client data flow, financial display patterns
**Confidence:** HIGH

## Summary

Phase 3 builds the primary dashboard page at `/` that displays all current holdings with live prices, P&L, allocation breakdowns, and top movers. It consumes the calculation engine and data layer built in Phases 1-2, so the core challenge is UI construction, not data pipeline work. The phase involves three main UI areas: (1) a sortable/filterable holdings table with column visibility, (2) summary metric cards, and (3) allocation donut charts plus top movers. A symbol detail drill-down page completes the requirements.

The standard approach is: a Next.js async Server Component fetches all data in parallel (symbols, transactions, deposits, options), runs `computePortfolio()` from the existing calculations engine, serialises results to plain numbers via `toDisplay()`, then passes them as props to Client Components for interactive UI (table sorting/filtering, chart hovering). TanStack Table provides headless table logic (sorting, filtering, column visibility), shadcn/ui provides the styled primitives (Table, Card, Badge), and Recharts (via shadcn Chart component) provides the donut charts.

**Primary recommendation:** Use `@tanstack/react-table` for the holdings table with shadcn Table primitives. Use shadcn Chart (Recharts wrapper) for donut charts. Fetch and compute all data server-side, convert Big.js values to serialisable numbers at the server boundary, then pass plain data to client components. No new data fetching patterns needed -- reuse existing `getAllRecords`, `fetchParallel`, and `computePortfolio`.

## Existing Codebase Assets (Phase 1 & 2)

Understanding what is already built is critical for planning this phase correctly.

### Data Layer (reuse as-is)
| Module | Location | What It Provides |
|--------|----------|------------------|
| NocoDB client | `src/lib/nocodb.ts` | `getAllRecords<T>(table)`, `fetchParallel(...)`, `listRecords<T>(table, params)` |
| Type definitions | `src/lib/types.ts` | `SymbolRecord`, `TransactionRecord`, `OptionRecord`, `DepositRecord`, `DividendRecord` + broker constants |
| FMP client | `src/lib/fmp.ts` | `fetchBatchQuotes()`, `fetchForexRate()`, `fetchKeyMetricsTTM()` -- server-only |
| FMP types | `src/lib/fmp-types.ts` | `FMPQuote`, `FMPForexQuote`, `FMPKeyMetricsTTM` |

### Calculation Engine (reuse as-is)
| Function | Location | What It Returns |
|----------|----------|-----------------|
| `computeHolding(transactions, currentPrice)` | `src/lib/calculations.ts` | `HoldingResult` with `shares`, `avgCost`, `totalCost`, `realisedPnl`, `unrealisedPnl`, `marketValue` (all Big) |
| `computePortfolio(holdings)` | `src/lib/calculations.ts` | `PortfolioResult` with `holdings: PortfolioHolding[]` and `totals: PortfolioTotals` |
| `toDisplay(value, dp)` | `src/lib/calculations.ts` | Converts Big to number with fixed decimal places |

### Key types from calculations engine
- `PortfolioHolding`: `symbol`, `name`, `sector`, `strategy`, `currentPrice`, `weight`, `shares`, `avgCost`, `totalCost`, `realisedPnl`, `unrealisedPnl`, `marketValue` (all Big)
- `PortfolioTotals`: `totalMarketValue`, `totalCost`, `totalUnrealisedPnl`, `totalRealisedPnl` (all Big)

### Existing UI Components
| Component | Location | Notes |
|-----------|----------|-------|
| Button | `src/components/ui/button.tsx` | Already installed |
| Input | `src/components/ui/input.tsx` | Already installed (for search filter) |
| Separator | `src/components/ui/separator.tsx` | Already installed |
| Sheet | `src/components/ui/sheet.tsx` | Already installed |
| Sidebar | `src/components/ui/sidebar.tsx` | Already installed (full sidebar system) |
| Skeleton | `src/components/ui/skeleton.tsx` | Already installed (for loading states) |
| Tooltip | `src/components/ui/tooltip.tsx` | Already installed |

### Existing Layout
- Root layout at `src/app/layout.tsx` with `SidebarProvider` + `SidebarInset` + main content area
- Main content padding: `p-4 md:p-6`
- Portfolio page stub at `src/app/page.tsx` -- placeholder to be replaced
- Dark/light theme via `next-themes` with custom CSS variables including `--color-gain` and `--color-loss`

### Existing CSS Variables (relevant for charts/finance)
- `--color-gain: oklch(0.723 0.191 142.5)` -- green for gains
- `--color-loss: oklch(0.637 0.237 25.3)` -- red for losses
- `--color-chart-1` through `--color-chart-5` -- pre-defined chart colour palette

### NOT Yet Installed (Need to add)
- `recharts` -- NOT in node_modules despite being in stack notes
- `@tanstack/react-table` -- NOT in node_modules
- shadcn `table` component -- NOT in `src/components/ui/`
- shadcn `card` component -- NOT in `src/components/ui/`
- shadcn `chart` component -- NOT in `src/components/ui/`
- shadcn `badge` component -- NOT in `src/components/ui/`
- shadcn `dropdown-menu` component -- NOT in `src/components/ui/` (for column visibility toggle)

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Headless table: sorting, filtering, column visibility, pagination | De facto standard for React data tables; shadcn/ui's data table guide is built on it |
| recharts | ^3.7.0 | Charting library for donut/pie charts | Already the chosen chart library; shadcn Chart component wraps it |

### shadcn Components to Install
| Component | Install Command | Purpose |
|-----------|----------------|---------|
| table | `pnpm dlx shadcn@latest add table` | Base table primitives (Table, TableHeader, TableBody, TableRow, TableHead, TableCell) |
| card | `pnpm dlx shadcn@latest add card` | Summary cards, top movers cards (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction) |
| chart | `pnpm dlx shadcn@latest add chart` | Chart wrapper (ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig) |
| badge | `pnpm dlx shadcn@latest add badge` | Sector/strategy labels in table |
| dropdown-menu | `pnpm dlx shadcn@latest add dropdown-menu` | Column visibility toggle dropdown |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Manual sort/filter state | TanStack handles edge cases (multi-sort, stable sort, type-aware comparison) that manual implementation would miss |
| Recharts donut | Nivo, Victory | Recharts is already the shadcn standard; adding another charting lib would increase bundle size |
| shadcn Table | ag-grid, react-data-grid | Overkill for ~50-100 rows; shadcn + TanStack gives full styling control |
| Client-side filtering | Server-side with NocoDB `where` | With ~120 symbols max, client-side sort/filter is instant; server-side adds latency for no benefit |

**Installation:**
```bash
pnpm add @tanstack/react-table recharts
pnpm dlx shadcn@latest add table card chart badge dropdown-menu
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Server Component: parallel data fetch, compute portfolio, pass props
│   └── symbol/
│       └── [symbol]/
│           └── page.tsx            # Symbol detail page (PORT-12)
├── components/
│   ├── portfolio/
│   │   ├── holdings-table.tsx      # Client: TanStack Table with sort/filter/visibility
│   │   ├── holdings-columns.tsx    # Column definitions for the holdings table
│   │   ├── summary-cards.tsx       # Client: metric cards (total value, P&L, day change, deposited, options premium)
│   │   ├── allocation-charts.tsx   # Client: sector + strategy donut charts
│   │   ├── top-movers.tsx          # Client: top 5 gainers/losers cards
│   │   └── column-visibility.tsx   # Client: dropdown for toggling column visibility
│   └── ui/
│       ├── table.tsx               # (shadcn add)
│       ├── card.tsx                # (shadcn add)
│       ├── chart.tsx               # (shadcn add)
│       ├── badge.tsx               # (shadcn add)
│       └── dropdown-menu.tsx       # (shadcn add)
├── lib/
│   ├── portfolio.ts                # Server: data assembly function (fetch + compute + serialise)
│   ├── calculations.ts             # (existing) -- reuse computePortfolio, toDisplay
│   ├── nocodb.ts                   # (existing) -- reuse getAllRecords, fetchParallel
│   └── types.ts                    # (existing) -- may add display-ready interfaces
└── hooks/
    └── use-column-visibility.ts    # Client: localStorage persistence for column preferences
```

### Pattern 1: Server Component Data Assembly
**What:** The page Server Component fetches all raw data in parallel, runs computePortfolio, converts Big values to plain numbers, then passes serialisable data to Client Components
**When to use:** The root page.tsx
**Why:** Big.js instances are NOT serialisable. They must be converted to numbers before crossing the server-client boundary.

```typescript
// src/lib/portfolio.ts
import "server-only"
import { getAllRecords, fetchParallel } from "./nocodb"
import { computePortfolio, toDisplay } from "./calculations"
import type { SymbolRecord, TransactionRecord, DepositRecord, OptionRecord } from "./types"

// Display-ready types (all numbers, no Big.js)
export interface DisplayHolding {
  symbol: string
  name: string
  sector: string | null
  strategy: string | null
  currentPrice: number
  previousClose: number | null
  changePct: number | null
  shares: number
  avgCost: number
  totalCost: number
  marketValue: number
  unrealisedPnl: number
  unrealisedPnlPct: number
  realisedPnl: number
  weight: number
  platform: string  // primary broker for the holding
}

export interface PortfolioData {
  holdings: DisplayHolding[]
  totals: { totalMarketValue: number; totalCost: number; totalUnrealisedPnl: number; totalRealisedPnl: number }
  totalDeposited: number
  optionsPremium: number
  dayChange: number
  dayChangePct: number
}

export async function getPortfolioData(): Promise<PortfolioData> {
  // Parallel fetch from NocoDB
  const [symbols, transactions, deposits, options] = await fetchParallel(
    () => getAllRecords<SymbolRecord>("symbols"),
    () => getAllRecords<TransactionRecord>("transactions"),
    () => getAllRecords<DepositRecord>("deposits"),
    () => getAllRecords<OptionRecord>("options"),
  )

  // Build input for computePortfolio
  // ... group transactions by symbol, attach symbol metadata and current prices
  // ... call computePortfolio(holdingsMap)
  // ... convert all Big values via toDisplay()

  return { holdings, totals, totalDeposited, optionsPremium, dayChange, dayChangePct }
}
```

```typescript
// src/app/page.tsx (Server Component)
import { getPortfolioData } from "@/lib/portfolio"
import { HoldingsTable } from "@/components/portfolio/holdings-table"
import { SummaryCards } from "@/components/portfolio/summary-cards"
import { AllocationCharts } from "@/components/portfolio/allocation-charts"
import { TopMovers } from "@/components/portfolio/top-movers"

export default async function PortfolioPage() {
  const data = await getPortfolioData()

  return (
    <div>
      <SummaryCards data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HoldingsTable holdings={data.holdings} />
        </div>
        <div className="space-y-6">
          <AllocationCharts holdings={data.holdings} />
          <TopMovers holdings={data.holdings} />
        </div>
      </div>
    </div>
  )
}
```

### Pattern 2: TanStack Table with shadcn Primitives
**What:** Column definitions + useReactTable hook + shadcn Table components for rendering
**When to use:** The holdings table

```typescript
// src/components/portfolio/holdings-columns.tsx
"use client"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DisplayHolding } from "@/lib/portfolio"

export const columns: ColumnDef<DisplayHolding>[] = [
  {
    accessorKey: "symbol",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Symbol
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "shares",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Shares
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => row.getValue<number>("shares").toFixed(2),
  },
  // ... more columns for avgCost, currentPrice, marketValue, unrealisedPnl, changePct, sector, strategy, weight
]
```

```typescript
// src/components/portfolio/holdings-table.tsx
"use client"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table"
import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { columns } from "./holdings-columns"
import type { DisplayHolding } from "@/lib/portfolio"

export function HoldingsTable({ holdings }: { holdings: DisplayHolding[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "weight", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div>
      <Input
        placeholder="Search symbols..."
        value={(table.getColumn("symbol")?.getFilterValue() as string) ?? ""}
        onChange={(e) => table.getColumn("symbol")?.setFilterValue(e.target.value)}
      />
      {/* Column visibility dropdown */}
      {/* Table rendering with shadcn Table components */}
    </div>
  )
}
```

### Pattern 3: Donut Chart with Center Text (shadcn Chart + Recharts)
**What:** Recharts PieChart with innerRadius for donut shape, Label component for center text
**When to use:** Sector and strategy allocation charts
**Source:** shadcn/ui GitHub `chart-pie-donut-text.tsx`

```typescript
"use client"
import * as React from "react"
import { Label, Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// Data format: { name: "Technology", value: 45.2, fill: "var(--color-technology)" }
// ChartConfig maps data keys to labels and colours

export function SectorChart({ data }: { data: ChartSlice[] }) {
  const total = React.useMemo(
    () => data.reduce((acc, curr) => acc + curr.value, 0),
    [data],
  )

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                      {total.toLocaleString()}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                      Total
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
```

### Pattern 4: Financial Colour Convention
**What:** Green for positive P&L, red for negative P&L, using the existing CSS variables
**When to use:** Any P&L, day change, or gain/loss display

```typescript
// Utility for conditional gain/loss colouring
function pnlClassName(value: number): string {
  if (value > 0) return "text-gain"     // Uses --color-gain from globals.css
  if (value < 0) return "text-loss"     // Uses --color-loss from globals.css
  return "text-muted-foreground"
}
```

Note: The CSS variables `--color-gain` and `--color-loss` are already defined in `globals.css` and mapped via `@theme inline` to Tailwind utility classes `text-gain` and `text-loss`.

### Pattern 5: Column Visibility Persistence
**What:** Store column visibility preferences in localStorage
**When to use:** The holdings table column visibility dropdown

```typescript
// src/hooks/use-column-visibility.ts
"use client"
import { useState, useEffect } from "react"
import type { VisibilityState } from "@tanstack/react-table"

const STORAGE_KEY = "folio-holdings-columns"

const DEFAULT_VISIBILITY: VisibilityState = {
  // Core columns always visible
  symbol: true,
  shares: true,
  currentPrice: true,
  marketValue: true,
  unrealisedPnl: true,
  weight: true,
  // Optional columns hidden by default
  avgCost: false,
  totalCost: false,
  realisedPnl: false,
  sector: false,
  strategy: false,
  name: false,
}

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { setVisibility(JSON.parse(stored)) } catch { /* use defaults */ }
    }
  }, [])

  const updateVisibility = (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    setVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return [visibility, updateVisibility] as const
}
```

### Anti-Patterns to Avoid
- **Passing Big.js values to Client Components:** Big.js instances are NOT serialisable. Always convert to plain numbers via `toDisplay()` in the Server Component before passing as props. This is the most important boundary to get right.
- **Fetching data in Client Components:** The holdings data should be fetched and computed server-side. Don't use `useEffect` or SWR for the initial portfolio data -- it's a Server Component page.
- **Individual NocoDB queries per symbol:** Use `getAllRecords` to fetch all symbols and transactions in bulk, then group client-side. The portfolio has ~120 symbols and ~963 transactions -- small enough for single-pass processing.
- **Recharts in Server Components:** Recharts requires `"use client"`. Never import Recharts in a Server Component.
- **Sorting in the database:** With ~50-100 active holdings, client-side sorting via TanStack Table is instant. Don't add NocoDB sort params -- that's for Phase 4 pagination (1000+ transactions).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting (multi-column, type-aware) | Custom sort comparators | `@tanstack/react-table` `getSortedRowModel()` | Handles stable sort, multi-column, string/number/date comparison, null handling |
| Table filtering | Custom filter loop | `@tanstack/react-table` `getFilteredRowModel()` | Handles column-specific + global filter, case-insensitive matching |
| Column visibility toggle UI | Custom checkbox list | `@tanstack/react-table` visibility API + shadcn `DropdownMenu` | Built-in `column.toggleVisibility()` + state management |
| Donut chart | Custom SVG or canvas | `recharts` PieChart + shadcn Chart | Tooltips, animations, responsive container, accessibility |
| Financial number formatting | `toFixed(2)` everywhere | Centralised formatter using `Intl.NumberFormat` | Handles locale, currency symbol, thousands separator consistently |
| Gain/loss colour logic | Inline ternary per component | Shared utility class function | One place to change, consistent across table cells, cards, movers |

**Key insight:** The existing `computePortfolio()` already handles the hard work -- computing holdings with Section 104 pool cost basis, weights, and totals. Phase 3 is primarily a presentation/UI phase. The main engineering challenge is the server-to-client serialisation boundary and making TanStack Table work smoothly with shadcn components.

## Common Pitfalls

### Pitfall 1: Big.js Serialisation Boundary
**What goes wrong:** Passing `PortfolioHolding` objects (with Big.js values) directly to Client Components causes a serialisation error at runtime.
**Why it happens:** Big.js instances are class objects, not plain JSON-serialisable values. React's server-client serialisation only supports primitives, plain objects, arrays, Date, Map, Set, and Promises.
**How to avoid:** Create a `DisplayHolding` interface with all `number` fields. Run `toDisplay()` on every Big.js value in a server-side function (e.g., `getPortfolioData()`) BEFORE passing to any Client Component.
**Warning signs:** Runtime error: "Error: Objects are not valid as a React child" or serialisation failure during SSR.

### Pitfall 2: Filtering by Symbol Excludes Partial Matches
**What goes wrong:** User types "AA" expecting to see AAPL but column filter does exact match.
**Why it happens:** TanStack Table's default column filter uses `includesString` which should work, but custom filter functions may break this.
**How to avoid:** Use the default `filterFn: "includesString"` (which is the default for string columns) or explicitly set it. Don't override with a custom filter unless needed.
**Warning signs:** Search doesn't find symbols that partially match.

### Pitfall 3: Stale Data After Price Sync
**What goes wrong:** User syncs prices via sidebar button, but the portfolio page still shows old prices until full page refresh.
**Why it happens:** Server Components only render once on initial request. The sync updates NocoDB but doesn't trigger a Server Component re-render.
**How to avoid:** After sync completes, call `router.refresh()` from the sidebar to trigger a Next.js soft refresh that re-renders the Server Component with fresh data. The `useSync` hook's onComplete callback should trigger this.
**Warning signs:** User clicks Sync Now, sees "Synced!", but portfolio data remains stale.

### Pitfall 4: Recharts Container Sizing
**What goes wrong:** Donut charts render at 0 height or overflow their container.
**Why it happens:** Recharts uses SVG and requires a container with explicit dimensions. The `ResponsiveContainer` component (or shadcn's `ChartContainer`) needs a parent with a defined height.
**How to avoid:** Use shadcn's `ChartContainer` with `className="mx-auto aspect-square max-h-[250px]"` to constrain dimensions. Always wrap charts in a container with known height.
**Warning signs:** Charts appear as thin lines, invisible, or overflow their cards.

### Pitfall 5: Too Many Columns Causes Horizontal Overflow
**What goes wrong:** Showing all 12+ columns at once makes the table unreadable, especially on smaller screens.
**Why it happens:** Requirements list many columns (symbol, name, shares, avgCost, currentPrice, marketValue, P&L, P&L%, dayChange, sector, strategy, weight).
**How to avoid:** Context specifies "Core columns visible by default (~6 key columns), with table settings to toggle additional columns on/off." Default to showing: Symbol, Current Price, Market Value, P&L, Day Change, Weight. Let users toggle on: Name, Shares, Avg Cost, Total Cost, Realised P&L, Sector, Strategy.
**Warning signs:** Table requires horizontal scrolling on standard desktop (1440px) viewport.

### Pitfall 6: Excluding Fully Sold Positions Inconsistently
**What goes wrong:** Symbols with shares=0 appear in charts or top movers but not the table, or vice versa.
**Why it happens:** Filtering is applied at the table level but not at the data assembly level.
**How to avoid:** Filter out shares=0 positions at the data assembly layer (`getPortfolioData()`), BEFORE passing to any UI component. The `computePortfolio` function includes all symbols -- the filter must happen after computation but before display.
**Warning signs:** Donut chart shows "Unknown" slice or top movers includes a symbol with 0 shares.

### Pitfall 7: Day Change Calculation Source
**What goes wrong:** Day change % doesn't match what FMP shows or what the user expects.
**Why it happens:** Confusion between per-symbol day change (from `change_pct` in SymbolRecord) and portfolio-level day change (weighted sum of individual changes).
**How to avoid:** For per-symbol day change: use `change_pct` directly from the SymbolRecord (populated by FMP sync). For portfolio-level day change: calculate as `sum(holding.marketValue * holding.changePct / 100)` across all holdings, then express as percentage of total market value.
**Warning signs:** Portfolio day change doesn't match sum of individual position changes.

### Pitfall 8: "Other" Slice in Allocation Charts
**What goes wrong:** A sector with 0.5% allocation gets its own tiny, unlabelled slice in the donut chart.
**Why it happens:** Every distinct sector/strategy gets its own slice regardless of size.
**How to avoid:** Group allocations below a threshold (e.g., 3%) into an "Other" slice. This is marked as "Claude's discretion" in the context. Sort slices by size descending.
**Warning signs:** Donut chart has many tiny, indistinguishable slices.

## Code Examples

### Data Assembly with Serialisation Boundary

```typescript
// src/lib/portfolio.ts -- the key server-side function
import "server-only"
import { getAllRecords, fetchParallel } from "./nocodb"
import { computePortfolio, toDisplay, type SymbolInput } from "./calculations"
import type { SymbolRecord, TransactionRecord, DepositRecord, OptionRecord } from "./types"

export async function getPortfolioData() {
  const [symbols, transactions, deposits, options] = await fetchParallel(
    () => getAllRecords<SymbolRecord>("symbols"),
    () => getAllRecords<TransactionRecord>("transactions"),
    () => getAllRecords<DepositRecord>("deposits"),
    () => getAllRecords<OptionRecord>("options"),
  )

  // Build symbol lookup
  const symbolMap = new Map(symbols.map((s) => [s.symbol, s]))

  // Group transactions by symbol
  const txBySymbol = new Map<string, TransactionRecord[]>()
  for (const tx of transactions) {
    const existing = txBySymbol.get(tx.symbol) ?? []
    existing.push(tx)
    txBySymbol.set(tx.symbol, existing)
  }

  // Build computePortfolio input
  const holdingsInput = new Map<string, SymbolInput>()
  for (const [symbol, txs] of txBySymbol) {
    const sym = symbolMap.get(symbol)
    if (!sym || sym.current_price == null) continue
    holdingsInput.set(symbol, {
      transactions: txs.map((tx) => ({
        type: tx.type,
        shares: tx.shares,
        price: tx.price,
        amount: tx.amount,
        date: tx.date,
      })),
      currentPrice: sym.current_price,
      name: sym.name,
      sector: sym.sector,
      strategy: sym.strategy,
    })
  }

  const result = computePortfolio(holdingsInput)

  // Filter to active holdings (shares > 0) and convert to display types
  const holdings = result.holdings
    .filter((h) => h.shares.gt(0))
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      sector: h.sector,
      strategy: h.strategy,
      currentPrice: toDisplay(h.currentPrice),
      previousClose: symbolMap.get(h.symbol)?.previous_close ?? null,
      changePct: symbolMap.get(h.symbol)?.change_pct ?? null,
      shares: toDisplay(h.shares, 4),  // 4dp for fractional shares
      avgCost: toDisplay(h.avgCost),
      totalCost: toDisplay(h.totalCost),
      marketValue: toDisplay(h.marketValue),
      unrealisedPnl: toDisplay(h.unrealisedPnl),
      unrealisedPnlPct: h.totalCost.gt(0)
        ? toDisplay(h.unrealisedPnl.div(h.totalCost).times(100))
        : 0,
      realisedPnl: toDisplay(h.realisedPnl),
      weight: toDisplay(h.weight),
    }))

  // Compute aggregates
  const totalDeposited = deposits.reduce((sum, d) => sum + d.amount, 0)
  const optionsPremium = options
    .filter((o) => o.buy_sell === "Sell")
    .reduce((sum, o) => sum + o.premium, 0)

  return {
    holdings,
    totals: {
      totalMarketValue: toDisplay(result.totals.totalMarketValue),
      totalCost: toDisplay(result.totals.totalCost),
      totalUnrealisedPnl: toDisplay(result.totals.totalUnrealisedPnl),
      totalRealisedPnl: toDisplay(result.totals.totalRealisedPnl),
    },
    totalDeposited,
    optionsPremium,
  }
}
```

### TanStack Table Column Definition with Sort Headers

```typescript
// Source: shadcn/ui data table guide
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"

function SortableHeader({ column, children }: { column: any; children: React.ReactNode }) {
  const sorted = column.getIsSorted()
  return (
    <Button variant="ghost" onClick={() => column.toggleSorting(sorted === "asc")}>
      {children}
      {sorted === "asc" ? <ArrowUp className="ml-1 h-4 w-4" /> :
       sorted === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> :
       <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />}
    </Button>
  )
}
```

### Number Formatting Utilities

```typescript
// Centralised formatting functions for financial display
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
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
```

### Symbol Detail Page (PORT-12)

```typescript
// src/app/symbol/[symbol]/page.tsx
import { getAllRecords, listRecords } from "@/lib/nocodb"
import type { SymbolRecord, TransactionRecord } from "@/lib/types"

interface Props {
  params: Promise<{ symbol: string }>
}

export default async function SymbolDetailPage({ params }: Props) {
  const { symbol } = await params
  const upperSymbol = symbol.toUpperCase()

  // Fetch symbol data and transactions in parallel
  const [symbolResult, transactions] = await Promise.all([
    listRecords<SymbolRecord>("symbols", { where: `(symbol,eq,${upperSymbol})` }),
    getAllRecords<TransactionRecord>("transactions", { where: `(symbol,eq,${upperSymbol})`, sort: "-date" }),
  ])

  const symbolData = symbolResult.list[0]
  // Render position summary, fundamentals, and transaction list
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ag-grid or react-data-grid for tables | TanStack Table v8 (headless) + shadcn primitives | TanStack v8 (2022), shadcn data table guide (2023+) | Full styling control, smaller bundle, composable |
| Recharts 2.x `<Label position="center">` | Recharts 3.7.0 with fixed Label viewBox context | Recharts 3.1.2+ (2025) | Center label in donut charts works correctly again |
| Manual chart wrappers | shadcn Chart component (ChartContainer, ChartConfig) | shadcn charts (2024+) | Standardised config, tooltip, and theming for Recharts |
| getServerSideProps (Pages Router) | Async Server Component with direct await | Next.js App Router (13+) | Simpler data fetching, no separate data functions |
| useEffect for page data | Server Component fetch + client interactivity | RSC model (Next.js 13+) | Zero client-side loading state for initial data, faster TTI |

**Deprecated/outdated:**
- Recharts `<ResponsiveContainer>` -- Use shadcn `ChartContainer` instead (handles responsive sizing)
- Manual chart colour arrays -- Use shadcn `ChartConfig` with CSS variable references
- `getServerSideProps` / `getStaticProps` -- Replaced by async Server Components in App Router
- TanStack Table v7 (React Table) -- v8 is a complete rewrite with different API

## Open Questions

1. **Options Premium Collected Calculation**
   - What we know: PORT-04 requires "Options Premium Collected" as a summary card. Options data has `premium` field and `buy_sell` field.
   - What's unclear: Should this sum only sold options premium (wheel puts/calls), or include LEAPS (bought options)? Should closed premium be netted against open premium?
   - Recommendation: Sum `premium` for all options where `buy_sell === "Sell"`. This represents total premium received from selling options. LEAPS premiums are costs (buy_sell === "Buy"), not income. Closed premium netting is a Phase 8 concern (unified options view).

2. **Per-Broker Breakdown Location**
   - What we know: PORT-10 requires "Per-broker P&L and allocation breakdown (donut chart + summary)". Context says "NOT on main dashboard -- drill-down only."
   - What's unclear: Where does the drill-down live? A separate page? A modal? An expandable section?
   - Recommendation: Implement as an expandable accordion section below the main holdings table, or as a tab within the dashboard. Since context explicitly says not on the main view, keep it behind a "View Broker Breakdown" action. The planner should decide the exact UI mechanism.

3. **Symbol Detail Page vs Sheet**
   - What we know: PORT-12 says "clicking a symbol row shows detail view with all transactions for that symbol." Context says "Clicking a symbol navigates to a dedicated symbol detail page."
   - What's unclear: Whether `/symbol/[symbol]` is the right pattern or if a sliding sheet/panel would be better UX.
   - Recommendation: Context explicitly says "dedicated symbol detail page," so use `/symbol/[symbol]`. This keeps the architecture simple and allows bookmarking/sharing symbol URLs. The Sheet component is already installed if the planner wants a quick-preview option.

4. **Platform/Broker Assignment per Holding**
   - What we know: Transactions have a `platform` field. A single symbol may be held across multiple brokers.
   - What's unclear: How to display broker in the holdings table when a symbol spans multiple brokers.
   - Recommendation: For the holdings table, show the broker with the most shares for that symbol. For per-broker breakdown (PORT-10), compute separate holdings per broker. This is a data assembly concern.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Data Table Guide](https://ui.shadcn.com/docs/components/radix/data-table) - TanStack Table integration, column definitions, sorting, filtering, visibility, pagination patterns
- [shadcn/ui Chart Docs](https://ui.shadcn.com/docs/components/radix/chart) - ChartContainer, ChartConfig, ChartTooltip integration with Recharts
- [shadcn/ui Card Docs](https://ui.shadcn.com/docs/components/radix/card) - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction
- [shadcn/ui GitHub - chart-pie-donut-text.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/charts/chart-pie-donut-text.tsx) - Complete donut chart with center text source code
- [TanStack Table v8 Sorting Guide](https://tanstack.com/table/v8/docs/guide/sorting) - SortingState, getSortedRowModel, toggleSorting API
- [TanStack Table v8 Column Visibility Guide](https://tanstack.com/table/v8/docs/guide/column-visibility) - VisibilityState, toggleVisibility API
- [TanStack Table v8 Column Filtering Guide](https://tanstack.com/table/v8/docs/guide/column-filtering) - ColumnFiltersState, getFilteredRowModel API
- [Next.js Data Fetching Patterns](https://nextjs.org/docs/app/getting-started/fetching-data) - Parallel data fetching with Promise.all in Server Components

### Secondary (MEDIUM confidence)
- [Recharts PieChart Label Issue #5985](https://github.com/recharts/recharts/issues/5985) - Label center position fixed in 3.1.0+ via PR #5987
- [Recharts PieChart viewBox Issue #6030](https://github.com/recharts/recharts/issues/6030) - viewBox handling fixed in 3.1.2+ via PR #6180
- [Next.js Server/Client Serialisation](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Props must be serialisable; functions, classes not allowed

### Tertiary (LOW confidence)
- Various community TanStack Table + localStorage persistence patterns - approach is straightforward but no official guide exists

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Table and Recharts are the established choices for this exact use case, versions verified on npm
- Architecture: HIGH - Server Component data assembly -> Client Component interactivity is the core Next.js App Router pattern, well-documented
- Existing codebase: HIGH - All existing modules read and verified; calculations engine, NocoDB client, and types are ready to consume
- Pitfalls: HIGH - Big.js serialisation boundary is the critical risk, verified through Next.js serialisation docs
- Code examples: HIGH - shadcn donut chart code verified from GitHub source; TanStack Table patterns from official docs and shadcn guide
- Chart stability: MEDIUM - Recharts 3.7.0 should have center label fixes from 3.1.2+, but should be verified during implementation

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days -- stable domain, libraries mature)
