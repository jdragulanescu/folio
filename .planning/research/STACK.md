# Stack Research

**Domain:** Personal investment tracking dashboard (Next.js + NocoDB + FMP API)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.x | App framework (App Router, Server Components, Route Handlers) | Latest stable. Built on React 19. Cache Components with explicit `use cache` replace implicit caching. Turbopack stable as default bundler. Server Components keep API keys server-side -- critical for this project. |
| React | 19.x | UI library (bundled with Next.js 16) | Concurrent rendering, Suspense, Server Functions. Installed automatically with Next.js 16. |
| TypeScript | 5.7.x | Type safety | Bundled with `create-next-app`. Strict mode recommended for financial calculations where type errors cost money. |
| Tailwind CSS v4 | 4.1.x | Utility-first CSS | CSS-first configuration (no `tailwind.config.js`). 5x faster full builds. `@theme` directive for dark mode CSS variables. Auto-detects template files. Installed via `create-next-app`. |
| shadcn/ui | latest (CLI) | Component library (Card, Table, Badge, Button, Tabs, Dialog, Select) | Not a package -- copies source into your project. Full Tailwind v4 + React 19 support. Uses unified `radix-ui` package (Feb 2026). new-york style is the default. |
| Recharts | 3.7.x | Charts (pie, line, bar, area) | Most popular React charting lib. Declarative API. ResponsiveContainer for layout. Requires `"use client"` directive (D3 needs DOM). |
| NocoDB | 0.301.x (self-hosted) | Database + REST API backend | Already running. v2 API endpoints: `/api/v2/tables/{tableId}/records`. Auth via `xc-token` header. No need for a separate backend server. |
| FMP API | v3 | Live stock pricing | Free tier with 500MB trailing 30-day bandwidth. Batch quote endpoint: `/api/v3/quote/{SYMBOLS}` (comma-separated, max ~50 per call). ~3 API calls per sync for 120 symbols. |
| Python | 3.12+ | Data migration + price sync scripts | numbers-parser requires 3.9+. Use 3.12+ for modern typing and performance. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| radix-ui | latest | Headless UI primitives (installed by shadcn/ui) | Automatically added when shadcn components are installed. Unified package replaces individual `@radix-ui/react-*` packages. |
| tw-animate-css | 1.4.x | Animation utilities for Tailwind v4 | Replaces deprecated `tailwindcss-animate`. Import `@import "tw-animate-css"` in globals.css. Added by shadcn init. |
| next-themes | 0.4.x | Dark/light theme toggling | Wrap root layout in `<ThemeProvider>`. Set `defaultTheme="dark"`. Works with Tailwind v4 CSS variables. |
| zod | 4.3.x | Schema validation (forms, API routes) | Validate all API route inputs. Type-infer form schemas. Use with `@hookform/resolvers` for form integration. |
| react-hook-form | 7.71.x | Form state management | Minimal re-renders. Pairs with zod via `@hookform/resolvers`. Use for transaction, option, deposit forms. |
| @hookform/resolvers | 5.2.x | Bridge between react-hook-form and zod | `zodResolver(schema)` passed to `useForm()`. |
| numbers-parser | 4.16.x | Parse Apple Numbers .numbers files (Python) | One-time migration script only. Reads spreadsheet programmatically. Supports Numbers 10.3+. |
| requests | 2.32.x | HTTP client for Python scripts | FMP API calls + NocoDB REST calls from Python migration/sync scripts. |
| python-dotenv | 1.2.x | Environment variable loading (Python) | Load `.env` file in migration and sync scripts. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Faster installs, stricter dependency resolution. Used by shadcn docs. Config via `pnpm dlx shadcn@latest init`. |
| Turbopack | Dev bundler (built into Next.js 16) | Default in Next.js 16. No configuration needed. Replaces Webpack for dev. |
| ESLint | Linting | Bundled with `create-next-app`. Next.js config included. |
| Prettier | Code formatting | Optional but recommended. Add `prettier-plugin-tailwindcss` for class sorting. |

## Installation

### Dashboard (Next.js)

```bash
# Create project
pnpm create next-app dashboard --typescript --tailwind --eslint --app --use-pnpm

# Initialize shadcn/ui (inside dashboard/)
pnpm dlx shadcn@latest init

# Add shadcn components needed for the dashboard
pnpm dlx shadcn@latest add card table badge button tabs select dialog input label separator dropdown-menu sheet tooltip popover

# Form libraries
pnpm install zod react-hook-form @hookform/resolvers

# Theme support
pnpm install next-themes

# Charts
pnpm install recharts
```

### Python Scripts

```bash
# Create virtual environment
python -m venv scripts/.venv
source scripts/.venv/bin/activate

# Install dependencies
pip install numbers-parser requests python-dotenv
```

### requirements.txt (scripts/)

