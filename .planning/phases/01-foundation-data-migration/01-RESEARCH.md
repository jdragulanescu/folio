# Phase 1: Foundation & Data Migration - Research

**Researched:** 2026-02-06
**Domain:** NocoDB REST API client, Python data migration (numbers-parser), Next.js 16 dark-themed shell with sidebar
**Confidence:** HIGH

## Summary

Phase 1 establishes the data foundation and application shell. Three independent work streams converge: (1) a Python migration script that reads the Apple Numbers spreadsheet via numbers-parser and bulk-inserts all historical data into NocoDB via its REST API, (2) a typed TypeScript NocoDB REST client with server-only guard, auto-pagination, and parallel fetch support, and (3) a Next.js 16 application shell with dark theme, responsive sidebar navigation using shadcn/ui's built-in Sidebar component, and placeholder pages for all dashboard routes.

The research confirms all three work streams use well-documented, stable libraries. numbers-parser 4.18.x reads .numbers files with typed cell access (DateCell, NumberCell, EmptyCell). NocoDB's v2 REST API supports table creation via meta endpoints and bulk record insertion. The shadcn/ui Sidebar component provides a full responsive sidebar system out of the box, with automatic mobile sheet behavior and dark theme CSS variables. Tailwind v4's CSS-first configuration uses `@custom-variant dark` and `@theme` directives instead of a config file.

