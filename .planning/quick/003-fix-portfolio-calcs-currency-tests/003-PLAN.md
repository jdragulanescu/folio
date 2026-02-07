---
id: "003"
title: "Fix portfolio calculations, currency selector, and tests"
type: quick
tasks: 8
files_modified:
  - src/lib/portfolio.ts
  - src/lib/calculations.ts
  - src/lib/format.ts
  - src/lib/types.ts
  - src/app/page.tsx
  - src/components/portfolio/broker-breakdown.tsx
  - src/components/portfolio/capital-gains-table.tsx
  - src/components/portfolio/summary-cards.tsx
  - src/components/portfolio/holdings-table.tsx
  - src/components/portfolio/holdings-columns.tsx
  - src/components/portfolio/allocation-charts.tsx
  - src/components/portfolio/top-movers.tsx
  - src/hooks/use-currency-preference.ts
  - src/lib/__tests__/calculations.test.ts
  - src/lib/__tests__/format.test.ts
  - src/lib/__tests__/capital-gains.test.ts
---

<objective>
Fix 6 issues in the portfolio dashboard: wrong cash balance (currency mixing), zero-share stocks still showing, remove broker view toggle, fix fiscal year capital gains to show real P&L, add currency selector (USD/GBP), and add comprehensive tests.

All financial math uses Big.js. The portfolio data flows: NocoDB -> portfolio.ts (server) -> page.tsx (RSC) -> client components.
</objective>

