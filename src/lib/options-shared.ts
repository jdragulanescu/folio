// ============================================================================
// Shared Options Utilities
// ============================================================================
// Pure functions and types used by both server (options.ts) and client
// components. This file must NOT import "server-only" or any server-only
// modules.
// ============================================================================

import { differenceInDays } from "date-fns"

import type { OptionRecord } from "./types"

// ---------------------------------------------------------------------------
// Strategy Constants
// ---------------------------------------------------------------------------

export const SHORT_STRATEGIES = ["Wheel", "Collar", "VPCS", "PMCC"] as const
export const LONG_STRATEGIES = ["LEAPS", "BET", "Hedge"] as const

export type ShortStrategy = (typeof SHORT_STRATEGIES)[number]
export type LongStrategy = (typeof LONG_STRATEGIES)[number]

export function isShortStrategy(type: string): type is ShortStrategy {
  return (SHORT_STRATEGIES as readonly string[]).includes(type)
}

export function isLongStrategy(type: string): type is LongStrategy {
  return (LONG_STRATEGIES as readonly string[]).includes(type)
}

// ---------------------------------------------------------------------------
// Derived Field Calculations
// ---------------------------------------------------------------------------
// These replace the pre-calculated DB fields (profit, days_held, return_pct,
// annualised_return_pct). Premium and close_premium are per-share; collateral
// is computed from strike/outer_strike/qty.
// ---------------------------------------------------------------------------

/**
 * Compute collateral from strike, outer_strike, and qty.
 * - Spread (outer_strike present): |strike - outer_strike| × qty × 100
 * - Cash-secured (no outer_strike): strike × qty × 100
 * Only meaningful for short (sell) strategies.
 */
export function computeCollateral(opt: OptionRecord): number | null {
  if (opt.buy_sell !== "Sell") return null
  if (opt.outer_strike != null) {
    return Math.abs(opt.strike - opt.outer_strike) * opt.qty * 100
  }
  return opt.strike * opt.qty * 100
}

/**
 * Calculate profit from raw option fields.
 * Sell: credit received minus debit paid = (premium - close_premium) × qty × 100
 * Buy:  proceeds minus cost = (close_premium - premium) × qty × 100
 */
export function computeProfit(opt: OptionRecord): number | null {
  // Expired/Assigned: treat null close_premium as 0 (expired worthless / exercised)
  const closePremium =
    opt.close_premium ??
    (opt.status === "Expired" || opt.status === "Assigned" ? 0 : null)
  if (closePremium == null) return null
  if (opt.buy_sell === "Sell") {
    return (opt.premium - closePremium) * opt.qty * 100
  }
  return (closePremium - opt.premium) * opt.qty * 100
}

/**
 * Calculate current P&L for an open bought option using intrinsic value.
 * Call: (max(0, currentPrice - strike) - premium) × qty × 100
 * Put:  (max(0, strike - currentPrice) - premium) × qty × 100
 */
export function computeOpenLongPnl(
  opt: OptionRecord,
  currentPrice: number,
): number {
  const intrinsic =
    opt.call_put === "Call"
      ? Math.max(0, currentPrice - opt.strike)
      : Math.max(0, opt.strike - currentPrice)
  return (intrinsic - opt.premium) * opt.qty * 100
}

/**
 * Calculate days held.
 * Closed positions: difference between close_date and opened.
 * Open positions: difference between today and opened.
 */
export function computeDaysHeld(opt: OptionRecord): number {
  const endDate = opt.close_date ? new Date(opt.close_date) : new Date()
  return differenceInDays(endDate, new Date(opt.opened))
}

/**
 * Calculate return percentage.
 * Short options: annualised return on collateral = (profit / collateral) × (365 / daysHeld)
 * Long options: profit yield = profit / cost basis
 */
