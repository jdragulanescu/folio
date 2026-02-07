---
phase: quick-006
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/options-shared.ts
  - src/components/options/premium-chart.tsx
  - src/lib/__tests__/options-shared.test.ts
autonomous: true

must_haves:
  truths:
    - "Premium chart bars reflect the month each option was CLOSED, not opened"
    - "Options without a close_date (open positions) are excluded from the chart"
    - "Year selector shows years derived from close_date, not opened date"
    - "PremiumChartSummary on portfolio page also groups by close_date via buildPremiumByMonth"
  artifacts:
    - path: "src/lib/options-shared.ts"
      provides: "buildPremiumByMonth grouping by close_date"
      contains: "close_date"
    - path: "src/components/options/premium-chart.tsx"
      provides: "PremiumChart grouping by close_date"
      contains: "close_date"
    - path: "src/lib/__tests__/options-shared.test.ts"
      provides: "Updated tests for close_date grouping"
      contains: "close_date"
  key_links:
    - from: "src/lib/options-shared.ts"
      to: "OptionRecord.close_date"
      via: "buildPremiumByMonth uses close_date instead of opened"
      pattern: "opt\\.close_date"
    - from: "src/components/options/premium-chart.tsx"
      to: "OptionRecord.close_date"
      via: "inline grouping uses close_date"
      pattern: "opt\\.close_date"
---

<objective>
Fix the options monthly short premium chart to group by close_date month instead of opened month.

Purpose: The premium chart should show when premium was *realized* (when the option closed), not when it was initiated. This gives an accurate picture of monthly income.

