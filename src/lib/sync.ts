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
import type { StockQuote } from "./providers"
import type { PriceHistoryRecord, SettingRecord, SymbolRecord } from "./types"

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

      // Build price_history records
      const historyRecords: Array<Partial<PriceHistoryRecord>> = quotes.map(
        (quote) => ({
          symbol: quote.symbol,
          date: today,
          close_price: quote.price,
          volume: quote.volume,
        }),
      )

      if (historyRecords.length > 0) {
        log.debug(
          { batch: batchIndex, count: historyRecords.length },
          "inserting price history",
        )
        await createRecords("price_history", historyRecords)
      }

      updated += quotes.length
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
