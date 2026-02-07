---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/calculations.ts
  - src/lib/portfolio.ts
  - src/lib/__tests__/calculations.test.ts
  - src/components/portfolio/capital-gains-table.tsx
  - src/components/portfolio/summary-cards.tsx
  - src/app/page.tsx
autonomous: true

must_haves:
  truths:
    - "Cash balance is positive (sells ADD cash, not subtract)"
    - "Capital gains show correct positive P&L for profitable sells"
    - "Realised P&L matches expected values (sell proceeds - cost basis)"
    - "All deposits converted from GBP to USD regardless of broker"
    - "Options premium on portfolio page matches options page calculation"
    - "Capital gains card is wider and includes totals row with commission"
  artifacts:
    - path: "src/lib/calculations.ts"
      provides: "Absolute-value sell amounts in computeHolding and computeRealisedGainsByFiscalYear"
      contains: "Math.abs"
    - path: "src/lib/portfolio.ts"
      provides: "Fixed cash formula, deposit conversion, and options premium consistency"
      contains: "Math.abs"
    - path: "src/components/portfolio/capital-gains-table.tsx"
      provides: "Wider card layout with totals row and commission total"
      contains: "col-span-2"
    - path: "src/lib/__tests__/calculations.test.ts"
      provides: "Tests verifying negative amounts are handled correctly"
  key_links:
    - from: "src/lib/calculations.ts"
      to: "src/lib/portfolio.ts"
      via: "computeHolding called by computePortfolio, portfolio.ts uses same abs pattern for cash"
      pattern: "Math\\.abs.*amount"
---

<objective>
Fix critical calculation bugs where negative sell amounts from migrated spreadsheet data cause wrong cash balance (-$1M), wrong capital gains, and wrong realised P&L. Also fix deposit currency conversion (all deposits are GBP), align options premium calculation between portfolio and options pages, and improve capital gains card layout.

Purpose: The dashboard currently shows wildly incorrect numbers because the migration preserved negative sell amounts from the spreadsheet. This is the highest-priority fix.

Output: Correct financial calculations across the entire dashboard.
</objective>

<execution_context>
@/Users/skylight/.claude/sky/workflows/execute-plan.md
@/Users/skylight/.claude/sky/templates/summary.md
</execution_context>

<context>
@src/lib/calculations.ts
@src/lib/portfolio.ts
@src/lib/options.ts
@src/lib/options-shared.ts
@src/lib/types.ts
@src/lib/__tests__/calculations.test.ts
@src/components/portfolio/capital-gains-table.tsx
@src/components/portfolio/summary-cards.tsx
@src/app/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix negative sell amounts in calculations engine and portfolio assembly</name>
  <files>
    src/lib/calculations.ts
    src/lib/portfolio.ts
    src/lib/__tests__/calculations.test.ts
  </files>
  <action>
**BUG 1 — Negative sell amounts (CRITICAL)**

The spreadsheet stores negative amounts for sells. The migration imported raw negative values. All calculation code assumes positive amounts. Fix by applying `Math.abs()` to transaction amounts at every usage site.

In `src/lib/calculations.ts`:

1. In `computeHolding` (line 126): Change `const txAmount = new Big(tx.amount)` to `const txAmount = new Big(Math.abs(tx.amount))`. This affects both Buy (adds to pool cost) and Sell (used as proceeds). Buy amounts should already be positive from migration, but `abs()` is defensive. For Sell, this converts negative proceeds to positive.

2. In `computeRealisedGainsByFiscalYear` (line 285): Same fix — change `const txAmount = new Big(tx.amount)` to `const txAmount = new Big(Math.abs(tx.amount))`. This function has the identical pattern (uses txAmount for both pool cost on Buy and proceeds on Sell).

In `src/lib/portfolio.ts`:

3. **Cash balance fix** (lines 318-324): The sell branch does `cashBalance += tx.amount` but tx.amount is negative for sells, so it subtracts cash instead of adding. Change to:
```typescript
if (tx.type === "Buy") {
  cashBalance -= Math.abs(tx.amount)
} else {
  cashBalance += Math.abs(tx.amount)
}
```

4. **Deposit currency fix** (lines 306-316): ALL deposits are GBP regardless of broker. Remove the `isUsBroker` branch and convert ALL deposits:
```typescript
for (const d of deposits) {
  cashBalance += d.amount / usdGbpRate
}
```