```
numbers-parser>=4.16.0
requests>=2.32.0
python-dotenv>=1.2.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Recharts 3 | Tremor 2 / shadcn-charts | Tremor provides pre-built dashboard chart components with shadcn styling, but Recharts offers more customisation for financial charts (candlestick-like formatting, multi-axis). Stick with Recharts for full control. |
| Recharts 3 | Nivo | Nivo has more chart types (heatmaps, calendars) but heavier bundle and less React-idiomatic API. Not needed for this dashboard. |
| Recharts 3 | Visx (Airbnb) | Visx is lower-level (closer to D3). More powerful but much more work. Overkill for standard dashboard charts. |
| Custom NocoDB REST client | nocodb-sdk (npm) | The SDK (v0.265.x) is tightly coupled to NocoDB internal versioning and auto-generated from Swagger. A thin custom fetch wrapper gives more control, better typing for your specific tables, and no version-lock risk. Use the SDK only if you need every NocoDB feature. |
| pnpm | npm / yarn | npm works fine. pnpm recommended because shadcn docs default to it, faster installs, and stricter hoisting avoids phantom dependency issues. |
| zod 4 | Valibot | Valibot is smaller (tree-shakes better) but zod has deeper ecosystem integration: `@hookform/resolvers` native support, shadcn form examples use zod, better docs. Stick with zod. |
| react-hook-form | Conform | Conform is built for Server Actions and progressive enhancement. react-hook-form is more mature, better documented, and fine for this single-user app where JavaScript is always available. |
| next-themes | Manual CSS variables | next-themes handles SSR flash prevention, system preference detection, and localStorage persistence. Not worth reimplementing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| tailwindcss-animate | Deprecated for Tailwind v4. Will not work with CSS-first config. | tw-animate-css (1.4.x) |
| Individual @radix-ui/react-* packages | shadcn/ui new-york style migrated to unified `radix-ui` package (Feb 2026). Individual packages still work but will diverge. | `radix-ui` unified package (auto-installed by shadcn) |
| tailwind.config.js | Tailwind v4 uses CSS-first configuration via `@theme` directive. Config file is unnecessary. | `@theme` block in globals.css |
| Chart.js / react-chartjs-2 | Canvas-based, not React-native. Harder to style with Tailwind. Less composable. | Recharts (SVG-based, React components) |
| Prisma / Drizzle / any ORM | No direct database access. NocoDB IS the database layer. Adding an ORM would mean bypassing NocoDB entirely. | Custom NocoDB REST API client |
| Express / Fastify / custom backend | Unnecessary. Next.js Route Handlers serve as API endpoints. NocoDB provides the data layer. | Next.js API Route Handlers (`app/api/`) |
| NextAuth / Auth.js | Single-user personal tool. No authentication needed. Adding auth is complexity for zero value. | Nothing -- skip auth entirely |
| SWR / React Query for data fetching | Server Components fetch data on the server. Client-side data fetching libraries add complexity for a read-heavy dashboard. | Server Components with `fetch()` + `revalidatePath()` for mutations |
| nocodb-sdk (as primary client) | Auto-generated, tightly coupled to NocoDB versions, bundle includes features you don't need, types are generic not domain-specific. | Thin typed wrapper around `fetch()` using NocoDB v2 REST endpoints |

## Architecture Patterns for This Stack

**Server Components for data fetching:**
- Pages and layouts are Server Components by default
- Fetch from NocoDB REST API server-side (keeps `xc-token` hidden)
- Use `async/await` directly in component bodies
- Cache with `use cache` directive where appropriate

**Client Components for interactivity:**
- Charts (Recharts requires DOM/`"use client"`)
- Forms (react-hook-form state)
- Sortable/filterable tables (client-side interaction)
- Theme toggling

**Pattern: Server Component fetches, Client Component renders:**
```
// page.tsx (Server Component) -- fetches data
async function PortfolioPage() {
  const holdings = await getHoldings()  // server-side NocoDB call
  return <HoldingsTable holdings={holdings} />  // passes to client
}