**Primary recommendation:** Build the three sub-plans in dependency order: (1) Next.js scaffolding + dark theme shell first (independent of data), (2) NocoDB TypeScript client (needs table IDs from NocoDB but not migration data), (3) Python migration script last (creates tables and populates data, after which table IDs can be configured in the dashboard's .env.local).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| numbers-parser | 4.18.1 | Parse Apple Numbers .numbers files | Only maintained Python library for .numbers format. Supports Numbers 10.0-14.4. Returns typed cells (DateCell, NumberCell, EmptyCell). |
| requests | 2.32.x | HTTP client for Python migration script | Standard Python HTTP library. Used for NocoDB REST API calls from migration script. |
| python-dotenv | 1.2.x | Load .env file in Python scripts | Standard pattern for environment variable management in Python scripts. |
| Next.js | 16.2.x | App framework (App Router, Server Components) | Latest stable. Turbopack default bundler. Server Components keep NocoDB token server-side. |
| Tailwind CSS | 4.1.x | Utility-first CSS | CSS-first config via `@theme` directive. Installed by create-next-app. |
| shadcn/ui | latest (CLI) | Component library + Sidebar | Built-in Sidebar component with responsive mobile behavior. Uses unified radix-ui package. new-york style default. |
| next-themes | 0.4.x | Dark/light theme management | Handles SSR flash prevention, localStorage persistence. Works with Tailwind v4 CSS variables. |
| server-only | latest | Prevent client-side import of server modules | Build-time error if NocoDB client is accidentally imported in a Client Component. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| radix-ui | latest | Headless UI primitives | Auto-installed by shadcn/ui. Unified package replaces individual @radix-ui/react-* packages. |
| tw-animate-css | 1.4.x | Animation utilities for Tailwind v4 | Replaces deprecated tailwindcss-animate. Added by `shadcn init`. |
| lucide-react | latest | Icon library | Used by shadcn/ui sidebar for navigation icons. Install alongside shadcn components. |
| snappy (system) | latest | Compression library for numbers-parser | numbers-parser requires python-snappy with system snappy library. On macOS: `brew install snappy`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| numbers-parser | Export .numbers to CSV manually | CSV loses cell type info (dates become strings). numbers-parser preserves types, avoids manual step. Stick with numbers-parser. |
| Custom NocoDB REST client | nocodb-sdk npm package | SDK is v0.265.x, tightly coupled to NocoDB internal versions, auto-generated types are generic. Custom client gives domain-specific types and no version lock. Stick with custom. |
| shadcn/ui Sidebar | Custom sidebar with Sheet | shadcn Sidebar handles responsive mobile/desktop, keyboard shortcuts, icon collapse, and theming. Building custom wastes time. Use shadcn Sidebar. |
| next-themes | Manual CSS variable toggling | next-themes handles SSR flash, system preference detection, localStorage. Not worth reimplementing for a dark-default app. |
| NocoDB v2 API | NocoDB v3 API | v3 adds embedded relations and unified record linking, but v2 is stable, well-documented, and sufficient for flat table CRUD. v3 is beta (introduced 2025.06.0). Stick with v2 for data records, use v2 meta for table creation. |

**Installation:**

```bash
# Python (in scripts/ directory)
python -m venv scripts/.venv
source scripts/.venv/bin/activate
pip install numbers-parser requests python-dotenv

# macOS system dependency for numbers-parser
brew install snappy

# Next.js dashboard
pnpm create next-app dashboard --typescript --tailwind --eslint --app --use-pnpm --yes
cd dashboard
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add sidebar button separator tooltip
pnpm install next-themes server-only
pnpm install lucide-react  # if not already added by shadcn
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
folio/
+-- scripts/
|   +-- requirements.txt            # numbers-parser, requests, python-dotenv
|   +-- migrate.py                  # One-time .numbers -> NocoDB migration
|   +-- utils/
|       +-- nocodb_client.py        # Python NocoDB REST wrapper
|
+-- dashboard/
|   +-- src/
|   |   +-- app/
|   |   |   +-- layout.tsx          # Root layout: SidebarProvider + ThemeProvider
|   |   |   +-- page.tsx            # Portfolio placeholder
|   |   |   +-- transactions/
|   |   |   |   +-- page.tsx        # Placeholder
|   |   |   +-- options/
|   |   |   |   +-- page.tsx        # Placeholder
|   |   |   +-- dividends/
|   |   |   |   +-- page.tsx        # Placeholder
|   |   |   +-- deposits/
|   |   |   |   +-- page.tsx        # Placeholder
|   |   |   +-- performance/
|   |   |       +-- page.tsx        # Placeholder
|   |   |
|   |   +-- lib/
|   |   |   +-- nocodb.ts           # NocoDB REST client (server-only)
|   |   |   +-- types.ts            # TypeScript interfaces for all NocoDB tables
|   |   |
|   |   +-- components/
|   |   |   +-- ui/                 # shadcn/ui primitives (auto-generated)
|   |   |   +-- layout/
|   |   |       +-- app-sidebar.tsx  # Sidebar with nav items
|   |   |       +-- theme-provider.tsx # next-themes wrapper (client)
|   |   |
|   |   +-- styles/
|   |       +-- globals.css         # Tailwind v4 @import, @theme, @custom-variant
|   |
|   +-- .env.local                  # NocoDB secrets (never committed)
|   +-- .env.example                # Template with placeholder table IDs
|
+-- .env.example                    # Root-level template for Python scripts
+-- stocks-v2.numbers               # Source data
```

### Pattern 1: NocoDB v2 REST API — Table Creation

**What:** Create NocoDB tables programmatically via the Meta API v2 endpoint.
**When to use:** Migration script, to create all 8 tables if they do not already exist.

```python
# Source: NocoDB API docs, verified via GitHub issue #9438
import requests

NOCODB_URL = "http://localhost:8080"
API_TOKEN = "your_xc_token"
BASE_ID = "your_base_id"

headers = {
    "xc-token": API_TOKEN,
    "Content-Type": "application/json"
}

# Create a table with columns
table_def = {
    "table_name": "symbols",
    "columns": [
        {"column_name": "symbol", "uidt": "SingleLineText"},
        {"column_name": "name", "uidt": "SingleLineText"},
        {"column_name": "sector", "uidt": "SingleSelect",
         "dtxp": "'Tech','Financial','Retail','Communication','Healthcare','Energy','Industrial','Real Estate','ETF','Crypto'"},
        {"column_name": "strategy", "uidt": "SingleSelect",
         "dtxp": "'Growth','Value','Risky'"},
        {"column_name": "current_price", "uidt": "Decimal"},
    ]
}

response = requests.post(
    f"{NOCODB_URL}/api/v2/meta/bases/{BASE_ID}/tables",
    headers=headers,
    json=table_def
)
table_info = response.json()
table_id = table_info["id"]  # Use this for subsequent record operations
```

**Gotcha (resolved):** NocoDB previously stripped spaces and underscores from column names during table creation. This was fixed in March 2025. Both `title` and `column_name` are required when adding columns after creation.

### Pattern 2: NocoDB v2 REST API — Bulk Record Insert

**What:** Insert multiple records in a single API call using an array payload.
**When to use:** Migration script, to insert 964 transactions in batches.

```python
# Source: NocoDB REST API docs
# POST /api/v2/tables/{tableId}/records with array body

records = [
    {"symbol": "AAPL", "name": "Apple Inc.", "price": 150.25, "shares": 10, "date": "2023-01-15", "platform": "IBKR", "type": "Buy"},
    {"symbol": "MSFT", "name": "Microsoft", "price": 280.50, "shares": 5, "date": "2023-01-20", "platform": "Trading 212", "type": "Buy"},
    # ... more records
]

# Batch in groups of 100 (safe limit for self-hosted)
BATCH_SIZE = 100
for i in range(0, len(records), BATCH_SIZE):
    batch = records[i:i + BATCH_SIZE]
    response = requests.post(
        f"{NOCODB_URL}/api/v2/tables/{table_id}/records",
        headers=headers,
        json=batch  # Array of record objects
    )
    # Response contains the inserted records with their IDs
    inserted = response.json()
```

**Key details:**
- Self-hosted NocoDB: max `limit` is 1000 (configurable via `DB_QUERY_LIMIT_MAX` env var), default is 25
- Cloud NocoDB caps at 100 rows per request (abuse prevention) -- irrelevant for self-hosted
- Bulk insert sends an array directly as the request body
- Response includes the actual inserted records (not just count), as of NocoDB 2025.06.0

### Pattern 3: NocoDB v2 REST API — Record Pagination

**What:** Fetch records with pagination using limit/offset parameters.
**When to use:** TypeScript client, to fetch all records from tables with >25 rows.

```typescript
// Source: NocoDB REST API docs
// GET /api/v2/tables/{tableId}/records?limit=200&offset=0

// Response format:
interface NocoDBResponse<T> {
  list: T[]
  pageInfo: {
    totalRows: number
    page: number
    pageSize: number
    isFirstPage: boolean
    isLastPage: boolean
  }
}
```

**Key details:**
- Default page size: 25 rows
- Max page size: 1000 (self-hosted, configurable via `DB_QUERY_LIMIT_MAX`)
- Use `pageInfo.isLastPage` to determine when to stop paginating
- Rate limit: 5 requests per second per user (returns HTTP 429 with 30-second wait)
- Filtering: `where=(symbol,eq,AAPL)` -- operators: eq, neq, gt, ge, lt, le, is, isnot, in, like, btw
- Sorting: `sort=-date` (prefix `-` for descending)
- Field selection: `fields=symbol,name,price`
- Logical operators: `~and`, `~or`, `~not` for combining conditions

### Pattern 4: numbers-parser — Reading Spreadsheet Data

**What:** Parse the Apple Numbers file to extract transactions, deposits, options, and sector mappings.
**When to use:** Migration script, to read all data from stocks-v2.numbers.

```python
# Source: numbers-parser GitHub README + PyPI docs
from numbers_parser import Document
from datetime import datetime

doc = Document("stocks-v2.numbers")

# Access sheets and tables by name
transactions_sheet = doc.sheets["Transactions"]
transactions_table = transactions_sheet.tables["Transactions"]
deposits_table = transactions_sheet.tables["Deposited"]
monthly_table = transactions_sheet.tables["Monthly Tracker"]

options_sheet = doc.sheets["Options"]
wheel_table = options_sheet.tables["Options Wheel Strategy"]
leaps_table = options_sheet.tables["Options LEAPS"]

portfolio_sheet = doc.sheets["Portfolio"]
sectors_table = portfolio_sheet.tables["Sectors-1"]

# Read all rows as raw values
rows = transactions_table.rows(values_only=True)
header = rows[0]  # First row is column headers
data_rows = rows[1:]  # Rest is data

# Or iterate with cell type checking
for row_idx in range(1, len(transactions_table.rows())):
    cell = transactions_table.cell(row_idx, 0)  # symbol column
    if isinstance(cell, EmptyCell):
        continue  # Skip empty/summary rows

    symbol = cell.value  # str
    date_cell = transactions_table.cell(row_idx, 5)
    if isinstance(date_cell, DateCell):
        date = date_cell.value  # datetime.datetime object
    else:
        date = None  # Handle text dates or empty cells
```

**Cell type mapping:**

| Cell Type | Python value type | Notes |
|-----------|-------------------|-------|
| NumberCell | float | All numeric values including prices, shares |
| TextCell | str | Symbol names, platform names |
| DateCell | datetime.datetime | Transaction dates, option expiry dates |
| EmptyCell | None | Empty cells -- skip or handle explicitly |
| ErrorCell | None | Formula errors in Numbers -- treat as empty |
| BoolCell | bool | Checkbox columns |
| MergedCell | None | Reference to merged region -- skip |

**Python version:** Requires 3.10+ (not 3.9+ as previously noted in project memory)

### Pattern 5: Tailwind v4 Dark Theme with next-themes

**What:** Configure dark-first theme using CSS-first Tailwind v4 config and next-themes provider.
**When to use:** Root layout and globals.css setup.

```css
/* globals.css */
/* Source: Tailwind CSS v4 dark mode docs + next-themes integration guides */
@import "tailwindcss";
@import "tw-animate-css";

/* Enable class-based dark mode for next-themes compatibility */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Finance dashboard color tokens */
  --color-gain: oklch(0.723 0.191 142.5);   /* Green for gains */
  --color-loss: oklch(0.637 0.237 25.3);     /* Red for losses */
}

/* shadcn/ui will add its own CSS variables here during init */
```

```tsx
// components/layout/theme-provider.tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

```tsx
// app/layout.tsx
import { ThemeProvider } from "@/components/layout/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SidebarProvider>
            <AppSidebar />
            <main className="flex-1">{children}</main>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Key details:**
- `@custom-variant dark (&:where(.dark, .dark *))` enables class-based dark mode (required for next-themes)
- `attribute="class"` in ThemeProvider makes next-themes add/remove `.dark` class on `<html>`
- `defaultTheme="dark"` ensures dark mode by default (finance dashboard convention)
- `suppressHydrationWarning` on `<html>` prevents hydration mismatch warnings from theme detection script
- `enableSystem={false}` because the app is dark-only by default
- `disableTransitionOnChange` prevents flash during initial load

### Pattern 6: shadcn/ui Sidebar with Navigation

**What:** Build the main navigation sidebar using shadcn/ui's Sidebar component system.
**When to use:** Root layout, providing navigation to all dashboard pages.

```tsx
// components/layout/app-sidebar.tsx
"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  BarChart3,
  ArrowLeftRight,
  Target,
  Banknote,
  PiggyBank,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { title: "Portfolio",     url: "/",              icon: BarChart3 },
  { title: "Transactions",  url: "/transactions",  icon: ArrowLeftRight },
  { title: "Options",       url: "/options",       icon: Target },
  { title: "Dividends",     url: "/dividends",     icon: Banknote },
  { title: "Deposits",      url: "/deposits",      icon: PiggyBank },
  { title: "Performance",   url: "/performance",   icon: TrendingUp },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Logo / app name */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* Last synced timestamp (Phase 2) */}
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Key details:**
- `collapsible="icon"` collapses to icon-only on desktop; on mobile, the sidebar slides in as a Sheet overlay automatically
- `SidebarTrigger` component provides the hamburger button -- place it in the main content area for mobile
- `useSidebar()` hook provides `isMobile`, `openMobile`, `toggleSidebar` for programmatic control
- Dark theme CSS variables are built in: `--sidebar-background`, `--sidebar-foreground`, etc.
- Keyboard shortcut: `Cmd+B` (Mac) / `Ctrl+B` (Windows) toggles sidebar by default
- shadcn Sidebar handles responsive behavior automatically -- no custom media queries needed

### Pattern 7: NocoDB TypeScript Client with server-only Guard

**What:** Typed server-side-only wrapper around NocoDB v2 REST API.
**When to use:** Every NocoDB interaction from the Next.js dashboard.

```typescript
// lib/nocodb.ts
// Source: NocoDB REST API docs + Next.js server-only pattern
import "server-only"

const BASE_URL = process.env.NOCODB_BASE_URL!
const API_TOKEN = process.env.NOCODB_API_TOKEN!

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

interface PageInfo {
  totalRows: number
  page: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
}

interface NocoDBListResponse<T> {
  list: T[]
  pageInfo: PageInfo
}

interface ListParams {
  where?: string
  sort?: string
  limit?: number
  offset?: number
  fields?: string[]
}

async function nocodbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      "xc-token": API_TOKEN,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",  // Always fresh data from NocoDB
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`NocoDB ${response.status}: ${text}`)
  }

  return response.json()
}

