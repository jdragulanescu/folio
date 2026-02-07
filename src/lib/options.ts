// ============================================================================
// Options Server Data Assembly
// ============================================================================
// Server-only data fetching for the options dashboard. Pure computation
// functions live in options-shared.ts so client components can import them.
// ============================================================================

import "server-only";

import { getAllRecords, fetchParallel } from "./nocodb";
import {
  buildPremiumByMonth,
  computeProfit,
  computeDaysHeld,
  computeOpenLongPnl,
} from "./options-shared";
import type { OptionRecord, SymbolRecord } from "./types";
import type { OptionsStats, OptionsPageData } from "./options-shared";

// Re-export shared types and functions so existing server-side imports
// continue to work without changes.
export type {
  OptionsStats,
  RollChain,
  OptionsRow,
  LeapsDisplayRow,
  MonthlyPremium,
  OptionsPageData,
} from "./options-shared";

export {
  inferRollChains,
  computeLeapsDisplay,
  buildPremiumByMonth,
  buildOptionsRows,
} from "./options-shared";

// ---------------------------------------------------------------------------
// Stats Computation
// ---------------------------------------------------------------------------

const CLOSED_STATUSES: OptionRecord["status"][] = [
  "Closed",
  "Expired",
  "Assigned",
  "Rolled",
];

function computeStats(
  options: OptionRecord[],
  symbolPrices: Map<string, number>,
): OptionsStats {
  // Net P&L from sold options (credit received minus closing cost)
  const shortPnl = options
    .filter((o) => o.buy_sell === "Sell")
    .reduce((sum, o) => sum + (computeProfit(o) ?? o.premium * o.qty * 100), 0);

  // Net P&L from bought options
  // - Closed: use computeProfit (close_premium - premium)
  // - Open: use intrinsic value from current stock price
  // - Assigned: excluded (value transfers to stock portfolio)
  const longPnl = options
    .filter((o) => o.buy_sell === "Buy" && o.status !== "Assigned")
    .reduce((sum, o) => {
      const profit = computeProfit(o);
      if (profit != null) return sum + profit;
      // Open position: use intrinsic value if we have the stock price
      const price = symbolPrices.get(o.ticker);
      if (price != null) return sum + computeOpenLongPnl(o, price);
      return sum;
    }, 0);

  // Total commission (stored as negative per-contract values — multiply by qty)
  const totalCommission = options
    .filter((o) => o.commission != null)
    .reduce((sum, o) => sum + o.commission! * o.qty, 0);

  const totalPnl = shortPnl + longPnl - totalCommission;

  // Win rate: profitable closed positions / total closed positions
  const closedOptions = options.filter((o) =>
    CLOSED_STATUSES.includes(o.status),
  );
  const profitable = closedOptions.filter((o) => (computeProfit(o) ?? 0) > 0);
  const winRate =
    closedOptions.length > 0
      ? (profitable.length / closedOptions.length) * 100
      : 0;

  // Average days held for closed positions
  const closedWithDays = closedOptions.filter((o) => o.close_date != null);
  const avgDaysHeld =
    closedWithDays.length > 0
      ? closedWithDays.reduce((sum, o) => sum + computeDaysHeld(o), 0) /
        closedWithDays.length
      : 0;

  return {
    totalPnl,
    shortPnl,
    longPnl,
    totalCommission,
    winRate,
    avgDaysHeld,
  };
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
  );

  // Build symbol price lookup
  const symbolPrices = new Map<string, number>();
  for (const s of symbols) {
    if (s.current_price != null) {
      symbolPrices.set(s.symbol, s.current_price);
    }
  }

  const stats = computeStats(options, symbolPrices);

  // Default to current year if not specified
  const chartYear = year ?? new Date().getFullYear();
  const premiumByMonth = buildPremiumByMonth(options, chartYear);

  return {
    options,
    stats,
    // Convert Map to plain object for serialisation across server/client boundary
    symbolPrices: Object.fromEntries(symbolPrices),
    premiumByMonth,
  };
}