5. **Total deposited fix** (lines 405-412): Same issue — apply consistent GBP-to-USD conversion for ALL deposits:
```typescript
let totalDeposited = 0
for (const d of deposits) {
  totalDeposited += d.amount / usdGbpRate
}
```

6. **Options premium consistency** (lines 414-420): Currently sums gross premium for sold options. Should use `computeProfit()` from `options-shared.ts` for consistency with the options page. Import `computeProfit` from `./options-shared` and change to:
```typescript
let optionsPremium = 0
for (const o of options) {
  if (o.buy_sell === "Sell") {
    optionsPremium += computeProfit(o) ?? (o.premium * o.qty * 100)
  }
}
```
This matches the options page `computeStats` logic: use net profit for closed options, fall back to gross premium for open ones.

7. Optionally, the `isUsBroker` function and `US_BROKERS` constant can be removed since they are no longer needed for deposits. Check if they are used anywhere else first — if not, delete them.

In `src/lib/__tests__/calculations.test.ts`:

8. Add a test case for negative sell amounts in `computeHolding`:
```typescript
it("handles negative sell amounts from spreadsheet migration", () => {
  const transactions = [
    { type: "Buy" as const, shares: 100, price: 10, amount: 1000, date: "2024-01-01" },
    { type: "Sell" as const, shares: 40, price: 15, amount: -600, date: "2024-02-01" },
  ]
  const result = computeHolding(transactions, 12)
  expect(result.shares).toEqual(new Big(60))
  expect(result.realisedPnl).toEqual(new Big(200)) // 600 - 400 = 200, NOT -600 - 400 = -1000
  expect(result.totalCost).toEqual(new Big(600))
})
```

9. Add a test for negative amounts in `computeRealisedGainsByFiscalYear`:
```typescript
it("handles negative sell amounts in fiscal year gains", () => {
  const txBySymbol = new Map([
    ["AAPL", [
      { type: "Buy" as const, shares: 100, price: 50, amount: 5000, date: "2024-01-01" },
      { type: "Sell" as const, shares: 100, price: 60, amount: -6000, date: "2024-06-15" },
    ]],
  ])
  const result = computeRealisedGainsByFiscalYear(txBySymbol)
  expect(result).toHaveLength(1)
  expect(Number(result[0].totalProceeds.toFixed(2))).toBe(6000) // positive
  expect(Number(result[0].realisedPnl.toFixed(2))).toBe(1000) // profit, not -11000
})
```
  </action>
  <verify>
Run `pnpm vitest run src/lib/__tests__/calculations.test.ts` — all tests pass including the two new negative-amount tests.
Run `pnpm tsc --noEmit` — no type errors.
  </verify>
  <done>
- `computeHolding` uses `Math.abs(tx.amount)` so negative sell amounts produce correct realised P&L
- `computeRealisedGainsByFiscalYear` uses `Math.abs(tx.amount)` so capital gains are correct
- Cash balance adds sell proceeds (not subtracts) and uses `Math.abs`
- ALL deposits converted from GBP to USD (no `isUsBroker` branching for deposits)
- `totalDeposited` also converts all deposits consistently
- `optionsPremium` uses `computeProfit()` matching options page logic
- Two new test cases verify negative amount handling
- Typecheck passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Capital gains card — wider layout, totals row, commission total</name>
  <files>
    src/components/portfolio/capital-gains-table.tsx
    src/app/page.tsx
  </files>
  <action>
In `src/app/page.tsx`:

1. Move `CapitalGainsTable` out of the 3-col chart grid and place it in its own section AFTER the charts grid but BEFORE the end of the page. Give it a `col-span-2` wrapper or simply put it as a standalone full-width or half-width section. The simplest approach: keep it inside the grid but add `className="md:col-span-2"` to the `CapitalGainsTable` component's root Card.

Actually, since the Card is inside the component, the cleanest approach is to pass a className prop. Alternatively, wrap it in a div with the col-span class in page.tsx:
```tsx
<div className="md:col-span-2">
  <CapitalGainsTable transactions={data.transactions} forexRate={data.forexRate} />
</div>
```

Also pass `options={data.options}` to the component for commission data.

In `src/components/portfolio/capital-gains-table.tsx`:

2. Add `options` to the props interface:
```typescript
interface CapitalGainsTableProps {
  transactions: TransactionRecord[]
  options: OptionRecord[]
  forexRate: number
}
```
Import `OptionRecord` from `@/lib/types`.