// Fetch a single page of records
export async function listRecords<T>(
  table: TableName,
  params?: ListParams
): Promise<NocoDBListResponse<T>> {
  const tableId = TABLE_IDS[table]
  const query = new URLSearchParams()

  if (params?.where) query.set("where", params.where)
  if (params?.sort) query.set("sort", params.sort)
  if (params?.limit) query.set("limit", String(params.limit))
  if (params?.offset) query.set("offset", String(params.offset))
  if (params?.fields) query.set("fields", params.fields.join(","))

  return nocodbFetch<NocoDBListResponse<T>>(
    `/api/v2/tables/${tableId}/records?${query}`
  )
}

// Fetch ALL records with auto-pagination
export async function getAllRecords<T>(
  table: TableName,
  params?: Omit<ListParams, "limit" | "offset">
): Promise<T[]> {
  const PAGE_SIZE = 200
  let offset = 0
  const all: T[] = []

  while (true) {
    const response = await listRecords<T>(table, {
      ...params,
      limit: PAGE_SIZE,
      offset,
    })
    all.push(...response.list)
    if (response.pageInfo.isLastPage) break
    offset += PAGE_SIZE
  }

  return all
}

// Fetch multiple tables in parallel
export async function fetchParallel<T extends readonly unknown[]>(
  ...fetchers: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  return Promise.all(fetchers.map((fn) => fn())) as Promise<T>
}
```

**Key details:**
- `import "server-only"` at top causes build-time error if imported from Client Component
- `cache: "no-store"` ensures fresh data on every request (NocoDB data changes via migration/sync)
- Table IDs stored in environment variables (resolved from NocoDB UI after table creation)
- `pageInfo.isLastPage` is the reliable pagination terminator
- Rate limit: 5 req/sec per user -- the parallel fetcher should respect this for tables with many pages
- The `fetchParallel` helper is syntactic sugar over `Promise.all` for type-safe multi-table fetching

### Anti-Patterns to Avoid

- **Using NocoDB v1 API endpoints:** The implementation plan references `/api/v2/` endpoints. Do NOT use v1 paths (`/api/v1/db/data/`). They exist in older NocoDB versions but v2 is the current stable API.
- **Creating tables via v3 meta API when v2 works:** The community discussion recommends v3 for table creation, but v2 meta endpoint (`POST /api/v2/meta/bases/{baseId}/tables`) works for self-hosted instances. Use v2 for consistency with the data endpoints. Only switch to v3 if v2 fails.
- **Using `tailwind.config.js` with Tailwind v4:** Tailwind v4 uses CSS-first configuration. There is no config file. Use `@theme` directive in globals.css.
- **Using `tailwindcss-animate` instead of `tw-animate-css`:** The old package is incompatible with Tailwind v4. shadcn/ui init installs tw-animate-css automatically.
- **Prefixing NocoDB env vars with `NEXT_PUBLIC_`:** This exposes the token to the client bundle. NocoDB credentials must NEVER be public.
- **Using `data-theme` attribute for dark mode:** shadcn/ui uses the `.dark` class selector for dark mode. Use `@custom-variant dark (&:where(.dark, .dark *))` and `attribute="class"` in ThemeProvider to match.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive sidebar with mobile hamburger | Custom sidebar with media queries and Sheet | shadcn/ui `Sidebar` component | Built-in responsive behavior, icon collapse mode, mobile Sheet overlay, keyboard shortcuts, dark theme CSS variables. Saves days of work. |
| Dark mode with SSR flash prevention | Manual class toggle + inline script | next-themes `ThemeProvider` | Handles SSR flash, system preference detection, localStorage persistence. 3 lines of config vs 50+ lines of custom code. |
| Server-side import guard | Check `typeof window` at runtime | `server-only` npm package | Build-time error is strictly better than runtime check. Catches mistakes during development, not in production. |
| Spreadsheet parsing | Export to CSV then parse | numbers-parser `Document` | Preserves cell types (dates as datetime, numbers as float). CSV loses type information, requiring manual date/number parsing. |
| NocoDB pagination | Manual offset tracking | Auto-pagination using `pageInfo.isLastPage` | `isLastPage` is a boolean flag in every response. No need to track total rows or calculate offsets manually. |
| Theme CSS variables | Custom CSS variable system | shadcn/ui init + `@theme` directive | shadcn init creates a complete CSS variable system for all colors (background, foreground, primary, muted, accent, destructive, sidebar variants). Adding custom tokens is additive. |

**Key insight:** Phase 1 is foundational infrastructure. Every hand-rolled solution here compounds into technical debt for Phases 2-8. Use the established tools.

## Common Pitfalls

### Pitfall 1: numbers-parser Requires System snappy Library

**What goes wrong:** `pip install numbers-parser` succeeds but import fails with `ImportError: snappy module not found` or similar compression error.
**Why it happens:** numbers-parser depends on python-snappy which needs the system snappy compression library (libsnappy). On macOS this requires `brew install snappy`. On Linux: `apt-get install libsnappy-dev`.
**How to avoid:** Install the system dependency BEFORE pip install. On macOS: `brew install snappy`. Add a comment in requirements.txt noting the system dependency.
**Warning signs:** Import error on first run of the migration script.

### Pitfall 2: EmptyCell and Summary Rows in .numbers File

**What goes wrong:** Migration script inserts garbage rows (spreadsheet totals, section headers) or crashes on None values from empty cells.
**Why it happens:** Apple Numbers files contain summary/total rows that are not real data records. numbers-parser returns EmptyCell (value=None) for empty cells and ErrorCell (value=None) for formula errors.
**How to avoid:** Filter every row: skip if the symbol cell is EmptyCell or if the value is None/empty string. Validate each row has required fields (symbol, date, amount) before creating a record object. Count actual data rows and compare to expected totals (964 transactions, 164 wheel, 36 LEAPS, 74 deposit months).
**Warning signs:** Record count after migration exceeds expected totals.

### Pitfall 3: Date Format Inconsistency from numbers-parser

**What goes wrong:** Some date cells return Python `datetime.datetime` objects, others may contain date-formatted strings, and NocoDB expects ISO format strings (YYYY-MM-DD).
**Why it happens:** Apple Numbers stores dates internally in various formats. numbers-parser normalises most to DateCell with datetime values, but edge cases exist (text cells formatted to look like dates).
**How to avoid:** Type-check every date cell. If DateCell, use `.value.strftime("%Y-%m-%d")`. If TextCell, parse with `datetime.strptime()` with multiple format attempts. If EmptyCell, use None (skip or default).
**Warning signs:** NocoDB rejects records with invalid date strings, or dates appear as 1970-01-01.

### Pitfall 4: NocoDB Table Creation Returns 409 if Table Exists

**What goes wrong:** Running the migration script a second time fails because tables already exist.
**Why it happens:** The POST endpoint for table creation does not have an "if not exists" option. Re-creating a table that already exists returns an error.
**How to avoid:** Before creating a table, list existing tables via `GET /api/v2/meta/bases/{baseId}/tables` and check if the table name already exists. If it does, use the existing table's ID. Implement an `ensure_table()` function that creates only if missing.
**Warning signs:** Migration script fails on second run with 409 Conflict or similar error.

### Pitfall 5: Platform Name Normalisation Must Be Applied Everywhere

**What goes wrong:** Some records have "Etoro" and others have "eToro", or "Hood" mixed with "Robinhood". NocoDB SingleSelect validation may reject unrecognised values.
**Why it happens:** The spreadsheet uses shorthand names ("Hood", "Etoro") that don't match the NocoDB SingleSelect options ("Robinhood", "eToro").
**How to avoid:** Apply platform name normalisation as the very first step of data processing, before any insertion. Use a mapping dict:
```python
PLATFORM_MAP = {
    "Etoro": "eToro",
    "Hood": "Robinhood",
    "Trading 212": "Trading 212",
    "IBKR": "IBKR",
    "Freetrade": "Freetrade",
    "Stake": "Stake",
}
```
**Warning signs:** NocoDB rejects records or creates extra SingleSelect options not in the defined list.

### Pitfall 6: shadcn/ui Sidebar Requires SidebarProvider at Root

**What goes wrong:** Sidebar component renders but has no state management -- toggle does nothing, mobile menu does not open.
**Why it happens:** The Sidebar component requires `SidebarProvider` as a parent wrapper to manage open/close state. Missing the provider means useSidebar() returns undefined context.
**How to avoid:** Wrap the entire layout in `<SidebarProvider>` in the root layout.tsx. The SidebarProvider must be inside the ThemeProvider but wrapping both the Sidebar and the main content area.
**Warning signs:** Console error about missing context, or sidebar toggle button does nothing.

### Pitfall 7: Hydration Mismatch with Dark Theme

**What goes wrong:** Next.js warns about hydration mismatch: server renders without `.dark` class but client adds it immediately.
**Why it happens:** next-themes injects a script to set the theme class before hydration, but React still detects the mismatch.
**How to avoid:** Add `suppressHydrationWarning` to the `<html>` element in root layout.tsx. This is the official next-themes recommendation and is safe because the script runs synchronously before paint.
**Warning signs:** Console warning about "Extra attributes from the server: class".

### Pitfall 8: Broker Active/Archived Distinction in Data Layer

**What goes wrong:** The requirement DATA-12 says brokers must be marked active or archived, but there is no `is_active` field in any table schema.
**Why it happens:** The broker distinction is a data-layer concept that needs explicit representation.
**How to avoid:** Store broker status in the `settings` table as a JSON value, or define it as a constant in the TypeScript types since the broker list is fixed:
```typescript
export const BROKERS = {
  active: ["IBKR", "Trading 212", "Robinhood"] as const,
  archived: ["Freetrade", "Stake", "eToro"] as const,
}
export type Broker = typeof BROKERS.active[number] | typeof BROKERS.archived[number]
```
This is simpler than a database field because the broker list does not change at runtime.
**Warning signs:** No way to distinguish active from archived brokers in the UI.

## Code Examples

### Complete Migration Script Pattern

```python
# Source: numbers-parser docs + NocoDB REST API docs
# scripts/migrate.py

