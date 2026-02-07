---
phase: quick-005
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/__tests__/format.test.ts
  - src/lib/__tests__/sync.test.ts
  - src/lib/__tests__/portfolio.test.ts
  - src/lib/sync.ts
  - src/lib/portfolio.ts
autonomous: true

must_haves:
  truths:
    - "All exported format.ts functions have test coverage"
    - "Pure helper functions in sync.ts are tested in isolation"
    - "getPrimaryPlatform logic in portfolio.ts is tested"
    - "All tests pass with pnpm test"
  artifacts:
    - path: "src/lib/__tests__/format.test.ts"
      provides: "Tests for formatPercent, formatNumber, formatDate, formatDateShort, daysToExpiry, pnlClassName"
      contains: "formatPercent|formatNumber|formatDate|formatDateShort|daysToExpiry|pnlClassName"
    - path: "src/lib/__tests__/sync.test.ts"
      provides: "Tests for mergeFundamentals, mapSector, isRateLimitError"
      contains: "mergeFundamentals|mapSector|isRateLimitError"
    - path: "src/lib/__tests__/portfolio.test.ts"
      provides: "Tests for getPrimaryPlatform"
      contains: "getPrimaryPlatform"
  key_links:
    - from: "src/lib/__tests__/sync.test.ts"
      to: "src/lib/sync.ts"
      via: "import with server-only mock"
      pattern: "vi.mock.*server-only"
    - from: "src/lib/__tests__/portfolio.test.ts"
      to: "src/lib/portfolio.ts"
      via: "import with server-only mock"
      pattern: "vi.mock.*server-only"
---

<objective>
Add comprehensive unit tests for all untested pure functions across format.ts, sync.ts, and portfolio.ts.

Purpose: The project has 120 tests covering calculations, basic format functions, and options-shared. Six format.ts functions, three sync.ts helpers, and one portfolio.ts helper have zero test coverage. This plan closes those gaps.

Output: Three test files with full coverage of all testable pure logic. Existing tests remain green.
</objective>

<execution_context>
@/Users/skylight/.claude/sky/workflows/execute-plan.md
@/Users/skylight/.claude/sky/templates/summary.md
</execution_context>

<context>
@src/lib/format.ts
@src/lib/__tests__/format.test.ts
@src/lib/sync.ts
@src/lib/portfolio.ts
@src/lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Complete format.test.ts with all missing function tests</name>
  <files>src/lib/__tests__/format.test.ts</files>
  <action>
Add test suites for the 6 untested functions in format.ts to the existing format.test.ts file. Append after the existing `formatShares` describe block. Do NOT modify existing tests.

**formatPercent(value: number): string**
- Positive value: `formatPercent(15.23)` returns `"+15.23%"`
- Negative value: `formatPercent(-3.45)` returns `"-3.45%"`
- Zero: `formatPercent(0)` returns `"0.00%"` (no sign)
- Large value: `formatPercent(100)` returns `"+100.00%"`
- Tiny fractional: `formatPercent(0.001)` returns `"+0.00%"` (rounds to 2dp)

**formatNumber(value: number, dp?: number): string**
- Default 2dp: `formatNumber(1234.5)` contains `"1,234.50"`
- Custom dp=0: `formatNumber(1234.5, 0)` contains `"1,235"` (rounded)
- Custom dp=3: `formatNumber(0.12345, 3)` contains `"0.123"`
- Zero: `formatNumber(0)` contains `"0.00"`
- Large number: `formatNumber(1000000)` contains `"1,000,000.00"`

**formatDate(dateStr: string): string**
- Standard ISO: `formatDate("2025-01-15")` returns `"15 Jan 2025"`
- Full ISO with time: `formatDate("2025-06-30T14:30:00.000Z")` returns `"30 Jun 2025"`
- December edge: `formatDate("2024-12-31")` returns `"31 Dec 2024"`

**formatDateShort(dateStr: string): string**
- Standard date: `formatDateShort("2025-01-15")` returns `"15/01/25"`
- Full ISO: `formatDateShort("2024-06-01T00:00:00.000Z")` returns `"01/06/24"`

**daysToExpiry(expirationDate: string, status?: string): number**
- Non-open status returns 0: `daysToExpiry("2099-01-01", "Closed")` returns `0`
- Non-open status "Expired": `daysToExpiry("2099-01-01", "Expired")` returns `0`
- Open status returns positive for future date: use a date far in the future (e.g., "2099-12-31") with status "Open", assert result > 0
- No status arg with future date: `daysToExpiry("2099-12-31")` assert result > 0 (status undefined means Open-like behavior)
- Past date with "Open": use "2020-01-01" with "Open", assert result < 0