Output: Updated `buildPremiumByMonth()` and `PremiumChart` component both grouping by `close_date`. Options without a `close_date` are excluded (they haven't realized premium yet).
</objective>

<execution_context>
@/Users/skylight/.claude/sky/workflows/execute-plan.md
@/Users/skylight/.claude/sky/templates/summary.md
</execution_context>

<context>
@src/lib/options-shared.ts
@src/lib/types.ts
@src/components/options/premium-chart.tsx
@src/lib/__tests__/options-shared.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update buildPremiumByMonth to group by close_date</name>
  <files>src/lib/options-shared.ts</files>
  <action>
In `buildPremiumByMonth()` (line ~419-454), change the grouping logic:

1. Replace the `opened` date grouping with `close_date` grouping:
   - Skip options where `opt.close_date` is null (open positions have no realized premium)
   - Use `new Date(opt.close_date)` instead of `new Date(opt.opened)` for year filtering and month extraction

2. Update the JSDoc comment to say "Groups options by the month of their `close_date`" instead of "opened date"

The function signature stays the same: `buildPremiumByMonth(options: OptionRecord[], year: number): MonthlyPremium[]`

Specifically, the loop body (lines 430-444) should become:
```typescript
for (const opt of options) {
  if (!opt.close_date) continue  // skip open positions
  const closeDate = new Date(opt.close_date)
  if (closeDate.getFullYear() !== year) continue

  const month = closeDate.getMonth()
  const entry = monthMap.get(month)!

  const totalPremium = opt.premium * opt.qty * 100
  if (opt.strategy_type === "Wheel") {
    entry.wheel += totalPremium
  } else if (opt.strategy_type === "LEAPS") {
    entry.leaps += totalPremium
  }
}
```
  </action>
  <verify>Run `pnpm tsc --noEmit` -- no type errors</verify>
  <done>buildPremiumByMonth groups by close_date month; options without close_date are skipped</done>
</task>

<task type="auto">
  <name>Task 2: Update PremiumChart component to group by close_date</name>
  <files>src/components/options/premium-chart.tsx</files>
  <action>
The PremiumChart component has its own inline grouping logic (lines 50-82) that duplicates buildPremiumByMonth but groups by `opened`. Fix both the year selector and chart data:

1. **availableYears** (lines 50-57): Change to derive years from `close_date` instead of `opened`:
   - Filter `shortOptions` to only those with `opt.close_date` (non-null)
   - Use `new Date(opt.close_date).getFullYear()` to build the years set
   - Still add current year as fallback

2. **chartData** (lines 63-82): Change grouping from `opened` to `close_date`:
   - Skip options where `opt.close_date` is null
   - Use `new Date(opt.close_date)` for year check and month extraction
   - Everything else stays the same (premium calculation, rounding)

Specifically:

```typescript
const availableYears = useMemo(() => {
  const years = new Set<number>()
  for (const opt of shortOptions) {
    if (opt.close_date) {
      years.add(new Date(opt.close_date).getFullYear())
    }
  }
  years.add(new Date().getFullYear())
  return Array.from(years).sort((a, b) => b - a)
}, [shortOptions])
```

```typescript
const chartData = useMemo(() => {
  const months = MONTH_NAMES.map((name) => ({
    month: name,
    premium: 0,
  }))

  for (const opt of shortOptions) {
    if (!opt.close_date) continue
    const closeDate = new Date(opt.close_date)
    if (closeDate.getFullYear() !== selectedYear) continue

    const monthIdx = closeDate.getMonth()
    months[monthIdx].premium += opt.premium * opt.qty * 100
  }

  return months.map((m) => ({
    month: m.month,
    premium: Math.round(m.premium * 100) / 100,
  }))
}, [shortOptions, selectedYear])
```
  </action>
  <verify>Run `pnpm tsc --noEmit` -- no type errors</verify>
  <done>PremiumChart groups by close_date; year selector shows years from close_date; open options excluded</done>
</task>

<task type="auto">
  <name>Task 3: Update tests for close_date grouping</name>
  <files>src/lib/__tests__/options-shared.test.ts</files>
  <action>
Update the `buildPremiumByMonth` test suite (lines 967-1035) to test close_date grouping:

1. **"returns 12 months with zero fills"** -- no change needed (empty array test)

2. **"accumulates Wheel premium in correct month"** -- Change the test option to have a `close_date` in the target month. The `opened` date should be in a DIFFERENT month to prove we're grouping by close_date, not opened:
   - Set `opened: "2024-02-15"` and `close_date: "2024-03-20"` and `status: "Closed"`
   - March (index 2) should have the premium

3. **"accumulates LEAPS premium in correct month"** -- Same pattern: set `close_date` in the target month, `opened` in a different month

4. **"filters by year"** -- Change to use `close_date` for year filtering:
   - opt2023: `close_date: "2023-07-15"` (different year)
   - opt2024: `close_date: "2024-06-20"` (target year)
   - Only 2024 option should appear

5. **"VPCS strategy is not tracked separately in chart"** -- Add `close_date: "2024-03-20"` and `status: "Closed"`

6. **"multiple options in same month accumulate"** -- Change both options to have `close_date` in March 2024 (can have different `opened` dates)

7. **Add NEW test: "skips options without close_date (open positions)"**:
   ```typescript
   it("skips options without close_date (open positions)", () => {
     const openOpt = makeOption({
       Id: 1,
       strategy_type: "Wheel",
       opened: "2024-03-15",
       close_date: null,
       status: "Open",
       premium: 5.0,
       qty: 1,
     })
     const closedOpt = makeOption({
       Id: 2,
       strategy_type: "Wheel",
       opened: "2024-02-01",
       close_date: "2024-03-10",
       status: "Closed",
       premium: 2.0,
       qty: 1,
     })
     const result = buildPremiumByMonth([openOpt, closedOpt], 2024)
     // Only the closed option's premium should appear (200), not the open one (500)
     expect(result[2].wheel).toBe(200)
   })
   ```

8. **Add NEW test: "groups by close_date month, not opened month"**:
   ```typescript
   it("groups by close_date month, not opened month", () => {
     const opt = makeOption({
       Id: 1,
       strategy_type: "Wheel",
       opened: "2024-01-15",
       close_date: "2024-04-10",
       status: "Closed",
       premium: 3.0,
       qty: 1,
     })
     const result = buildPremiumByMonth([opt], 2024)
     // Should appear in April (index 3), NOT January (index 0)
     expect(result[0].wheel).toBe(0)  // January = 0
     expect(result[3].wheel).toBe(300)  // April = 300
   })
   ```
  </action>
  <verify>Run `pnpm test -- src/lib/__tests__/options-shared.test.ts` -- all tests pass</verify>
  <done>All buildPremiumByMonth tests updated to verify close_date grouping; new tests for open position exclusion and explicit close vs opened month distinction</done>
</task>

</tasks>

<verification>
1. `pnpm tsc --noEmit` -- no type errors
2. `pnpm test -- src/lib/__tests__/options-shared.test.ts` -- all tests pass
3. `pnpm lint` -- no lint errors
</verification>

<success_criteria>
- buildPremiumByMonth groups by close_date month, not opened month
- PremiumChart component groups by close_date month, not opened month
- PremiumChart year selector derives years from close_date
- Options without close_date (open positions) are excluded from premium chart
- PremiumChartSummary automatically fixed (consumes buildPremiumByMonth output from server)
- All existing tests updated, new tests added for close_date behavior
- Type check, tests, and lint all pass
</success_criteria>

<output>
After completion, create `.planning/quick/006-options-premium-group-by-close-date/006-SUMMARY.md`
</output>