// HoldingsTable.tsx (Client Component) -- renders interactively
"use client"
function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  // sorting, filtering, etc.
}
```

**NocoDB REST client pattern:**
- Single `lib/nocodb.ts` file with typed functions
- All functions server-side only (use `"server-only"` import guard)
- Functions: `getRecords()`, `getRecord()`, `createRecord()`, `updateRecord()`, `deleteRecord()`
- Table IDs stored as environment variables or fetched once and cached
- Error handling: connection errors surface as error boundaries

**API Route pattern for mutations:**
- `POST /api/sync` -- trigger FMP price refresh
- `POST /api/transactions` -- add transaction (validate with zod, write to NocoDB)
- `POST /api/options` -- add option trade
- `PATCH /api/options/[id]` -- close/update option
- `POST /api/deposits` -- add deposit
- All routes validate with zod, call NocoDB, then `revalidatePath()` to refresh Server Components

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2.x | React 19.x | React 19 is a peer dependency. Installed automatically. |
| Next.js 16.2.x | Tailwind CSS 4.1.x | create-next-app installs Tailwind v4 by default. |
| shadcn/ui (latest) | Tailwind v4 + React 19 | Full support since Feb 2025. Uses unified `radix-ui` package since Feb 2026. |
| Recharts 3.7.x | React 19.x | Works. May need `react-is` override if dependency conflict surfaces (check on install). |
| zod 4.3.x | @hookform/resolvers 5.2.x | Native support via `zodResolver`. |
| react-hook-form 7.71.x | React 19.x | Fully compatible. |
| next-themes 0.4.x | Next.js 16 App Router | Works with Server Components. `ThemeProvider` must be in a Client Component wrapper. |
| numbers-parser 4.16.x | Python 3.9+ | Tested against Numbers versions 10.3-14.1. |
| NocoDB 0.301.x | API v2 endpoints | v2 endpoints stable. v3 available but v2 is what the implementation plan specifies. |

## FMP API Usage Notes

| Concern | Detail |
|---------|--------|
| Free tier limit | 500MB trailing 30-day bandwidth (not call-count based) |
| Batch quote endpoint | `GET /api/v3/quote/{AAPL,MSFT,...}` -- comma-separated, ~50 symbols max per call |
| Calls per sync | ~3 (120 symbols / 50 per batch) |
| Daily budget | Even 5 syncs/day = 15 calls, well within bandwidth limit |
| Server-side only | Never expose FMP API key to client. All calls via Next.js Route Handlers or Python scripts. |
| Rate limiting | Handle 429 responses with exponential backoff in sync script |
| Missing symbols | Some tickers may not exist in FMP (delisted, OTC). Log and skip gracefully. |

## NocoDB API Usage Notes

| Concern | Detail |
|---------|--------|
| API version | v2 (`/api/v2/tables/{tableId}/records`) |
| Auth header | `xc-token: {NOCODB_API_TOKEN}` |
| Pagination | Default 25 rows. Use `limit=100&offset=0` for larger fetches. Max ~1000 per call. |
| Bulk insert | POST array of records. Batch in groups of ~100 for reliability. |
| Filtering | `where=(symbol,eq,AAPL)` query parameter syntax |
| Sorting | `sort=-date` (prefix `-` for descending) |
| Table IDs | Alphanumeric strings prefixed with `m`. Retrieve via meta API or from NocoDB UI. |
| Error handling | 401 (bad token), 404 (wrong table ID), 422 (validation). Surface clearly in UI. |

## Sources

- [Next.js 16.1 blog post](https://nextjs.org/blog/next-16-1) -- Turbopack stable, Cache Components -- HIGH confidence
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) -- React 19 foundation, routing overhaul -- HIGH confidence
- [shadcn/ui changelog: Feb 2026 Radix unification](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) -- Unified radix-ui package -- HIGH confidence
- [shadcn/ui changelog: Feb 2025 Tailwind v4](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) -- tw-animate-css, OKLCH colors, new-york default -- HIGH confidence
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) -- CLI setup steps -- HIGH confidence
- [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-first config, performance, @theme -- HIGH confidence
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0, React 19 compatibility -- HIGH confidence
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- Breaking changes from v2 -- MEDIUM confidence
- [NocoDB GitHub releases](https://github.com/nocodb/nocodb/releases) -- v0.301.2, Jan 2026 -- HIGH confidence
- [NocoDB API v2 docs](https://nocodb.com/apis/v2/data) -- Endpoint format, auth, query params -- HIGH confidence
- [NocoDB changelog 2025.06.0](https://nocodb.com/docs/changelog/2025.06.0) -- v3 API introduction -- MEDIUM confidence
- [FMP API docs](https://site.financialmodelingprep.com/developer/docs) -- Free tier, batch quote endpoint -- MEDIUM confidence
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.5 -- HIGH confidence
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) -- v7.71.1 -- HIGH confidence
- [numbers-parser PyPI](https://pypi.org/project/numbers-parser/) -- v4.16.3, Python 3.9+ -- HIGH confidence
- [requests PyPI](https://pypi.org/project/requests/) -- v2.32.5, Python 3.9+ -- HIGH confidence
- [next-themes npm](https://www.npmjs.com/package/next-themes) -- v0.4.6 -- HIGH confidence
- [nocodb-sdk npm](https://www.npmjs.com/package/nocodb-sdk) -- v0.265.1, evaluated and rejected for this project -- MEDIUM confidence

---
*Stack research for: Personal investment tracking dashboard (Folio)*
*Researched: 2026-02-06*