<context>
@src/lib/portfolio.ts
@src/lib/calculations.ts
@src/lib/format.ts
@src/lib/types.ts
@src/app/page.tsx
@src/components/portfolio/broker-breakdown.tsx
@src/components/portfolio/capital-gains-table.tsx
@src/components/portfolio/summary-cards.tsx
@src/components/portfolio/holdings-columns.tsx
@src/components/portfolio/allocation-charts.tsx
@src/components/portfolio/top-movers.tsx
@src/hooks/use-currency-preference.ts
@src/lib/__tests__/calculations.test.ts
@src/lib/__tests__/options-shared.test.ts
@src/lib/nocodb.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix cash balance currency mixing and zero-share filtering</name>
  <files>
    src/lib/portfolio.ts
    src/lib/types.ts
  </files>
  <action>
  Two fixes in portfolio.ts:

  **Fix 1: Cash balance currency mixing**

  The cash balance currently sums GBP deposit amounts with USD transaction amounts, producing nonsense numbers.

  In `getPortfolioData()`:
  1. Add `settings` to the fetchParallel call: `() => getAllRecords<SettingRecord>("settings")` (import SettingRecord from types)
  2. Extract the forex rate from settings: find the record where `key === "usd_gbp_rate"` and parse its `value` to a number. Default to 0.79 if not found.
  3. Convert GBP deposits to USD before summing in the cash balance calculation. UK brokers are "Trading 212", "Freetrade", "Stake", "eToro". US brokers are "IBKR", "Robinhood". For each deposit:
     - If `d.platform` is a UK broker: `cashBalance += d.amount / usdGbpRate` (GBP to USD: divide by USD/GBP rate)
     - If `d.platform` is a US broker: `cashBalance += d.amount` (already USD)
     - Fallback for unknown: treat as GBP (divide by rate)
  4. Apply the same conversion to `totalDeposited` calculation (Step 12) so it also shows in USD.
  5. Add `forexRate: number` to the `PortfolioData` interface so the client can use it for currency conversion.
  6. Return `forexRate: usdGbpRate` in the return object.

  Use a helper function to determine if a broker is US-based:
  ```typescript
  const US_BROKERS = new Set(["IBKR", "Robinhood"])
  function isUsBroker(platform: string | null): boolean {
    return platform != null && US_BROKERS.has(platform)
  }
  ```

  **Fix 2: Zero-share stocks still showing**

  Change line 170 from:
  ```typescript
  const activeHoldings = result.holdings.filter((h) => h.shares.gt(0))
  ```
  to:
  ```typescript
  const activeHoldings = result.holdings.filter((h) => h.shares.gte(new Big("0.0001")))
  ```

  This uses the same threshold as `formatShares` (0.0001) to filter out near-zero fractional positions.
  </action>
  <verify>
  `pnpm tsc --noEmit` passes. Existing tests still pass: `pnpm vitest run`.
  </verify>
  <done>
  Cash balance converts GBP deposits to USD using forex rate. Near-zero share positions are filtered out. forexRate is exposed on PortfolioData.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove broker breakdown toggle -- always show content</name>
  <files>
    src/components/portfolio/broker-breakdown.tsx
  </files>
  <action>
  Remove the expand/collapse toggle from BrokerBreakdown:

  1. Remove `useState` import (keep `useMemo`) and remove `const [expanded, setExpanded] = useState(false)`
  2. Remove the `Button` import
  3. Remove the `CardAction` import from the card imports
  4. Remove the `<CardAction>` block (lines 128-137) containing the View/Hide button
  5. Remove the `{expanded && (` conditional wrapper around `<CardContent>` -- CardContent should always render
  6. Remove the closing `)}` for the conditional

  The card should always show its table and chart. Keep all other logic unchanged.
  </action>
  <verify>
  `pnpm tsc --noEmit` passes. Visual check: broker breakdown card shows table and chart without a toggle button.
  </verify>
  <done>
  BrokerBreakdown always renders its content. No View/Hide button. No useState.
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix capital gains table to show real P&L per fiscal year</name>
  <files>
    src/components/portfolio/capital-gains-table.tsx
    src/lib/calculations.ts
  </files>
  <action>
  The capital gains table currently shows total proceeds per fiscal year. It needs to show actual realised P&L computed via Section 104 pool.

  **Step 1: Add per-sale P&L function to calculations.ts**

  Export a new function `computeRealisedGainsByFiscalYear`:

  ```typescript
  export interface FiscalYearGains {
    fiscalYear: string
    sellCount: number
    totalProceeds: Big
    totalCostBasis: Big
    realisedPnl: Big
  }

  export function computeRealisedGainsByFiscalYear(
    transactionsBySymbol: Map<string, TransactionInput[]>,
  ): FiscalYearGains[] {
  ```

  Logic:
  1. For each symbol's transactions, sort by date ascending (buys before sells on same day -- reuse the same sort logic as computeHolding).
  2. Run the Section 104 pool algorithm (same as computeHolding). For each SELL transaction, record:
     - `fiscalYear` using the `getFiscalYear()` helper (extract it or inline it)
     - `proceeds` = tx.amount
     - `costBasis` = avgCost * shares sold
     - `pnl` = proceeds - costBasis
  3. Aggregate all sells across all symbols by fiscal year.
  4. Return sorted by fiscal year descending.

  Include a `getFiscalYear(dateStr: string): string` function in calculations.ts (export it so it can be tested and reused). Use the same logic as the one currently in capital-gains-table.tsx:
  - UK fiscal year runs 6 Apr to 5 Apr
  - Before 6 April: previous fiscal year
  - Format: "2024/25"

  **Step 2: Rewrite capital-gains-table.tsx**

  The component receives `transactions: TransactionRecord[]`. Convert them to the right format and call `computeRealisedGainsByFiscalYear`.

  1. Import `computeRealisedGainsByFiscalYear`, `toDisplay` from `@/lib/calculations` and `Big` from `big.js`
  2. In the `useMemo`, group transactions by symbol into a `Map<string, TransactionInput[]>`, then call `computeRealisedGainsByFiscalYear(txBySymbol)`
  3. Remove the local `getFiscalYear` function (now in calculations.ts)
  4. Update the table columns to show:
     - Fiscal Year
     - Sales (count)
     - Total Proceeds (formatCurrency)
     - Cost Basis (formatCurrency)
     - Realised P&L (formatCurrency with pnlClassName colouring)
  5. Remove `holdings` from the props interface since it was unused (already destructured only `transactions`)

  Convert Big values to numbers using `toDisplay()` inside the useMemo before rendering.
  </action>
  <verify>
  `pnpm tsc --noEmit` passes. `pnpm vitest run` passes. The fiscal year table now shows proceeds, cost basis, and realised P&L columns.
  </verify>
  <done>
  Capital gains table shows per-fiscal-year realised P&L computed via Section 104 pool, not just raw proceeds.
  </done>
