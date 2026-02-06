# Phase 3: Portfolio Overview - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Primary dashboard page showing all current holdings with live prices, P&L, allocation breakdowns, and top movers. This is the main page users see at `/`. Includes a symbol detail drill-down. Does NOT include write operations (Phase 6), performance analytics (Phase 7), or unified options view (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Holdings table
- Core columns visible by default (~6 key columns), with table settings to toggle additional columns on/off
- Column visibility preferences persisted across sessions (localStorage or similar)
- Default sort: weight descending
- All columns sortable by clicking column headers
- Filterable by symbol search
- Only symbols with shares > 0 shown (fully sold positions excluded)
- P&L and day change values coloured green/red (gains/losses) — classic finance convention, no badges/arrows
- Table density: Claude's discretion based on column count and data volume

### Summary cards
- 5 metrics to display: total portfolio value, total P&L, day change, total deposited, options premium collected
- Card hierarchy and grouping: Claude's discretion — some metrics may share a card, layout should be visually impressive yet practical
- P&L displayed as both absolute amount and percentage (e.g. £12,345 (+15.2%))
- Sparklines/trend indicators: Claude's discretion per card
- Per-broker breakdown: NOT on main dashboard — drill-down only

### Allocation charts
- Sector and strategy donut charts
- Charts positioned beside the holdings table (side-by-side layout)
- Interactivity level: Claude's discretion (hover tooltips likely, click-to-filter optional)
- Small allocation handling: Claude's discretion (grouping threshold for 'Other' slice)
- Centre label/value: Claude's discretion — user likes clean design, explore what shadcn/Recharts offers
- Donut style should align with shadcn component patterns

### Top movers
- Top 5 gainers and top 5 losers
- Metric (day change vs overall P&L) and display style: Claude's discretion
- Card/list style: Claude's discretion based on dashboard layout

### Symbol drill-down
- Clicking a symbol navigates to a dedicated symbol detail page
- Symbol page shows: position summary (shares, avg cost, current value, total P&L, weight) AND fundamentals (PE, EPS, market cap, dividend yield, 52-week range)
- Transaction list for that symbol displayed on the detail page

### Claude's Discretion
- Table density (compact vs comfortable)
- Summary card hierarchy, grouping, and sparkline usage
- Donut chart interactivity level and small-slice threshold
- Donut centre label treatment
- Top movers metric choice and visual style
- Symbol drill-down navigation pattern (likely new page, but could be sheet/panel if better UX emerges)

</decisions>

<specifics>
## Specific Ideas

- "Should be an amazing looking but also practical dashboard" — visual quality matters, not just functional
- User prefers clean design aesthetic — explore shadcn chart components for donut style
- Column persistence across sessions is important — user wants their table customisation remembered
- Broker breakdown is explicitly a drill-down concern, not main page clutter

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-portfolio-overview*
*Context gathered: 2026-02-06*
