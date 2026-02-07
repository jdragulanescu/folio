// ============================================================================
// Options Data Assembly
// ============================================================================
// Server-side data fetching and computation for the options dashboard.
// Handles roll chain inference, LEAPS derived columns, stat card metrics,
// and monthly premium chart data.
// ============================================================================

import "server-only"

import { differenceInDays } from "date-fns"

import { getAllRecords, fetchParallel } from "./nocodb"
import type { OptionRecord, SymbolRecord } from "./types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptionsStats {
  totalPremiumCollected: number
  capitalGainsPnl: number
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
// Roll Chain Inference
// ---------------------------------------------------------------------------

/** Maximum days between a rolled close_date and the next opened date */
const ROLL_PROXIMITY_DAYS = 5

/**
 * Infer roll chains from options data.
 *
 * Groups options by ticker, then for each "Rolled" option finds the next
 * option opened within ROLL_PROXIMITY_DAYS of the rolled option's close_date,
 * matching on the same call_put type. Chains are built forward: the last
 * element is the head (current position).
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
    // Sort by opened date ascending
    const sorted = [...tickerOptions].sort(
      (a, b) =>
        new Date(a.opened).getTime() - new Date(b.opened).getTime(),
    )

    // Find rolled options and build chains forward
    for (const opt of sorted) {
      if (opt.status !== "Rolled" || inChain.has(opt.Id)) continue

      const chain: OptionRecord[] = [opt]
      let current = opt

      while (current.status === "Rolled" && current.close_date) {
        const closeTime = new Date(current.close_date).getTime()
        const proximityMs = ROLL_PROXIMITY_DAYS * 86_400_000

        // Find next option for same ticker + call_put opened within proximity
        const next = sorted.find(
          (o) =>
            !inChain.has(o.Id) &&
            o.Id !== current.Id &&
            !chain.includes(o) &&
            o.call_put === current.call_put &&
            Math.abs(new Date(o.opened).getTime() - closeTime) <=
              proximityMs,
        )

        if (!next) break
        chain.push(next)
        current = next
      }

      if (chain.length > 1) {
        for (const c of chain) inChain.add(c.Id)
        chains.push({
          head: chain[chain.length - 1],
          legs: chain.slice(0, -1),
          totalProfit: chain.reduce(
            (sum, c) => sum + (c.profit ?? 0),
            0,
          ),
          totalPremium: chain.reduce((sum, c) => sum + c.premium, 0),
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
  const dte = differenceInDays(
    new Date(opt.expiration),
    new Date(),
  )
  const daysOpen = differenceInDays(new Date(), new Date(opt.opened))

  let intrinsicValue: number | null = null
  let extrinsicValue: number | null = null
  let costBasis: number | null = null
  let currentPnl: number | null = null
  let valueLostPerMonth: number | null = null

  if (currentPrice != null) {
    if (opt.call_put === "Call") {
      intrinsicValue = Math.max(0, currentPrice - opt.strike)
      costBasis = opt.strike + opt.premium
    } else {
      intrinsicValue = Math.max(0, opt.strike - currentPrice)
      costBasis = opt.strike - opt.premium
    }
    extrinsicValue = opt.premium - intrinsicValue

    // Time decay: value lost per month based on days open
    if (daysOpen > 0) {
      valueLostPerMonth = (extrinsicValue / daysOpen) * 30 * 100
    }

    // Current P&L based on intrinsic value vs cost basis
    currentPnl = (currentPrice - costBasis) * opt.qty * 100
  }

  return {
    ...opt,
    currentPrice,
    intrinsicValue,
    extrinsicValue,
    valueLostPerMonth,
    costBasis,
    premiumFeePct:
      opt.strike > 0 ? (opt.premium / opt.strike) * 100 : null,
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
 * Groups options by the month of their `opened` date. For each month,
 * sums premium separately for Wheel and LEAPS strategy types.
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

  // Accumulate premium by month
  for (const opt of options) {
    const opened = new Date(opt.opened)
    if (opened.getFullYear() !== year) continue

    const month = opened.getMonth()
    const entry = monthMap.get(month)!

    if (opt.strategy_type === "Wheel") {
      entry.wheel += opt.premium
    } else if (opt.strategy_type === "LEAPS") {
      entry.leaps += opt.premium
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
    const legRows: OptionsRow[] = chain.legs.map((leg) => ({
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

// ---------------------------------------------------------------------------
// Stats Computation
// ---------------------------------------------------------------------------

const CLOSED_STATUSES: OptionRecord["status"][] = [
  "Closed",
  "Expired",
  "Assigned",
  "Rolled",
]

function computeStats(options: OptionRecord[]): OptionsStats {
  // Total premium collected from sold options
  const totalPremiumCollected = options
    .filter((o) => o.buy_sell === "Sell")
    .reduce((sum, o) => sum + o.premium, 0)

  // Capital gains P&L from assigned options
  const capitalGainsPnl = options
    .filter((o) => o.status === "Assigned")
    .reduce((sum, o) => sum + (o.profit ?? 0), 0)

  // Win rate: profitable closed positions / total closed positions
  const closedOptions = options.filter((o) =>
    CLOSED_STATUSES.includes(o.status),
  )
  const profitable = closedOptions.filter(
    (o) => (o.profit ?? 0) > 0,
  )
  const winRate =
    closedOptions.length > 0
      ? (profitable.length / closedOptions.length) * 100
      : 0

  // Average days held for closed positions (ignore nulls)
  const closedWithDays = closedOptions.filter(
    (o) => o.days_held != null,
  )
  const avgDaysHeld =
    closedWithDays.length > 0
      ? closedWithDays.reduce((sum, o) => sum + o.days_held!, 0) /
        closedWithDays.length
      : 0

  return {
    totalPremiumCollected,
    capitalGainsPnl,
    winRate,
    avgDaysHeld,
  }
}

// ---------------------------------------------------------------------------
// Main Data Assembly
// ---------------------------------------------------------------------------

/**
 * Fetch and assemble all data needed for the options page.
 *
 * Fetches all options and symbols in parallel, computes stats, builds
 * the premium chart data, and returns a serialisation-safe object.
 */
export async function getOptionsPageData(
  year?: number,
): Promise<OptionsPageData> {
  const [options, symbols] = await fetchParallel<
    [OptionRecord[], SymbolRecord[]]
  >(
    () => getAllRecords<OptionRecord>("options"),
    () =>
      getAllRecords<SymbolRecord>("symbols", {
        fields: ["symbol", "current_price"],
      }),
  )

  // Build symbol price lookup
  const symbolPrices = new Map<string, number>()
  for (const s of symbols) {
    if (s.current_price != null) {
      symbolPrices.set(s.symbol, s.current_price)
    }
  }

  const stats = computeStats(options)

  // Default to current year if not specified
  const chartYear = year ?? new Date().getFullYear()
  const premiumByMonth = buildPremiumByMonth(options, chartYear)

  return {
    options,
    stats,
    // Convert Map to plain object for serialisation across server/client boundary
    symbolPrices: Object.fromEntries(symbolPrices),
    premiumByMonth,
  }
}