**pnlClassName(value: number): string**
- Positive: `pnlClassName(100)` returns `"text-gain"`
- Negative: `pnlClassName(-50)` returns `"text-loss"`
- Zero: `pnlClassName(0)` returns `"text-muted-foreground"`
- Tiny positive: `pnlClassName(0.01)` returns `"text-gain"`
- Tiny negative: `pnlClassName(-0.01)` returns `"text-loss"`

Import the new functions at the top of the file by extending the existing import:
```ts
import {
  formatCurrency,
  formatCompact,
  convertCurrency,
  formatShares,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateShort,
  daysToExpiry,
  pnlClassName,
} from "../format"
```
  </action>
  <verify>Run `pnpm test -- src/lib/__tests__/format.test.ts` -- all tests pass, including the 15 existing ones and the ~28 new ones.</verify>
  <done>Every exported function in format.ts has at least 3 test cases covering normal, edge, and boundary conditions.</done>
</task>

<task type="auto">
  <name>Task 2: Export and test sync.ts pure helpers (mergeFundamentals, mapSector, isRateLimitError)</name>
  <files>src/lib/sync.ts, src/lib/__tests__/sync.test.ts</files>
  <action>
**Step 1: Export the three pure helpers from sync.ts**

In `src/lib/sync.ts`, add the `export` keyword to the three private functions. They are currently module-private:

1. Line ~66: `function mergeFundamentals(` -> `export function mergeFundamentals(`
2. Line ~356: `function mapSector(` -> `export function mapSector(`
3. Line ~361: `function isRateLimitError(` -> `export function isRateLimitError(`

Do NOT change any other code in sync.ts. Do NOT change the `SECTOR_MAP` constant (it can remain un-exported; mapSector tests will validate its mapping behavior).

**Step 2: Create src/lib/__tests__/sync.test.ts**

At the top of the file, mock `server-only` and all external dependencies BEFORE any imports from sync.ts:

```ts
import { describe, expect, it, vi } from "vitest"

// Mock server-only (throws at import time in non-Next.js env)
vi.mock("server-only", () => ({}))

// Mock all external deps so the module can be imported
vi.mock("../logger", () => ({
  default: { child: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }) },
}))
vi.mock("../nocodb", () => ({
  createRecord: vi.fn(),
  createRecords: vi.fn(),
  getAllRecords: vi.fn(),
  listRecords: vi.fn(),
  updateRecord: vi.fn(),
  updateRecords: vi.fn(),
}))
vi.mock("../providers", () => ({
  provider: { fetchBatchQuotes: vi.fn(), fetchForexRate: vi.fn() },
}))
vi.mock("../providers/finnhub", () => ({ FinnhubProvider: vi.fn() }))
vi.mock("../providers/alpha-vantage", () => ({ AlphaVantageProvider: vi.fn() }))

import { mergeFundamentals, mapSector, isRateLimitError } from "../sync"
```

**Test suites:**

**mergeFundamentals(symbol, results)**
- Empty results array: returns all-null fields with the given symbol
- Single result: copies all non-null values
- Multiple results, first-non-null wins: given `[{symbol:"X", eps:1, pe:null, ...}, {symbol:"X", eps:2, pe:15, ...}]`, merged eps should be 1 (first wins) and pe should be 15 (first non-null)
- All fields remain null if all results have null for that field
- Fields: eps, pe, beta, dividendYield, marketCap, sector, forwardPe, pegRatio, roe, roa (10 fields total; test at least eps, pe, sector, beta across scenarios)

**mapSector(providerSector)**
- null input returns null
- Empty string returns null
- Known sector uppercase: `mapSector("TECHNOLOGY")` returns `"Technology"`
- Known sector mixed case: `mapSector("Technology")` returns `"Technology"` (uppercased lookup)
- Consumer variants: `mapSector("CONSUMER CYCLICAL")` returns `"Consumer"`, `mapSector("CONSUMER DEFENSIVE")` returns `"Consumer"`, `mapSector("CONSUMER DISCRETIONARY")` returns `"Consumer"`, `mapSector("CONSUMER STAPLES")` returns `"Consumer"`
- Financial variants: `mapSector("FINANCIAL SERVICES")` returns `"Financial"`, `mapSector("FINANCIALS")` returns `"Financial"`
- Unknown sector: `mapSector("SPACE EXPLORATION")` returns `null`
- Healthcare: `mapSector("HEALTHCARE")` returns `"Healthcare"`
- Energy: `mapSector("ENERGY")` returns `"Energy"`
- Basic materials maps to Industrial: `mapSector("BASIC MATERIALS")` returns `"Industrial"`
- Utilities maps to Energy: `mapSector("UTILITIES")` returns `"Energy"`

**isRateLimitError(message)**
- Contains "rate limit": returns true
- Contains "API rate limit": returns true
- Contains "requests per day": returns true
- Contains "per-second burst": returns true
- Generic error message: returns false
- Empty string: returns false
- Partial match not present: `"limit exceeded"` returns false
  </action>
  <verify>Run `pnpm test -- src/lib/__tests__/sync.test.ts` -- all tests pass. Run `pnpm tsc --noEmit` to verify exports don't break type-checking.</verify>
  <done>All three sync.ts pure helpers are exported and have thorough test coverage. The server-only mock pattern works correctly.</done>