</task>

<task type="auto">
  <name>Task 4: Add currency selector and wire formatCurrency across all components</name>
  <files>
    src/lib/format.ts
    src/hooks/use-currency-preference.ts
    src/app/page.tsx
    src/components/portfolio/summary-cards.tsx
    src/components/portfolio/holdings-table.tsx
    src/components/portfolio/holdings-columns.tsx
    src/components/portfolio/broker-breakdown.tsx
    src/components/portfolio/capital-gains-table.tsx
    src/components/portfolio/allocation-charts.tsx
    src/components/portfolio/top-movers.tsx
  </files>
  <action>
  Wire the existing (unused) `useCurrencyPreference` hook to all portfolio components so users can toggle between USD and GBP display.

  **Step 1: Update format.ts**

  Add currency param to `formatCompact`:
  ```typescript
  export function formatCompact(value: number, currency: "USD" | "GBP" = "USD"): string {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  }
  ```

  Add a currency conversion helper (pure function, no server dependency):
  ```typescript
  export function convertCurrency(
    value: number,
    fromCurrency: "USD" | "GBP",
    toCurrency: "USD" | "GBP",
    usdGbpRate: number,
  ): number {
    if (fromCurrency === toCurrency) return value
    if (fromCurrency === "USD" && toCurrency === "GBP") return value * usdGbpRate
    // GBP to USD
    return value / usdGbpRate
  }
  ```

  **Step 2: Update page.tsx (server component)**

  Pass `forexRate` to a new client wrapper. Create a `PortfolioClientWrapper` component or pass the forexRate down through props. The simplest approach: pass `forexRate` as a prop to each component that needs it.

  Since all portfolio components are client components, pass `data.forexRate` to each one that displays currency values. Update the page to pass `forexRate={data.forexRate}` to:
  - `SummaryCards`
  - `HoldingsTable`
  - `BrokerBreakdown`
  - `CapitalGainsTable`
  - `AllocationCharts`
  - `TopMovers`

  **Step 3: Add currency selector to SummaryCards**

  At the top of SummaryCards, add a small currency toggle using the existing hook:
  ```typescript
  const [currency, setCurrency] = useCurrencyPreference()
  ```

  Add a toggle button group in the header area (before the cards grid). Use a simple button group:
  ```tsx
  <div className="flex items-center justify-between">
    <div /> {/* spacer */}
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={currency === "USD" ? "secondary" : "ghost"}
        size="xs"
        onClick={() => setCurrency("USD")}
        className="text-xs h-6 px-2"
      >
        $ USD
      </Button>
      <Button
        variant={currency === "GBP" ? "secondary" : "ghost"}
        size="xs"
        onClick={() => setCurrency("GBP")}
        className="text-xs h-6 px-2"
      >
        £ GBP
      </Button>
    </div>
  </div>
  ```

  Then create a helper inside SummaryCards (or pass through):
  ```typescript
  const fc = (value: number) => {
    const converted = currency === "GBP" ? value * forexRate : value
    return formatCurrency(converted, currency)
  }
  ```

  Replace all `formatCurrency(...)` calls with `fc(...)`.

  **Step 4: Update all other currency-displaying components**

  For each component that displays currency (holdings-columns, broker-breakdown, capital-gains-table, allocation-charts, top-movers):

  1. Add `forexRate: number` to the props interface
  2. Add `useCurrencyPreference()` hook call
  3. Create a local `fc` helper that converts and formats:
     ```typescript
     const [currency] = useCurrencyPreference()
     const fc = useCallback((value: number) => {
       const converted = currency === "GBP" ? value * forexRate : value
       return formatCurrency(converted, currency)
     }, [currency, forexRate])
     ```
  4. Replace `formatCurrency(...)` with `fc(...)` and `formatCompact(...)` with `formatCompact(converted, currency)`

  For holdings-columns.tsx specifically: since column definitions are not React components, the columns need to receive currency and forexRate. The cleanest approach is to make `columns` a function:
  ```typescript
  export function getColumns(currency: "USD" | "GBP", forexRate: number): ColumnDef<DisplayHolding>[] {
  ```
  Then in holdings-table.tsx, call `const cols = useMemo(() => getColumns(currency, forexRate), [currency, forexRate])` and pass `cols` to `useReactTable`.

  Import `useCurrencyPreference` in holdings-table.tsx and pass currency/forexRate to the columns factory.
  </action>
  <verify>
  `pnpm tsc --noEmit` passes. Currency toggle appears above summary cards. Clicking GBP converts all values. Clicking USD shows original values.
  </verify>
  <done>
  Currency selector toggles between USD and GBP. All portfolio currency values are converted using the forex rate from settings. Preference persists in localStorage.
  </done>
