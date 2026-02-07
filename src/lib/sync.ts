import "server-only"

import logger from "./logger"
import {
  createRecord,
  createRecords,
  getAllRecords,
  listRecords,
  updateRecord,
  updateRecords,
} from "./nocodb"
import { provider } from "./providers"
import type { StockQuote, FundamentalsData } from "./providers"
import type {
  FundamentalsHistoryRecord,
  PriceHistoryRecord,
  SettingRecord,
  SymbolRecord,
} from "./types"

// ============================================================================
// Sync Orchestration
// ============================================================================
// Coordinates the full price-refresh pipeline: provider fetch -> NocoDB symbol
// update -> price_history insert -> forex rate -> last_synced timestamp.
// Yields progress events as an async generator for streaming to the client.
// ============================================================================

const log = logger.child({ module: "sync" })

// ---------------------------------------------------------------------------
// Progress Event Types
// ---------------------------------------------------------------------------

export type SyncProgress =
  | { type: "start"; total: number }
  | { type: "progress"; completed: number; total: number; batch: number }
  | { type: "complete"; timestamp: string; updated: number; failed: number }
  | { type: "error"; message: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Symbols per provider batch quote request (partial-failure boundary). */
const BATCH_SIZE = 30

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a setting by key. Queries for an existing row and updates it,
 * or creates a new one if it doesn't exist yet.
 */
async function upsertSetting(
  key: string,
  value: string,
  description: string | null = null,
): Promise<void> {
  const existing = await listRecords<SettingRecord>("settings", {
    where: `(key,eq,${key})`,
  })

  if (existing.list.length > 0) {
    await updateRecord<SettingRecord>("settings", existing.list[0].Id, {
      value,
    })
  } else {
    await createRecord<SettingRecord>("settings", { key, value, description })
  }
}

// ---------------------------------------------------------------------------
// Main Sync Generator
// ---------------------------------------------------------------------------

/**
 * Run a full price sync.
 *
 * 1. Fetches all symbols from NocoDB
 * 2. Batches them into groups of 30
 * 3. For each batch: fetch quotes via provider, update symbols, insert price_history
 * 4. Fetches USD/GBP forex rate and stores in settings
 * 5. Updates "last_synced" timestamp in settings
 *
 * Yields {@link SyncProgress} events for real-time client feedback.
 * Partial failures (individual batch errors) do not abort the entire sync.
 */
export async function* runSync(): AsyncGenerator<SyncProgress> {
  log.info("starting sync")

  const symbols = await getAllRecords<SymbolRecord>("symbols")
  const total = symbols.length

  log.info({ total }, "symbols loaded from NocoDB")
  yield { type: "start", total }

  if (total === 0) {
    log.warn("no symbols to sync")
    const timestamp = new Date().toISOString()
    await upsertSetting("last_synced", timestamp, "Last successful price sync")
    yield { type: "complete", timestamp, updated: 0, failed: 0 }
    return
  }

  // Build a map of ticker -> NocoDB row Id for bulk updates (normalized)
  const symbolMap = new Map<string, number>()
  for (const sym of symbols) {
    symbolMap.set(sym.symbol.trim().toUpperCase(), sym.Id)
  }

  const tickers = symbols.map((s) => s.symbol.trim())
  const today = new Date().toISOString().split("T")[0]
  let updated = 0
  let failed = 0

  // Load symbols that already have a price_history row for today (skip on re-sync)
  const existingHistory = await getAllRecords<PriceHistoryRecord>("price_history", {
    where: `(date,eq,exactDate,${today})`,
    fields: ["symbol"],
  })
  const historyExists = new Set(
    existingHistory.map((r) => r.symbol.trim().toUpperCase()),
  )
  if (historyExists.size > 0) {
    log.info(
      { date: today, count: historyExists.size },
      "price history already recorded for today, will skip existing",
    )
  }

  // Process symbols in batches of BATCH_SIZE
  const totalBatches = Math.ceil(tickers.length / BATCH_SIZE)
  log.info({ totalBatches, batchSize: BATCH_SIZE }, "processing quote batches")

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE)
    const batch = tickers.slice(i, i + BATCH_SIZE)

    try {
      log.debug({ batch: batchIndex, symbols: batch }, "fetching batch quotes")

      const quotes: StockQuote[] = await provider.fetchBatchQuotes(batch)

      log.debug(
        { batch: batchIndex, returned: quotes.length, requested: batch.length },
        "batch quotes received",
      )

      // Build symbol update records
      const symbolUpdates: Array<Partial<SymbolRecord> & { Id: number }> = []

      for (const quote of quotes) {
        const key = quote.symbol.trim().toUpperCase()
        const rowId = symbolMap.get(key)
        if (rowId == null) {
          log.warn(
            {
              symbol: quote.symbol,
              key,
              inMap: symbolMap.has(key),
              mapSize: symbolMap.size,
            },
            "quote returned for unknown symbol, skipping",
          )
          continue
        }

        symbolUpdates.push({
          Id: rowId,
          current_price: quote.price,
          previous_close: quote.previousClose,
          change_pct: quote.changesPercentage,
          day_high: quote.dayHigh,
          day_low: quote.dayLow,
          year_high: quote.yearHigh,
          year_low: quote.yearLow,
          market_cap: quote.marketCap,
          pe_ratio: quote.pe,
          eps: quote.eps,
          avg_volume: quote.avgVolume,
          price_avg_50: quote.priceAvg50,
          price_avg_200: quote.priceAvg200,
          last_price_update: new Date().toISOString(),
        })
      }

      if (symbolUpdates.length > 0) {
        log.debug(
          { batch: batchIndex, count: symbolUpdates.length },
          "updating symbols in NocoDB",
        )
        await updateRecords("symbols", symbolUpdates)
      }

      // Build price_history records (skip symbols already recorded today)
      const historyRecords: Array<Partial<PriceHistoryRecord>> = quotes
        .filter((q) => !historyExists.has(q.symbol.trim().toUpperCase()))
        .map((quote) => ({
          symbol: quote.symbol,
          date: today,
          close_price: quote.price,
          volume: quote.volume,
        }))

      if (historyRecords.length > 0) {
        log.debug(
          { batch: batchIndex, count: historyRecords.length },
          "inserting price history",
        )
        await createRecords("price_history", historyRecords)
      }

      updated += symbolUpdates.length
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown batch error"
      log.error(
        { batch: batchIndex, symbols: batch, err: message },
        "batch failed",
      )
      failed += batch.length
    }

    yield {
      type: "progress",
      completed: Math.min(i + BATCH_SIZE, total),
      total,
      batch: batchIndex,
    }
  }

  // Fetch and store USD/GBP forex rate
  try {
    log.info("fetching forex rate")
    const forexRate = await provider.fetchForexRate("USDGBP")
    log.info({ pair: forexRate.pair, rate: forexRate.rate }, "forex rate fetched")

    await upsertSetting(
      "usd_gbp_rate",
      String(forexRate.rate),
      "USD/GBP exchange rate",
    )
    await upsertSetting(
      "usd_gbp_rate_updated",
      new Date().toISOString(),
      "Last USD/GBP rate update",
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown forex error"
    log.error({ err: message }, "forex rate fetch failed")
  }

  // Update last_synced timestamp
  const timestamp = new Date().toISOString()
  await upsertSetting("last_synced", timestamp, "Last successful price sync")

  log.info({ updated, failed, timestamp }, "sync complete")
  yield { type: "complete", timestamp, updated, failed }
}