3. Add a totals row at the bottom of the table that sums all fiscal years:
```typescript
const totals = useMemo(() => {
  return {
    sellCount: fiscalYears.reduce((sum, fy) => sum + fy.sellCount, 0),
    totalProceeds: fiscalYears.reduce((sum, fy) => sum + fy.totalProceeds, 0),
    totalCostBasis: fiscalYears.reduce((sum, fy) => sum + fy.totalCostBasis, 0),
    realisedPnl: fiscalYears.reduce((sum, fy) => sum + fy.realisedPnl, 0),
  }
}, [fiscalYears])
```

Add a `<tfoot>` section after `</tbody>` with a totals row styled with `font-semibold` and a top border:
```tsx
<tfoot>
  <tr className="border-t font-semibold">
    <td className="pt-2">Total</td>
    <td className="pt-2 text-right tabular-nums">{totals.sellCount}</td>
    <td className="pt-2 text-right tabular-nums">{fc(totals.totalProceeds)}</td>
    <td className="pt-2 text-right tabular-nums">{fc(totals.totalCostBasis)}</td>
    <td className={`pt-2 text-right tabular-nums ${pnlClassName(totals.realisedPnl)}`}>
      {fc(totals.realisedPnl)}
    </td>
  </tr>
</tfoot>
```

4. Add commission total below the table. Compute total commission from options:
```typescript
const totalCommission = useMemo(() => {
  return options
    .filter((o) => o.commission != null)
    .reduce((sum, o) => sum + o.commission!, 0)
}, [options])
```

Display it below the table (inside CardContent, after the table's overflow div) if non-zero:
```tsx
{totalCommission !== 0 && (
  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
    <span className="text-muted-foreground">Total Options Commission</span>
    <span className="tabular-nums font-medium text-loss">
      {fc(Math.abs(totalCommission))}
    </span>
  </div>
)}
```
Commission values are typically negative (costs), so display the absolute value with loss styling.

5. Update the CardTitle to just "Capital Gains" (shorter, the table already shows fiscal year detail).
  </action>
  <verify>
Run `pnpm tsc --noEmit` — no type errors.
Visually confirm the capital gains card spans 2 columns in the grid on md+ screens, has a totals row summing all fiscal years, and shows commission total if data exists.
  </verify>
  <done>
- Capital gains card spans 2 columns on md+ screens
- Table includes a totals footer row summing sells, proceeds, cost basis, and P&L
- Commission total displayed below table when commission data exists
- Card title shortened to "Capital Gains"
- Typecheck passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Update options premium card label for clarity</name>
  <files>
    src/components/portfolio/summary-cards.tsx
  </files>
  <action>
In `src/components/portfolio/summary-cards.tsx`:

1. Update the "Options Premium" card title to "Options P&L" since the underlying value now uses `computeProfit()` (net profit) instead of gross premium. This makes it clear it represents net options income, not just gross premium received.

2. Change the card's hardcoded `text-gain` color on the value to use dynamic P&L coloring. The value could theoretically be negative if closing costs exceed premiums:
```tsx
<div className={`text-xl font-bold tabular-nums ${pnlClassName(optionsPremium)}`}>
  {fc(optionsPremium)}
</div>
```
Instead of the current hardcoded `text-gain`.
  </action>
  <verify>
Run `pnpm tsc --noEmit` — no type errors.
Visually confirm the card now shows "Options P&L" and uses green/red coloring based on value sign.
  </verify>
  <done>
- Options card label reads "Options P&L" matching its net-profit semantics
- Value color is dynamic (green for positive, red for negative)
- Typecheck passes
  </done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `pnpm vitest run` — all tests pass (existing + 2 new negative-amount tests)
2. `pnpm tsc --noEmit` — zero type errors
3. `pnpm lint` — no lint errors
4. Visual check: Dashboard shows positive cash balance, correct capital gains, wider capital gains card with totals
</verification>

<success_criteria>
- Cash balance is positive (not -$1M)
- Realised P&L and capital gains show correct positive values for profitable sells
- All deposits converted GBP->USD consistently
- Options premium on portfolio page uses same computation as options page
- Capital gains card spans 2 columns with totals row and commission total
- All existing + new tests pass
- No type errors
</success_criteria>

<output>
After completion, create `.planning/quick/004-fix-calculations-consistency/004-SUMMARY.md`
</output>