</task>

<task type="auto">
  <name>Task 5: Update page.tsx to remove unused holdings prop from CapitalGainsTable</name>
  <files>
    src/app/page.tsx
  </files>
  <action>
  After Task 3 removes `holdings` from CapitalGainsTable's props, update page.tsx:

  Change:
  ```tsx
  <CapitalGainsTable
    holdings={data.holdings}
    transactions={data.transactions}
  />
  ```
  To:
  ```tsx
  <CapitalGainsTable
    transactions={data.transactions}
    forexRate={data.forexRate}
  />
  ```

  This should already be partially done in Task 4 (adding forexRate), but make sure `holdings` is removed too.
  </action>
  <verify>
  `pnpm tsc --noEmit` passes. No type errors about missing or extra props.
  </verify>
  <done>
  CapitalGainsTable receives only `transactions` and `forexRate`. No unused `holdings` prop.
  </done>
</task>

<task type="auto">
  <name>Task 6: Add tests for getFiscalYear and computeRealisedGainsByFiscalYear</name>
  <files>
    src/lib/__tests__/calculations.test.ts
  </files>
  <action>
  Add test suites to the existing calculations.test.ts file.

  **Tests for getFiscalYear:**

  ```typescript
  describe("getFiscalYear", () => {
    it("date after 5 April returns current/next year", () => {
      expect(getFiscalYear("2024-04-06")).toBe("2024/25")
      expect(getFiscalYear("2024-12-31")).toBe("2024/25")
      expect(getFiscalYear("2025-04-05")).toBe("2024/25") // 5 April is still previous FY
    })

    it("date before 6 April returns previous/current year", () => {
      expect(getFiscalYear("2025-01-10")).toBe("2024/25")
      expect(getFiscalYear("2025-04-05")).toBe("2024/25")
      expect(getFiscalYear("2025-03-31")).toBe("2024/25")
    })

    it("exactly 6 April starts new fiscal year", () => {
      expect(getFiscalYear("2025-04-06")).toBe("2025/26")
    })

    it("handles edge of year boundary", () => {
      expect(getFiscalYear("2024-01-01")).toBe("2023/24")
      expect(getFiscalYear("2024-04-06")).toBe("2024/25")
    })
  })
  ```

  **Tests for computeRealisedGainsByFiscalYear:**

  Import `computeRealisedGainsByFiscalYear`, `getFiscalYear` from `../calculations` and Big from `big.js`.

  ```typescript
  describe("computeRealisedGainsByFiscalYear", () => {
    it("computes P&L for single symbol with one sell", () => {
      const txBySymbol = new Map([
        ["AAPL", [
          tx("Buy", 100, 50, "2024-01-01"),   // cost = 5000
          tx("Sell", 100, 60, "2024-06-15"),   // proceeds = 6000, P&L = 1000
        ]],
      ])
      const result = computeRealisedGainsByFiscalYear(txBySymbol)

      expect(result).toHaveLength(1)
      expect(result[0].fiscalYear).toBe("2024/25")
      expect(result[0].sellCount).toBe(1)
      expect(Number(result[0].totalProceeds.toFixed(2))).toBe(6000)
      expect(Number(result[0].totalCostBasis.toFixed(2))).toBe(5000)
      expect(Number(result[0].realisedPnl.toFixed(2))).toBe(1000)
    })

    it("computes P&L across multiple symbols", () => {
      const txBySymbol = new Map([
        ["AAPL", [
          tx("Buy", 100, 50, "2024-01-01"),
          tx("Sell", 50, 60, "2024-06-15"),   // P&L = 50*(60-50) = 500
        ]],
        ["MSFT", [
          tx("Buy", 200, 40, "2024-02-01"),
          tx("Sell", 100, 35, "2024-07-01"),  // P&L = 100*(35-40) = -500
        ]],
      ])
      const result = computeRealisedGainsByFiscalYear(txBySymbol)

      expect(result).toHaveLength(1) // both in 2024/25
      expect(result[0].sellCount).toBe(2)
      expect(Number(result[0].realisedPnl.toFixed(2))).toBe(0) // 500 + (-500) = 0
    })

    it("splits sales across fiscal years", () => {
      const txBySymbol = new Map([
        ["AAPL", [
          tx("Buy", 200, 50, "2024-01-01"),
          tx("Sell", 100, 60, "2024-06-15"),   // FY 2024/25, P&L = 1000
          tx("Sell", 100, 70, "2025-06-15"),   // FY 2025/26, P&L = 2000
        ]],
      ])
      const result = computeRealisedGainsByFiscalYear(txBySymbol)

      expect(result).toHaveLength(2)
      // Sorted descending by fiscal year
      expect(result[0].fiscalYear).toBe("2025/26")
      expect(Number(result[0].realisedPnl.toFixed(2))).toBe(2000)
      expect(result[1].fiscalYear).toBe("2024/25")
      expect(Number(result[1].realisedPnl.toFixed(2))).toBe(1000)
    })

    it("returns empty array when no sells", () => {
      const txBySymbol = new Map([
        ["AAPL", [tx("Buy", 100, 50, "2024-01-01")]],
      ])
      const result = computeRealisedGainsByFiscalYear(txBySymbol)
      expect(result).toHaveLength(0)
    })

    it("handles empty input", () => {
      const result = computeRealisedGainsByFiscalYear(new Map())
      expect(result).toHaveLength(0)
    })
  })
  ```
  </action>
  <verify>
  `pnpm vitest run src/lib/__tests__/calculations.test.ts` -- all tests pass including the new ones.
  </verify>
  <done>
  getFiscalYear has 5+ test cases covering boundary conditions. computeRealisedGainsByFiscalYear has 5+ test cases covering single symbol, multi-symbol, cross-FY splits, and edge cases.
  </done>