</task>

<task type="auto">
  <name>Task 3: Export and test portfolio.ts getPrimaryPlatform helper</name>
  <files>src/lib/portfolio.ts, src/lib/__tests__/portfolio.test.ts</files>
  <action>
**Step 1: Export getPrimaryPlatform from portfolio.ts**

In `src/lib/portfolio.ts`, line ~98: change `function getPrimaryPlatform(` to `export function getPrimaryPlatform(`. Do NOT change any other code.

**Step 2: Create src/lib/__tests__/portfolio.test.ts**

Mock `server-only` and all external deps before importing:

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("../nocodb", () => ({
  getAllRecords: vi.fn(),
  fetchParallel: vi.fn(),
}))
vi.mock("../options-shared", () => ({
  computeProfit: vi.fn(() => 0),
  computeOpenLongPnl: vi.fn(() => 0),
  isLongStrategy: vi.fn(() => false),
}))
vi.mock("../calculations", () => ({
  computePortfolio: vi.fn(),
  toDisplay: vi.fn((v: unknown) => Number(v)),
}))

import { getPrimaryPlatform } from "../portfolio"
```

Use `TransactionRecord`-shaped objects (only need `platform`, `type`, `shares` fields; cast with `as any` or provide minimal required fields including `Id`, `symbol`, `date`, `price`, `amount`, `shares`, `type`, `platform`).

**Test cases for getPrimaryPlatform(transactions):**

- Empty array: returns `null`
- Single Buy transaction on "IBKR" with 10 shares: returns `"IBKR"`
- Multiple platforms, IBKR has more shares: `[{type:"Buy", platform:"IBKR", shares:100}, {type:"Buy", platform:"Trading 212", shares:50}]` returns `"IBKR"`
- Sells reduce platform tally: `[{type:"Buy", platform:"IBKR", shares:100}, {type:"Sell", platform:"IBKR", shares:80}, {type:"Buy", platform:"Trading 212", shares:50}]` -- IBKR net=20, T212 net=50, returns `"Trading 212"`
- All sold from one platform: `[{type:"Buy", platform:"IBKR", shares:100}, {type:"Sell", platform:"IBKR", shares:100}]` -- IBKR net=0, returns `"IBKR"` (0 > -Infinity)
- null platform transactions are skipped: `[{type:"Buy", platform:null, shares:50}, {type:"Buy", platform:"IBKR", shares:10}]` returns `"IBKR"`
- Tie-breaking: when two platforms have identical net shares, the first one encountered in iteration wins (Map insertion order). Test with `[{type:"Buy", platform:"A", shares:50}, {type:"Buy", platform:"B", shares:50}]`. First platform iterated is "A" since both count=50 and "A" was inserted first, but the code uses `>` (not `>=`), so "A" wins with bestCount starting at -Infinity.

For each test, create minimal transaction-like objects. Use type assertion `as TransactionRecord[]` or provide all required fields. Minimal approach:
```ts
const tx = (type: "Buy"|"Sell", platform: string|null, shares: number) => ({
  Id: 1, symbol: "X", date: "2025-01-01", price: 100, amount: 1000,
  shares, type, platform, commission: null, notes: null, currency: "USD",
}) as unknown as TransactionRecord
```
Import `TransactionRecord` from `"../types"` (types.ts is NOT server-only, safe to import).
  </action>
  <verify>Run `pnpm test -- src/lib/__tests__/portfolio.test.ts` -- all tests pass. Run `pnpm tsc --noEmit` to verify exports don't break type-checking.</verify>
  <done>getPrimaryPlatform is exported and has 7 test cases covering empty input, single platform, multi-platform competition, sell reductions, null platforms, and tie-breaking.</done>
</task>

</tasks>

<verification>
Run the full test suite to confirm nothing is broken:
```bash
pnpm test
```
Expected: All existing 120 tests pass + ~55 new tests pass = ~175 total tests.

Run typecheck:
```bash
pnpm tsc --noEmit
```
Expected: No type errors from new exports.
</verification>

<success_criteria>
- format.test.ts covers all 10 exported functions from format.ts (was 4, now 10)
- sync.test.ts tests 3 pure helpers with ~20 test cases
- portfolio.test.ts tests getPrimaryPlatform with ~7 test cases
- All ~175 tests pass with `pnpm test`
- No type errors from `pnpm tsc --noEmit`
- No changes to existing test files (only additions)
- server-only mock pattern works for sync and portfolio test files
</success_criteria>

<output>
After completion, create `.planning/quick/005-full-test-coverage-frontend-and-backend/005-SUMMARY.md`
</output>