// ---------------------------------------------------------------------------
// Fundamentals Sync
// ---------------------------------------------------------------------------

/** Delay between individual symbol fetches to respect rate limits. */
const FUNDAMENTALS_DELAY_MS = 1100

/**
 * Sync fundamentals for portfolio symbols using the provided provider.
 *
 * For each symbol:
 * 1. Checks if we already have today's fundamentals history row (skip if cached)
 * 2. Fetches fundamentals from the provider
 * 3. Updates the symbols table with current fundamentals
 * 4. Inserts a history row for today
 *
 * Rate-limited with a delay between each symbol fetch.
 */
export async function* syncFundamentals(
  fundamentalsProvider: import("./providers/types").FundamentalsProvider,
  portfolioSymbols?: string[],
): AsyncGenerator<SyncProgress> {
  const tableId = process.env.NOCODB_TABLE_FUNDAMENTALS_HISTORY
  if (!tableId) {
    log.warn("NOCODB_TABLE_FUNDAMENTALS_HISTORY not set, skipping fundamentals sync")
    yield { type: "complete", timestamp: new Date().toISOString(), updated: 0, failed: 0 }
    return
  }

  const symbols = await getAllRecords<SymbolRecord>("symbols")

  // Filter to only portfolio symbols if provided
  const targetSymbols = portfolioSymbols
    ? symbols.filter((s) => portfolioSymbols.includes(s.symbol))
    : symbols

  const total = targetSymbols.length
  log.info({ total, provider: fundamentalsProvider.name }, "starting fundamentals sync")
  yield { type: "start", total }

  if (total === 0) {
    yield { type: "complete", timestamp: new Date().toISOString(), updated: 0, failed: 0 }
    return
  }

  const today = new Date().toISOString().split("T")[0]

  // Check which symbols already have today's fundamentals
  const existingHistory = await getAllRecords<FundamentalsHistoryRecord>(
    "fundamentals_history",
    {
      where: `(date,eq,exactDate,${today})`,
      fields: ["symbol"],
    },
  )
  const alreadySynced = new Set(existingHistory.map((r) => r.symbol))

  let updated = 0
  let failed = 0

  for (let i = 0; i < targetSymbols.length; i++) {
    const sym = targetSymbols[i]

    if (alreadySynced.has(sym.symbol)) {
      log.debug({ symbol: sym.symbol }, "fundamentals already cached for today, skipping")
      yield { type: "progress", completed: i + 1, total, batch: 0 }
      continue
    }

    try {
      const data: FundamentalsData = await fundamentalsProvider.fetchFundamentals(sym.symbol)

      // Update symbols table
      await updateRecord<SymbolRecord>("symbols", sym.Id, {
        eps: data.eps,
        pe_ratio: data.pe,
        beta: data.beta,
        dividend_yield: data.dividendYield,
        market_cap: data.marketCap,
        sector: data.sector ?? sym.sector,
        forward_pe: data.forwardPe,
        peg_ratio: data.pegRatio,
        roe: data.roe,
        roa: data.roa,
        last_fundamentals_update: new Date().toISOString(),
      })

      // Insert fundamentals history row
      await createRecord<FundamentalsHistoryRecord>("fundamentals_history", {
        symbol: sym.symbol,
        date: today,
        eps: data.eps,
        pe: data.pe,
        beta: data.beta,
        dividend_yield: data.dividendYield,
        market_cap: data.marketCap,
        sector: data.sector,
        forward_pe: data.forwardPe,
        peg_ratio: data.pegRatio,
        roe: data.roe,
        roa: data.roa,
      })

      updated++
      log.debug({ symbol: sym.symbol }, "fundamentals updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      log.error({ symbol: sym.symbol, err: message }, "fundamentals fetch failed")
      failed++
    }

    yield { type: "progress", completed: i + 1, total, batch: 0 }

    // Rate-limit delay between requests
    if (i < targetSymbols.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, FUNDAMENTALS_DELAY_MS))
    }
  }

  await upsertSetting(
    "last_fundamentals_sync",
    new Date().toISOString(),
    "Last successful fundamentals sync",
  )

  log.info({ updated, failed }, "fundamentals sync complete")
  yield { type: "complete", timestamp: new Date().toISOString(), updated, failed }
}