</task>

<task type="auto">
  <name>Task 7: Add tests for format utilities and currency conversion</name>
  <files>
    src/lib/__tests__/format.test.ts
  </files>
  <action>
  Create a new test file for format.ts covering:

  **formatCurrency tests:**
  ```typescript
  describe("formatCurrency", () => {
    it("formats USD by default", () => {
      expect(formatCurrency(1234.56)).toMatch(/\$1,234\.56/)
    })

    it("formats GBP when specified", () => {
      expect(formatCurrency(1234.56, "GBP")).toMatch(/\u00a31,234\.56/)
    })

    it("handles zero", () => {
      expect(formatCurrency(0)).toMatch(/\$0\.00/)
    })

    it("handles negative values", () => {
      const result = formatCurrency(-500.5)
      expect(result).toContain("500.50")
    })

    it("rounds to 2 decimal places", () => {
      expect(formatCurrency(10.999)).toMatch(/11\.00/)
    })
  })
  ```

  **formatCompact tests:**
  ```typescript
  describe("formatCompact", () => {
    it("formats large numbers compactly in USD", () => {
      const result = formatCompact(1_500_000_000)
      expect(result).toContain("1.5")
    })

    it("accepts GBP currency", () => {
      const result = formatCompact(1_000_000, "GBP")
      expect(result).toContain("1")
    })
  })
  ```

  **convertCurrency tests:**
  ```typescript
  describe("convertCurrency", () => {
    const rate = 0.79 // 1 USD = 0.79 GBP

    it("USD to GBP multiplies by rate", () => {
      expect(convertCurrency(100, "USD", "GBP", rate)).toBeCloseTo(79)
    })

    it("GBP to USD divides by rate", () => {
      expect(convertCurrency(79, "GBP", "USD", rate)).toBeCloseTo(100)
    })

    it("same currency returns same value", () => {
      expect(convertCurrency(100, "USD", "USD", rate)).toBe(100)
      expect(convertCurrency(100, "GBP", "GBP", rate)).toBe(100)
    })

    it("handles zero", () => {
      expect(convertCurrency(0, "USD", "GBP", rate)).toBe(0)
    })
  })
  ```

  **formatShares tests:**
  ```typescript
  describe("formatShares", () => {
    it("integer shares have no decimals", () => {
      expect(formatShares(100)).toBe("100")
    })

    it("fractional shares show 2-4 decimals", () => {
      const result = formatShares(10.5)
      expect(result).toContain("10.5")
    })

    it("near-integer treated as integer", () => {
      expect(formatShares(99.9999)).toBe("100")
    })
  })
  ```
  </action>
  <verify>
  `pnpm vitest run src/lib/__tests__/format.test.ts` -- all tests pass.
  </verify>
  <done>
  format.ts has comprehensive test coverage for formatCurrency, formatCompact, convertCurrency, and formatShares.
  </done>
