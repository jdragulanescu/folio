import "server-only"

import type { ForexRate, PriceProvider, StockQuote } from "./types"

// ============================================================================
// FMP (Financial Modeling Prep) Price Provider
// ============================================================================
// Implements PriceProvider using FMP /stable/ endpoints. Requires a paid plan
// (Starter or above) -- the free tier no longer supports batch-quote or forex.
//
// FMP docs: https://site.financialmodelingprep.com/developer/docs
// ============================================================================

// ---------------------------------------------------------------------------
// FMP Response Shapes (private)
// ---------------------------------------------------------------------------

interface FMPQuote {
  symbol: string
  name: string
  price: number
  changesPercentage: number
  change: number
  dayLow: number
  dayHigh: number
  yearHigh: number
  yearLow: number
  marketCap: number
  priceAvg50: number
  priceAvg200: number
  volume: number
  avgVolume: number
  exchange: string
  open: number
  previousClose: number
  eps: number
  pe: number
  earningsAnnouncement: string | null
  sharesOutstanding: number
  timestamp: number
}

interface FMPForexQuote {
  symbol: string
  price: number
  change: number
  changePercentage: number
  previousClose: number
  dayLow: number
  dayHigh: number
  yearLow: number
  yearHigh: number
  volume: number
  open: number
  priceAvg50: number
  priceAvg200: number
  timestamp: number
  exchange: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FMP_BASE = "https://financialmodelingprep.com"

/** Maximum symbols per batch quote request (URL length safety). */
const BATCH_SIZE = 30

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class FMPProvider implements PriceProvider {
  private readonly apiKey: string

  constructor() {
    const key = process.env.FMP_API_KEY
    if (!key) {
      throw new Error("FMP_API_KEY is not set.")
    }
    this.apiKey = key
  }

  // -------------------------------------------------------------------------
  // Internal Fetch Helper
  // -------------------------------------------------------------------------

  private async fmpFetch<T>(path: string): Promise<T> {
    const separator = path.includes("?") ? "&" : "?"
    const url = `${FMP_BASE}${path}${separator}apikey=${this.apiKey}`

    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`FMP ${response.status}: ${text}`)
    }

    return response.json() as Promise<T>
  }

  // -------------------------------------------------------------------------
  // Stock Quotes
  // -------------------------------------------------------------------------

  async fetchBatchQuotes(symbols: string[]): Promise<StockQuote[]> {
    if (symbols.length === 0) return []

    const results: StockQuote[] = []

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE)
      const symbolStr = batch.join(",")
      const quotes = await this.fmpFetch<FMPQuote[]>(
        `/stable/batch-quote?symbols=${symbolStr}`,
      )

      for (const q of quotes) {
        results.push({
          symbol: q.symbol,
          price: q.price,
          previousClose: q.previousClose,
          changesPercentage: q.changesPercentage,
          dayHigh: q.dayHigh,
          dayLow: q.dayLow,
          yearHigh: q.yearHigh,
          yearLow: q.yearLow,
          marketCap: q.marketCap,
          pe: q.pe,
          eps: q.eps,
          avgVolume: q.avgVolume,
          priceAvg50: q.priceAvg50,
          priceAvg200: q.priceAvg200,
          volume: q.volume,
        })
      }
    }

    return results
  }

  // -------------------------------------------------------------------------
  // Forex
  // -------------------------------------------------------------------------

  async fetchForexRate(pair: string = "USDGBP"): Promise<ForexRate> {
    const quotes = await this.fmpFetch<FMPForexQuote[]>(
      `/stable/quote?symbol=${pair}`,
    )

    if (quotes.length === 0) {
      throw new Error(`FMP: no forex data returned for pair ${pair}`)
    }

    return {
      pair: pair.toUpperCase(),
      rate: quotes[0].price,
    }
  }
}
