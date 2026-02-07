// ============================================================================
// Options Server Data Assembly
// ============================================================================
// Server-only data fetching for the options dashboard. Pure computation
// functions live in options-shared.ts so client components can import them.
// ============================================================================

import "server-only"

import { getAllRecords, fetchParallel } from "./nocodb"
import { buildPremiumByMonth } from "./options-shared"
import type { OptionRecord, SymbolRecord } from "./types"
import type { OptionsStats, OptionsPageData } from "./options-shared"

// Re-export shared types and functions so existing server-side imports
// continue to work without changes.
export type {
  OptionsStats,
  RollChain,
  OptionsRow,
  LeapsDisplayRow,
  MonthlyPremium,
  OptionsPageData,
} from "./options-shared"

export {
  inferRollChains,
  computeLeapsDisplay,
  buildPremiumByMonth,
  buildOptionsRows,
} from "./options-shared"

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