</task>

<task type="auto">
  <name>Task 8: Final typecheck, lint, and full test run</name>
  <files>
    (no new files -- validation only)
  </files>
  <action>
  Run the full validation suite to catch any issues across all changed files:

  1. `pnpm tsc --noEmit` -- typecheck all files
  2. `pnpm vitest run` -- run all test suites
  3. `pnpm next lint` -- lint check

  Fix any errors found. Common issues to watch for:
  - Missing imports (Big, getFiscalYear, convertCurrency)
  - Type mismatches on forexRate prop (number vs undefined)
  - Column factory function not being called correctly in holdings-table
  - useCurrencyPreference import path
  </action>
  <verify>
  All three commands pass with zero errors and zero warnings.
  </verify>
  <done>
  All typechecks pass, all tests pass, lint is clean. The 6 issues are resolved.
  </done>
</task>

</tasks>

<verification>
1. `pnpm tsc --noEmit` -- zero type errors
2. `pnpm vitest run` -- all test suites pass (calculations, format, options-shared)
3. `pnpm next lint` -- zero warnings
4. Visual: portfolio page loads, currency toggle works, broker breakdown shows without button, capital gains shows P&L columns
</verification>

<success_criteria>
- Cash balance is calculated in USD, with GBP deposits converted using stored forex rate
- Stocks with < 0.0001 shares are filtered out
- Broker breakdown always shows (no toggle button)
- Capital gains table shows: fiscal year, sales count, proceeds, cost basis, realised P&L
- Currency selector toggles all displayed values between USD and GBP
- 15+ new test cases across calculations.test.ts and format.test.ts
- Zero type errors, zero lint errors, all tests green
</success_criteria>
