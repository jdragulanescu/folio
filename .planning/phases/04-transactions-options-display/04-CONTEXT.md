# Phase 4: Transactions & Options Display - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Two read-only display pages: a transaction history browser and an options dashboard with Wheel, LEAPS, and All tabs. No create/edit/delete — write operations belong in Phase 6. The premium chart appears on both the options page (full) and portfolio overview (summary card).

</domain>

<decisions>
## Implementation Decisions

### Transaction table layout
- Row density: Claude's discretion based on data density and column count
- Buy/Sell type distinguished with colored pill badges (green Buy, red Sell)
- Mobile behavior: Claude's discretion — responsive best-practice approach (user wants it to feel right, not prescriptive)
- Pagination: infinite scroll / progressive loading — show first 50, load more as user scrolls (~960 total transactions)
- Columns per roadmap: date, symbol, name, type (badge), price, shares, amount, platform, EPS
- Default sort: date descending
- Filters: symbol search, platform dropdown, date range picker, buy/sell toggle

### Options dashboard structure
- Three tabs: Wheel, LEAPS, All
- Stat cards (total premium, capital gains P&L, win rate, avg days held) always show overall totals regardless of active tab
- All tab shows a unified table of all options (Wheel + LEAPS + other) with a type/strategy column
- Wheel tab: single table with Open/Closed status column (not split into two tables)
- LEAPS tab: shows both open and closed positions with status column
- Wheel tracks sold options; LEAPS tracks bought options
- LEAPS has additional columns beyond Wheel: Intrinsic Value, Extrinsic Value, Value lost/month (x100), Cost Basis, Premium fee percentage — Claude decides display treatment

### Roll chain grouping
- Both Wheel and LEAPS support roll chains (close one position, open new at different strike/expiry)
- Default view: indented sub-rows showing roll history under the current/latest position
- Optional chain view available via table settings (a chain/group column for filtering/sorting by roll sequence)
- Parent row shows cumulative P&L across all rolls in the chain
- Each sub-row (individual roll leg) shows its own individual P&L
- Roll grouping applies to both Wheel and LEAPS strategies

### Expiry highlighting & status
- DTE color thresholds and indicator style: Claude's discretion (roadmap specifies amber <7d, red past due)
- Closed positions: combination of dimmed rows and clear status badges (Closed, Expired, Assigned) — Claude decides the exact visual balance
- Profit/loss on closed positions: green text for gains, red text for losses (standard financial coloring, no arrows)

### Premium chart design
- Monthly premium bar chart — Claude decides best grouping approach (stacked vs side-by-side) based on data shape (Wheel is primary, LEAPS secondary)
- Year selector dropdown to switch between years (default: current year)
- Cumulative total line overlay: Claude's discretion
- Chart appears in two places: full version on options page, smaller summary version on portfolio overview page

### Claude's Discretion
- Transaction table row density
- Mobile responsive strategy for transaction table
- DTE indicator visual treatment (badge vs dot vs other)
- DTE color states (warn-only vs three-state green/amber/red)
- Exact closed position dimming + badge balance
- Premium chart bar grouping style (stacked vs side-by-side)
- Cumulative premium line overlay (yes/no)
- LEAPS additional column display layout (Intrinsic Value, Extrinsic Value, Value lost/month, Cost Basis, Premium fee %)

</decisions>

<specifics>
## Specific Ideas

- Roll chain display is important — rolling is a common way user manages options, needs first-class grouping
- User tracks Wheel as sold options only, LEAPS as bought options only — different column sets reflect this
- Premium chart was limited in the original spreadsheet — user wants the best possible visualization now that they have a real dashboard
- Small premium chart summary should appear on portfolio overview (Phase 3 page) in addition to the full chart on options page

</specifics>

<deferred>
## Deferred Ideas

- Close/Roll option workflow (creating roll chains via forms) — Phase 6 scope
- Editing existing options or transactions — Phase 6 scope

</deferred>

---

*Phase: 04-transactions-options-display*
*Context gathered: 2026-02-06*
