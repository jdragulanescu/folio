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
  computeStats,
} from "./options-shared";
import type { OptionRecord, SymbolRecord } from "./types";
import type { OptionsPageData } from "./options-shared";

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
  computeCollateral,
  computeStats,
  buildPremiumByMonth,
  buildOptionsRows,
} from "./options-shared";

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
