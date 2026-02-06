---
created: 2026-02-06T00:00
title: Add capital gains tracking page for UK fiscal years
area: ui
files: []
---

## Problem

Need a dedicated page to track capital gains for stocks and options across UK fiscal years (6 Apr - 5 Apr) for HMRC tax reporting. Currently no way to see realised gains broken down by tax year.

This is distinct from the Phase 7 (UK Tax) deferral which covers full HMRC Section 104 pooling, same-day rules, and 30-day bed-and-breakfasting. This todo is about the **page and reporting UI** — showing capital gains per fiscal year to support self-assessment tax returns.

Key requirements:
- Track capital gains from stock disposals (buy/sell pairs)
- Track capital gains from options (premiums, assignments, expirations)
- Group by UK fiscal year (6 April to 5 April)
- Show per-asset breakdown within each year
- Support historical years (not just current)
- Label as "estimate" until full HMRC matching rules are implemented

Related roadmap context:
- Phase 7 (UK Tax Estimates) was deferred to v2
- REQUIREMENTS.md TAX-03: UK capital gains tax estimate using average cost basis
- Research extensively covers HMRC rules in .planning/research/PITFALLS.md and SUMMARY.md

## Solution

TBD — Likely a `/tax` or `/capital-gains` page added during or after v2 Phase 7. Could start with simple average cost basis (clearly labelled as estimate) and later upgrade to full Section 104 pooling. Needs realised gains calculation from Phase 6 (Realised P&L) as a prerequisite.
