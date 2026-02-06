# Phase 2: Live Pricing & Core Calculations - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fetch live stock prices from FMP, store price history, expose a sync mechanism (manual + auto), and build the calculations engine that turns raw transactions into holdings with accurate P&L using Big.js decimal arithmetic. Users see: sync button + timestamp in sidebar, auto-sync on visit. Everything downstream (portfolio view, analytics, benchmarks) depends on this engine.

</domain>

<decisions>
## Implementation Decisions

### Price sync behavior
- Use FMP batch quotes endpoint to fetch multiple symbols per request (stay within 250/day free tier limit)
- Partial failure handling: keep prices that succeeded, log failures, show partial success indicator
- Next.js API route only (`/api/sync`) — no separate Python script. Triggered by button, cron, or auto-sync
- Fetch ALL roadmap fields: price, change%, day high/low, year high/low, PE, EPS, market cap, dividend yield
- ALSO fetch extended fundamental metrics: forward PE, PEG ratio, revenue growth, earnings growth, and other relevant FMP-available metrics — store per-symbol for rich stock detail views
- Include SPY and QQQ as tracked symbols (for benchmarking in Phase 7) even though user doesn't own them
- Fetch USD/GBP exchange rate as part of every sync
- Cache all FMP API responses in the database — if data already exists for a date/symbol, use cached version. Build local history over time for reuse in benchmarking and historical lookups

### Sync UI feedback
- "Last synced" shown as relative time ("5 minutes ago") — updates live without page refresh
- Sync Now button shows progress indicator ("Syncing 45/120...") while in progress
- After sync completes, auto-revalidate current page data so prices update in place (no manual refresh)
- Error feedback: Claude's discretion on best approach (toast vs indicator)
- Use SWR or React Query (Claude picks whichever fits better) for data fetching with great UX

### Holdings & P&L logic
- **Weighted average cost basis** (Section 104 pooling model, matches UK brokers)
  - Buys adjust the weighted average cost per share
  - Sells reduce share count at the existing average cost (don't change avg cost)
  - When position reaches 0 shares, pool resets — next buy starts fresh
- Track BOTH realised and unrealised P&L:
  - Realised P&L: accumulated from sells (shares sold × (sell price − avg cost at time of sale))
  - Unrealised P&L: remaining shares × (current price − avg cost)
  - Total P&L = realised + unrealised
- Prices display in native currency (USD for US stocks, GBP for LSE stocks)
- All aggregate stats, P&L totals, and portfolio summaries also shown in GBP (using synced FX rate)
- Aligns with HMRC Section 104 for simple cases; exact 30-day matching rules deferred to v2

### Data freshness policy
- Auto-sync + manual sync:
  - Auto-sync triggers if prices are >4 hours old
  - Also auto-sync after US market close even if within 4h window (always capture end-of-day prices)
  - Manual Sync Now button available anytime
- Daily auto-sync scheduled after US market close (~9-10 PM UK time)
- Price history: record a snapshot each time sync runs, accept gaps on missed days (no backfilling)
- All FMP data saved to database — build local cache/history for reuse, reduces future API calls

### Claude's Discretion
- Specific SWR vs React Query choice
- Error/failure UI treatment (toast, indicator, or combination)
- Exact progress indicator design during sync
- Which additional FMP fundamental metrics to include beyond the core set
- Auto-sync implementation (cron vs on-visit trigger vs both)
- How to cleanly display and store extended stock metrics

</decisions>

<specifics>
## Specific Ideas

- "I want data saved for all FMP calls you make, so if they already exist in the DB use that" — local caching philosophy, build history over time
- "Would be nice to have a lot more stock data like fwd metrics growth PEG etc and display those for each stock as well, find a nice way to do it" — rich per-symbol fundamental data beyond basic price
- "I need to be able to do either TWR or MWR based on the transaction timings and SPY or QQQ at that point in time" — price history for benchmarks matters (Phase 7 will consume this)
- "I need this for tax later" — GBP conversion is a tax requirement, not just a nice-to-have

</specifics>

<deferred>
## Deferred Ideas

- HMRC Section 104 exact 30-day matching rules — deferred to v2 (UK Tax phase)
- Historical price backfilling for missed days — not worth the API budget
- TWR/MWR calculation implementation — Phase 7 (Performance Analytics), but price history foundation laid here

</deferred>

---

*Phase: 02-live-pricing-core-calculations*
*Context gathered: 2026-02-06*