import os
import sys
from datetime import datetime
from numbers_parser import Document
from utils.nocodb_client import NocoDBClient
from dotenv import load_dotenv

load_dotenv()

PLATFORM_MAP = {
    "Etoro": "eToro",
    "Hood": "Robinhood",
    "Trading 212": "Trading 212",
    "IBKR": "IBKR",
    "Freetrade": "Freetrade",
    "Stake": "Stake",
}

ACTIVE_BROKERS = {"IBKR", "Trading 212", "Robinhood"}
ARCHIVED_BROKERS = {"Freetrade", "Stake", "eToro"}

def normalise_platform(raw: str) -> str:
    """Normalise platform names from spreadsheet to NocoDB enum values."""
    if raw is None:
        return None
    stripped = str(raw).strip()
    return PLATFORM_MAP.get(stripped, stripped)

def format_date(value) -> str | None:
    """Convert numbers-parser date to ISO format string."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None

def migrate():
    doc = Document("stocks-v2.numbers")
    client = NocoDBClient(
        base_url=os.environ["NOCODB_BASE_URL"],
        api_token=os.environ["NOCODB_API_TOKEN"],
        base_id=os.environ["NOCODB_BASE_ID"],
    )

    # Step 1: Ensure tables exist (create if missing)
    table_ids = client.ensure_tables(TABLE_SCHEMAS)

    # Step 2: Read transactions
    tx_table = doc.sheets["Transactions"].tables["Transactions"]
    tx_rows = tx_table.rows(values_only=True)
    tx_header = tx_rows[0]
    transactions = []
    for row in tx_rows[1:]:
        if row[0] is None or str(row[0]).strip() == "":
            continue  # Skip empty/summary rows
        shares = float(row[3]) if row[3] is not None else 0
        transactions.append({
            "symbol": str(row[0]).strip().upper(),
            "name": str(row[1]).strip() if row[1] else "",
            "price": float(row[2]) if row[2] is not None else 0,
            "shares": abs(shares),
            "type": "Sell" if shares < 0 else "Buy",
            "eps": float(row[4]) if row[4] is not None else 0,
            "date": format_date(row[5]),
            "platform": normalise_platform(row[6]),
            "amount": float(row[7]) if row[7] is not None else 0,
        })

    # Step 3: Bulk insert in batches
    client.bulk_insert(table_ids["transactions"], transactions, batch_size=100)

    # Step 4: Print summary
    print(f"Transactions: {len(transactions)} (expected: 964)")
    # ... repeat for other tables

if __name__ == "__main__":
    migrate()
```

### Python NocoDB Client Wrapper

```python
# scripts/utils/nocodb_client.py
import requests
from typing import Any

class NocoDBClient:
    def __init__(self, base_url: str, api_token: str, base_id: str):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.base_id = base_id
        self.headers = {
            "xc-token": api_token,
            "Content-Type": "application/json",
        }

    def list_tables(self) -> list[dict]:
        """List all tables in the base."""
        resp = requests.get(
            f"{self.base_url}/api/v2/meta/bases/{self.base_id}/tables",
            headers=self.headers,
        )
        resp.raise_for_status()
        return resp.json().get("list", [])

    def create_table(self, table_def: dict) -> dict:
        """Create a table with columns."""
        resp = requests.post(
            f"{self.base_url}/api/v2/meta/bases/{self.base_id}/tables",
            headers=self.headers,
            json=table_def,
        )
        resp.raise_for_status()
        return resp.json()

    def ensure_tables(self, schemas: dict[str, dict]) -> dict[str, str]:
        """Create tables if they don't exist. Return name -> table_id mapping."""
        existing = {t["title"]: t["id"] for t in self.list_tables()}
        table_ids = {}
        for name, schema in schemas.items():
            if name in existing:
                table_ids[name] = existing[name]
                print(f"  Table '{name}' already exists (id: {existing[name]})")
            else:
                result = self.create_table(schema)
                table_ids[name] = result["id"]
                print(f"  Created table '{name}' (id: {result['id']})")
        return table_ids

    def bulk_insert(self, table_id: str, records: list[dict], batch_size: int = 100) -> int:
        """Insert records in batches. Returns total inserted count."""
        total = 0
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            resp = requests.post(
                f"{self.base_url}/api/v2/tables/{table_id}/records",
                headers=self.headers,
                json=batch,
            )
            resp.raise_for_status()
            total += len(batch)
        return total

    def get_records(self, table_id: str, params: dict | None = None) -> dict:
        """Get a page of records with optional filtering/sorting/pagination."""
        resp = requests.get(
            f"{self.base_url}/api/v2/tables/{table_id}/records",
            headers=self.headers,
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()
```

### Deposit Unpivoting Pattern

```python
# Source: Project requirements DATA-03
# Each spreadsheet row has: Month, Total, IBKR, Trading 212, Freetrade, Stake, Etoro, Hood
# Unpivot: create one deposit record per platform that has a non-zero value

DEPOSIT_PLATFORMS = ["IBKR", "Trading 212", "Freetrade", "Stake", "Etoro", "Hood"]
DEPOSIT_COL_MAP = {
    "IBKR": 2,
    "Trading 212": 3,
    "Freetrade": 4,
    "Stake": 5,
    "Etoro": 6,
    "Hood": 7,
}

deposits = []
deposit_table = doc.sheets["Transactions"].tables["Deposited"]
dep_rows = deposit_table.rows(values_only=True)

for row in dep_rows[1:]:  # Skip header
    month = format_date(row[0])
    if month is None:
        continue
    for platform_raw, col_idx in DEPOSIT_COL_MAP.items():
        amount = row[col_idx]
        if amount is not None and float(amount) != 0:
            deposits.append({
                "month": month,
                "amount": float(amount),
                "platform": normalise_platform(platform_raw),
            })

print(f"Deposits: {len(deposits)} records from {len(dep_rows)-1} months")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | CSS-first `@theme` directive | Tailwind v4 (Jan 2025) | No config file needed. Theme tokens in globals.css. |
| `tailwindcss-animate` | `tw-animate-css` | Tailwind v4 (Jan 2025) | Old package incompatible with v4. shadcn init installs correct version. |
| Individual `@radix-ui/react-*` packages | Unified `radix-ui` package | Feb 2026 | Single package for all primitives. shadcn CLI handles this. |
| NocoDB v1 API (`/api/v1/db/data/`) | NocoDB v2 API (`/api/v2/tables/{id}/records`) | NocoDB ~0.200+ | v2 is cleaner URL structure, better pagination (pageInfo), consistent auth. |
| NocoDB Meta API for table creation (unreliable in v2) | NocoDB v2 meta works post-March 2025 fix | NocoDB March 2025 | Column name special character bug fixed. Table creation via v2 meta is reliable. |
| `create-next-app` with manual Tailwind setup | `create-next-app --tailwind` auto-installs v4 | Next.js 15+ | Tailwind v4 installed automatically. No manual postcss/autoprefixer config. |
| numbers-parser 3.x (read-only) | numbers-parser 4.18.x (read+write) | 2024 | API unchanged for reading. Now requires Python 3.10+ (was 3.9+). |

**Deprecated/outdated:**
- `tailwindcss-animate`: Does not work with Tailwind v4. Use `tw-animate-css`.
- `nocodb-sdk` npm package (v0.265.x): Auto-generated, version-locked to NocoDB internals. Build custom client.
- NocoDB v1 API paths: Still work but v2 is the current standard. Do not mix v1 and v2.

## Open Questions

1. **NocoDB v2 meta API table creation on self-hosted: fully reliable?**
   - What we know: The community recommends v3 for table creation, but v2 endpoint exists and the column name bug was fixed in March 2025. Self-hosted users have reported success with v2.
   - What's unclear: Whether there are edge cases with specific uidt values (e.g., SingleSelect with dtxp) that fail on v2 meta API.
   - Recommendation: Use v2 for table creation. If it fails for specific column types, fall back to creating the table with basic columns via API, then add complex columns (SingleSelect with options) via the NocoDB UI. The migration script should handle this gracefully.

2. **Exact bulk insert batch size limit for self-hosted NocoDB**
   - What we know: Cloud NocoDB caps at 100 rows. Self-hosted is configurable via `DB_QUERY_LIMIT_MAX` (default 1000). The implementation plan says ~100 per call.
   - What's unclear: Whether bulk INSERT has a different limit than GET pagination, or if the 1000 limit applies to both.
   - Recommendation: Use 100 as batch size for safety. This matches the cloud limit and keeps request payloads small. 964 transactions / 100 = 10 API calls, which is negligible.

3. **NocoDB table ID format and discovery after programmatic creation**
   - What we know: Table IDs are alphanumeric strings (e.g., `m3hk92j5`). The create table response includes the `id` field.
   - What's unclear: Whether the migration script should output table IDs for manual .env.local configuration, or auto-configure them.
   - Recommendation: Migration script should print all table IDs in `.env.local` format after creation, so the user can copy-paste them into the dashboard configuration.

4. **Apple Numbers version of stocks-v2.numbers**
   - What we know: numbers-parser supports Numbers 10.0-14.4 and Creator Studio up to 15.1.
   - What's unclear: Which version created the actual file.
   - Recommendation: The migration script should attempt to open the file first and report the detected Numbers version. If unsupported, export to CSV as fallback. Given the range covered (10.0-14.4), this is unlikely to be an issue.

## Sources

### Primary (HIGH confidence)
- [numbers-parser GitHub README](https://github.com/masaccio/numbers-parser/blob/main/README.md) -- API documentation, cell types, date handling, sheet/table access
- [numbers-parser PyPI](https://pypi.org/project/numbers-parser/) -- v4.18.1, Python 3.10+ requirement, supported Numbers versions
- [Tailwind CSS v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- @custom-variant directive, class-based dark mode, manual toggle setup
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) -- server-only package usage, build-time import guard
- [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation) -- create-next-app defaults for Next.js 16, Turbopack, project structure
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/radix/sidebar) -- Full component API: SidebarProvider, Sidebar, SidebarMenu, SidebarMenuButton, useSidebar hook, responsive mobile behavior, CSS theming variables
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) -- CLI init process, components.json, globals.css setup

### Secondary (MEDIUM confidence)
- [NocoDB REST API Overview](https://nocodb.com/docs/product-docs/developer-resources/rest-apis) -- v2 endpoints, pagination (limit default 25, max 1000), rate limit (5 req/sec), where/sort/fields params
- [NocoDB GitHub Issue #7761](https://github.com/nocodb/nocodb/issues/7761) -- Self-hosted vs cloud row limits, DB_QUERY_LIMIT_MAX env var
- [NocoDB GitHub Issue #9438](https://github.com/nocodb/nocodb/issues/9438) -- Table creation via v2 meta API, column name special character fix (March 2025)
- [NocoDB Community: Create tables via meta API v2](https://community.nocodb.com/t/can-we-create-tables-through-meta-api-v2/2064) -- Official recommendation to use v3 for meta, but v2 works for self-hosted
- [NocoDB Changelog 2025.06.0](https://nocodb.com/docs/changelog/2025.06.0) -- v3 API introduction, v2 still supported, bulk insert returns actual records
- [NocoDB GitHub Issue #11740](https://github.com/nocodb/nocodb/issues/11740) -- v2 records endpoint format confirmation
- [Next.js + Tailwind v4 Dark Mode Guide](https://dev.to/khanrabiul/nextjs-tailwindcss-v4-how-to-add-darklight-theme-with-next-themes-3c6l) -- @custom-variant dark setup, ThemeProvider config, suppressHydrationWarning
- [DeepWiki: NocoDB Tables and Columns](https://deepwiki.com/nocodb/nocodb-1/3.4-tables-and-columns) -- uidt values, column types, table creation internals

### Tertiary (LOW confidence)
- [NocoDB RecordQueryResult docs](https://nocodb.com/docs/scripts/api-reference/record-query-result) -- Scripts API response format (confirms pageInfo structure but for Scripts, not REST)
- [Builder.io: Server-only Code in Next.js](https://www.builder.io/blog/server-only-next-app-router) -- server-only package explanation (blog, not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified via official docs and PyPI/npm. Version numbers confirmed.
- Architecture: HIGH -- NocoDB v2 REST API patterns verified via official docs and GitHub issues. Next.js App Router patterns from official docs.
- Migration patterns: HIGH -- numbers-parser API verified via GitHub README. NocoDB table creation and bulk insert verified via GitHub issues and community.
- Dark theme setup: HIGH -- Tailwind v4 dark mode verified via official docs. next-themes integration verified via multiple community guides.
- Sidebar component: HIGH -- shadcn/ui Sidebar verified via official component docs with complete API reference.
- Pitfalls: MEDIUM -- NocoDB rate limits and batch size verified. numbers-parser cell types verified. Platform normalisation from project requirements. Some NocoDB table creation edge cases unresolved (marked in Open Questions).

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (30 days -- stable libraries, unlikely to have breaking changes)