export function computeReturnPct(opt: OptionRecord): number | null {
  const profit = computeProfit(opt)
  const daysHeld = computeDaysHeld(opt)
  if (profit == null || daysHeld <= 0) return null

  if (isShortStrategy(opt.strategy_type)) {
    const collateral = computeCollateral(opt)
    if (collateral == null || collateral <= 0) return null
    return (profit / collateral) * (365 / daysHeld) * 100
  }
  // Long options: profit yield as percentage
  const costBasis = opt.premium * opt.qty * 100
  if (costBasis <= 0) return null
  return (profit / costBasis) * 100
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptionsStats {
  totalPnl: number
  shortPnl: number
  longPnl: number
  totalCommission: number
  winRate: number
  avgDaysHeld: number
}

export interface RollChain {
  /** The current/head position (latest in the chain) */
  head: OptionRecord
  /** Previous legs in the chain, oldest first */
  legs: OptionRecord[]
  /** Cumulative P&L across all legs */
  totalProfit: number
  /** Total premium collected/paid across all legs */
  totalPremium: number
}

export interface OptionsRow {
  option: OptionRecord
  isChainHead: boolean
  cumulativeProfit: number | null
  cumulativePremium: number | null
  subRows?: OptionsRow[]
}

export interface LeapsDisplayRow extends OptionRecord {
  currentPrice: number | null
  intrinsicValue: number | null
  extrinsicValue: number | null
  valueLostPerMonth: number | null
  costBasis: number | null
  premiumFeePct: number | null
  daysToExpiry: number
  currentPnl: number | null
}

export interface MonthlyPremium {
  month: string
  wheel: number
  leaps: number
}

export interface OptionsPageData {
  options: OptionRecord[]
  stats: OptionsStats
  symbolPrices: Record<string, number>
  premiumByMonth: MonthlyPremium[]
}

// ---------------------------------------------------------------------------
// Stats Computation
// ---------------------------------------------------------------------------

const CLOSED_STATUSES: OptionRecord["status"][] = [
  "Closed",
  "Expired",
  "Assigned",
  "Rolled",
]

/**
 * Compute aggregate options statistics.
 *
 * @param symbolPrices - Map of ticker → current price, used for open long P&L
 */
export function computeStats(
  options: OptionRecord[],
  symbolPrices: Map<string, number>,
): OptionsStats {
  // Net P&L from sold options (credit received minus closing cost)
  const shortPnl = options
    .filter((o) => o.buy_sell === "Sell")
    .reduce(
      (sum, o) => sum + (computeProfit(o) ?? o.premium * o.qty * 100),
      0,
    )

  // Net P&L from bought options
  // - Closed: use computeProfit (close_premium - premium)
  // - Open: use intrinsic value from current stock price
  // - Assigned: excluded (value transfers to stock portfolio)
  const longPnl = options
    .filter((o) => o.buy_sell === "Buy" && o.status !== "Assigned")
    .reduce((sum, o) => {
      const profit = computeProfit(o)
      if (profit != null) return sum + profit
      // Open position: use intrinsic value if we have the stock price
      const price = symbolPrices.get(o.ticker)
      if (price != null) return sum + computeOpenLongPnl(o, price)
      return sum
    }, 0)

  // Total commission as a positive cost (abs handles either sign convention)
  const totalCommission = options
    .filter((o) => o.commission != null)
    .reduce((sum, o) => sum + Math.abs(o.commission!) * o.qty, 0)

  const totalPnl = shortPnl + longPnl - totalCommission

  // Win rate: profitable closed positions / total closed positions
  const closedOptions = options.filter((o) =>
    CLOSED_STATUSES.includes(o.status),
  )
  const profitable = closedOptions.filter(
    (o) => (computeProfit(o) ?? 0) > 0,
  )
  const winRate =
    closedOptions.length > 0
      ? (profitable.length / closedOptions.length) * 100
      : 0

  // Average days held for closed positions
  const closedWithDays = closedOptions.filter((o) => o.close_date != null)
  const avgDaysHeld =
    closedWithDays.length > 0
      ? closedWithDays.reduce((sum, o) => sum + computeDaysHeld(o), 0) /
        closedWithDays.length
      : 0

  return {
    totalPnl,
    shortPnl,
    longPnl,
    totalCommission,
    winRate,
    avgDaysHeld,
  }
}

// ---------------------------------------------------------------------------
// Roll Chain Inference
// ---------------------------------------------------------------------------

/**
 * Maximum days after a rolled close_date to look for the next leg.
 * Generous window — closest match wins, so false positives are unlikely.
 */
const ROLL_MAX_DAYS_AFTER = 30

/** Allow the next leg to have opened up to 14 days before the close (early replacement) */
const ROLL_MAX_DAYS_BEFORE = 14

/**
 * Candidate priority for next-leg selection.
 * Close-date matches are more reliable than opened-date matches.
 * Rolled options must belong to a chain, so they get priority within each tier.
 *
 *   0 = Rolled + close match   (best)
 *   1 = Non-Rolled + close match
 *   2 = Rolled + opened match
 *   3 = Non-Rolled + opened match  (worst)
 */
function candidatePriority(isCloseMatch: boolean, isRolled: boolean): number {
  if (isCloseMatch) return isRolled ? 0 : 1
  return isRolled ? 2 : 3
}

/**
 * Infer roll chains from options data.
 *
 * Groups options by ticker, then for each "Rolled" option finds the best
 * next option opened near the rolled option's close_date (or opened date as
 * fallback), matching on the same call_put type. Chains are built forward:
 * the last element is the head (current position).
 */
export function inferRollChains(options: OptionRecord[]): {
  chains: RollChain[]
  standalone: OptionRecord[]
} {
  // Group by ticker
  const byTicker = new Map<string, OptionRecord[]>()
  for (const opt of options) {
    const group = byTicker.get(opt.ticker) ?? []
    group.push(opt)
    byTicker.set(opt.ticker, group)
  }

  const chains: RollChain[] = []
  const inChain = new Set<number>()

  for (const [, tickerOptions] of byTicker) {
    // Sort by opened date ascending; tiebreaker: earlier close first so the
    // option that needs to chain through the other gets processed first.
    const sorted = [...tickerOptions].sort((a, b) => {
      const diff =
        new Date(a.opened).getTime() - new Date(b.opened).getTime()
      if (diff !== 0) return diff
      const aClose = a.close_date
        ? new Date(a.close_date).getTime()
        : Infinity
      const bClose = b.close_date
        ? new Date(b.close_date).getTime()
        : Infinity
      return aClose - bClose
    })

    // Find rolled options and build chains forward
    for (const opt of sorted) {
      if (opt.status !== "Rolled" || inChain.has(opt.Id)) continue

      const chain: OptionRecord[] = [opt]
      let current = opt

      while (current.status === "Rolled" && current.close_date) {
        const closeTime = new Date(current.close_date).getTime()
        const openedTime = new Date(current.opened).getTime()
        const beforeMs = ROLL_MAX_DAYS_BEFORE * 86_400_000
        const afterMs = ROLL_MAX_DAYS_AFTER * 86_400_000

        // Find the best next leg using a 4-tier priority system:
        //   close-date matches > opened-date matches
        //   Rolled candidates > terminal statuses (within same tier)
        let best: OptionRecord | undefined
        let bestPriority = 4
        let bestGap = Infinity

        for (const o of sorted) {
          if (inChain.has(o.Id) || o.Id === current.Id || chain.includes(o))
            continue
          if (o.call_put !== current.call_put) continue

          const candidateTime = new Date(o.opened).getTime()
          const gapFromClose = candidateTime - closeTime
          const gapFromOpened = candidateTime - openedTime

          const validFromClose =
            gapFromClose >= -beforeMs && gapFromClose <= afterMs
          const validFromOpened =
            gapFromOpened >= 0 && gapFromOpened <= afterMs

          if (!validFromClose && !validFromOpened) continue

          const isCloseMatch = validFromClose
          const gap = isCloseMatch
            ? Math.abs(gapFromClose)
            : gapFromOpened
          const priority = candidatePriority(
            isCloseMatch,
            o.status === "Rolled",
          )

          if (
            priority < bestPriority ||
            (priority === bestPriority && gap < bestGap)
          ) {
            best = o
            bestPriority = priority
            bestGap = gap
          }
        }

        if (!best) break
        chain.push(best)
        current = best
      }

      if (chain.length > 1) {
        for (const c of chain) inChain.add(c.Id)
        chains.push({
          head: chain[chain.length - 1],
          legs: chain.slice(0, -1),
          totalProfit: chain.reduce(
            (sum, c) => sum + (computeProfit(c) ?? 0),
            0,
          ),
          totalPremium: chain.reduce(
            (sum, c) => sum + c.premium * c.qty * 100,
            0,
          ),
        })
      }
    }
  }

  const standalone = options.filter((o) => !inChain.has(o.Id))
  return { chains, standalone }
}

// ---------------------------------------------------------------------------
// LEAPS Display Computations
// ---------------------------------------------------------------------------

/**
 * Compute derived display fields for a LEAPS option.
 *
 * Intrinsic value, extrinsic value, cost basis, P&L, and time decay are
 * computed from the underlying stock's current price and the option's
 * strike/premium.
 */
export function computeLeapsDisplay(
  opt: OptionRecord,
  currentPrice: number | null,
): LeapsDisplayRow {
  const dte =
    opt.status === "Open"
      ? differenceInDays(new Date(opt.expiration), new Date())
      : 0
  const initialDte = differenceInDays(
    new Date(opt.expiration),
    new Date(opt.opened),
  )

  let intrinsicValue: number | null = null
  let extrinsicValue: number | null = null
  let costBasis: number | null = null
  let valueLostPerMonth: number | null = null

  if (currentPrice != null) {
    if (opt.call_put === "Call") {
      intrinsicValue = currentPrice - opt.strike
      costBasis = opt.strike + opt.premium
    } else {
      intrinsicValue = opt.strike - currentPrice
      costBasis = opt.strike - opt.premium
    }
    extrinsicValue = opt.premium - intrinsicValue

    // Time decay: extrinsic spread over the option's total lifespan
    if (initialDte > 0) {
      valueLostPerMonth = (extrinsicValue / initialDte) * 30 * 100
    }
  }

  // P&L: use close_premium for closed options, intrinsic value for open
  const closedPnl = computeProfit(opt)
  const currentPnl =
    closedPnl != null
      ? closedPnl
      : currentPrice != null && opt.buy_sell === "Buy"
        ? computeOpenLongPnl(opt, currentPrice)
        : null

  return {
    ...opt,
    currentPrice,
    intrinsicValue,
    extrinsicValue,
    valueLostPerMonth,
    costBasis,
    premiumFeePct:
      currentPrice != null && currentPrice > 0 && extrinsicValue != null
        ? (extrinsicValue / currentPrice) * 100
        : null,
    daysToExpiry: dte,
    currentPnl,
  }
}

// ---------------------------------------------------------------------------
// Premium Chart Data
// ---------------------------------------------------------------------------

/** Month name abbreviations for chart labels */
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Build monthly premium chart data for a given year.
 *
 * Groups options by the month of their `close_date` (when premium was
 * realized). Options without a close_date (open positions) are excluded.
 * Sums premium separately for Wheel and LEAPS strategy types.
 * Zero-fills months with no data. Returns 12 entries (Jan-Dec).
 */
export function buildPremiumByMonth(
  options: OptionRecord[],
  year: number,
): MonthlyPremium[] {
  // Initialise all 12 months with zero values
  const monthMap = new Map<number, { wheel: number; leaps: number }>()
  for (let m = 0; m < 12; m++) {
    monthMap.set(m, { wheel: 0, leaps: 0 })
  }

  // Accumulate realised profit by close_date month
  for (const opt of options) {
    if (!opt.close_date) continue // skip open positions
    const closeDate = new Date(opt.close_date)
    if (closeDate.getFullYear() !== year) continue

    const profit = computeProfit(opt)
    if (profit == null) continue

    const month = closeDate.getMonth()
    const entry = monthMap.get(month)!

    if (opt.strategy_type === "Wheel") {
      entry.wheel += profit
    } else if (opt.strategy_type === "LEAPS") {
      entry.leaps += profit
    }
    // Spread strategy falls through (not tracked separately in chart)
  }

  return MONTH_NAMES.map((name, i) => {
    const entry = monthMap.get(i)!
    return {
      month: name,
      wheel: Math.round(entry.wheel * 100) / 100,
      leaps: Math.round(entry.leaps * 100) / 100,
    }
  })
}

// ---------------------------------------------------------------------------
// Options Rows (for TanStack Table with sub-rows)
// ---------------------------------------------------------------------------

/**
 * Build display rows from options data, grouping roll chains as expandable
 * sub-rows under their chain head.
 */
export function buildOptionsRows(options: OptionRecord[]): OptionsRow[] {
  const { chains, standalone } = inferRollChains(options)

  const rows: OptionsRow[] = []

  // Chain head rows with sub-rows
  for (const chain of chains) {
    const legRows: OptionsRow[] = [...chain.legs].reverse().map((leg) => ({
      option: leg,
      isChainHead: false,
      cumulativeProfit: null,
      cumulativePremium: null,
    }))

    rows.push({
      option: chain.head,
      isChainHead: true,
      cumulativeProfit: chain.totalProfit,
      cumulativePremium: chain.totalPremium,
      subRows: legRows,
    })
  }

  // Standalone rows (not part of any chain)
  for (const opt of standalone) {
    rows.push({
      option: opt,
      isChainHead: false,
      cumulativeProfit: null,
      cumulativePremium: null,
    })
  }

  return rows
}
