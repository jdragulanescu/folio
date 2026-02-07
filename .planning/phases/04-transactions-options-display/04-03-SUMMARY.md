---
phase: "04"
plan: "03"
subsystem: "ui"
tags: ["options", "tanstack-table", "tabs", "roll-chains", "leaps", "wheel", "stat-cards", "expiry-highlighting"]

requires:
  - phase: "04-01"
    provides: "options data assembly, format utilities, buildOptionsRows, computeLeapsDisplay, OptionsPageData"
  - phase: "01-02"
    provides: "NocoDB REST client, OptionRecord type definitions"
provides:
  - "Options dashboard page with Wheel/LEAPS/All tabs"
  - "Roll chain expandable rows in Wheel table"
  - "LEAPS derived columns (intrinsic, extrinsic, current P&L)"
  - "Stat cards for overall options performance"
  - "Expiry highlighting (amber <=7 DTE, red past due)"
affects: ["04-04", "05-01"]

tech-stack:
  added: []
  patterns: ["expandable-sub-rows-tanstack-table", "tab-based-dashboard-layout", "server-component-data-fetch-to-client-dashboard"]

key-files:
  created:
    - "src/components/options/options-columns.tsx"
    - "src/components/options/options-stat-cards.tsx"
    - "src/components/options/wheel-table.tsx"
    - "src/components/options/leaps-table.tsx"
    - "src/components/options/all-options-table.tsx"
    - "src/components/options/options-dashboard.tsx"
  modified:
    - "src/app/options/page.tsx"

key-decisions:
  - "Stat cards placed above tabs to always show overall totals regardless of active tab"
  - "LEAPS table uses flat rows (no roll chain expansion) for simplicity since LEAPS rarely have roll chains"
  - "All tab uses flat OptionsRow[] without roll chain grouping for a unified view"
  - "Status badges use outline variant with custom color classes per status type"

patterns-established:
  - "Expandable TanStack Table rows: getExpandedRowModel + getSubRows for parent/child row rendering"
  - "Row styling by business logic: conditional className based on DTE and status for visual cues"
  - "Sortable columns with null-bottom sort for optional numeric fields"

duration: 2min
completed: 2026-02-07
---

# Phase 4 Plan 03: Options Dashboard UI Summary

**Options dashboard with Wheel/LEAPS/All tabbed tables, expandable roll chain rows, LEAPS intrinsic/extrinsic columns, expiry highlighting, and four stat cards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T00:51:29Z
- **Completed:** 2026-02-07T00:53:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Complete options dashboard with three tabs (Wheel, LEAPS, All) rendering strategy-specific tables
- Wheel table with expandable roll chain sub-rows showing cumulative P&L on chain heads and individual P&L on legs
- LEAPS table wiring symbol current prices through computeLeapsDisplay for intrinsic/extrinsic value and current P&L
- Stat cards displaying overall totals (Premium Collected, Capital Gains P&L, Win Rate, Avg Days Held) independent of tab state
- Expiry highlighting: red background for past-due open positions, amber for DTE <= 7, dimmed opacity for closed positions
- All profit/loss values color-coded green (gain) and red (loss) throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create column definitions and stat cards** - `8908820` (feat)
2. **Task 2: Create Wheel, LEAPS, All tables and dashboard page** - `605ef6c` (feat)

## Files Created/Modified

- `src/components/options/options-columns.tsx` - Three column definition sets (wheelColumns, leapsColumns, allColumns) with sortable headers, status badges, DTE cells, and null-safe sorting
- `src/components/options/options-stat-cards.tsx` - Four stat cards: Premium Collected, Capital Gains P&L, Win Rate, Avg Days Held with icons and P&L coloring
- `src/components/options/wheel-table.tsx` - Wheel positions table with expandable roll chain sub-rows, expiry highlighting, and dimmed closed rows
- `src/components/options/leaps-table.tsx` - LEAPS positions table with current price, intrinsic/extrinsic values, and current P&L computed from symbol prices
- `src/components/options/all-options-table.tsx` - Unified flat table of all options with strategy_type column
- `src/components/options/options-dashboard.tsx` - Tab container orchestrating stat cards and Wheel/LEAPS/All tab content
- `src/app/options/page.tsx` - Server Component fetching options data and rendering OptionsDashboard

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Stat cards above tabs, not inside | Always show overall totals regardless of which tab is active |
| 2 | LEAPS table flat (no roll chain expansion) | LEAPS rarely have roll chains; simpler UX with individual rows showing "Rolled" status badge |
| 3 | All tab shows flat OptionsRow without chains | Unified view for quick scanning across all strategies without grouping complexity |
| 4 | Outline badge variant with custom color classes | Consistent with existing pattern, distinguishes status types clearly |
| 5 | Win Rate displayed without sign prefix | Win rate is always 0-100%, sign prefix would be misleading |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Options dashboard complete, covering OPTS-01 through OPTS-06
- Plan 04-04 (responsive polish) can proceed with both transactions and options pages available
- Premium chart component (using premiumByMonth data from OptionsPageData) could be added in 04-04 or Phase 8

---
*Phase: 04-transactions-options-display*
*Completed: 2026-02-07*
