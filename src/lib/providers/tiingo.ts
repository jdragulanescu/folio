import "server-only"

import logger from "../logger"
import type { ForexRate, PriceProvider, StockQuote } from "./types"

// ============================================================================
// Tiingo Price Provider
// ============================================================================
// Implements PriceProvider using Tiingo IEX (stock quotes) and Tiingo Forex
// endpoints. Auth is via the Authorization header (not query param).
//
// Tiingo IEX docs: https://www.tiingo.com/documentation/iex
// Tiingo Forex docs: https://www.tiingo.com/documentation/forex
// ============================================================================

// ---------------------------------------------------------------------------
// Tiingo IEX Response Shape (private)
// ---------------------------------------------------------------------------

interface TiingoIEXQuote {
  ticker: string
  timestamp: string
  last: number
  lastSize: number
  tngoLast: number
  prevClose: number
  open: number
  high: number
  low: number
  mid: number
  volume: number
  bidSize: number
  bidPrice: number
  askSize: number
  askPrice: number
}

// ---------------------------------------------------------------------------
// Tiingo Forex Response Shape (private)
// ---------------------------------------------------------------------------

interface TiingoForexQuote {
  ticker: string
  quoteTimestamp: string
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  midPrice: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIINGO_BASE = "https://api.tiingo.com"

/** Maximum symbols per batch request (URL length safety). */
const BATCH_SIZE = 30

const log = logger.child({ provider: "tiingo" })

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class TiingoProvider implements PriceProvider {
  private readonly token: string

  constructor() {
    const token = process.env.TIINGO_API_TOKEN
    if (!token) {
      throw new Error(
        "TIINGO_API_TOKEN is not set. Get a free token at https://www.tiingo.com/",
      )
    }
    this.token = token
  }

  // -------------------------------------------------------------------------
  // Internal Fetch Helper
  // -------------------------------------------------------------------------

  private async tiingoFetch<T>(url: string): Promise<T> {
    log.debug({ url }, "fetching")

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Token ${this.token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const text = await response.text()
      log.error({ url, status: response.status, body: text }, "request failed")
      throw new Error(`Tiingo ${response.status}: ${text}`)
    }

    return response.json() as Promise<T>
  }

  // -------------------------------------------------------------------------
  // Stock Quotes (IEX)
  // -------------------------------------------------------------------------

  async fetchBatchQuotes(symbols: string[]): Promise<StockQuote[]> {
    if (symbols.length === 0) return []

    log.info({ count: symbols.length }, "fetching batch quotes")
    const results: StockQuote[] = []

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE)
      const tickerStr = batch.join(",")
      const batchIndex = Math.floor(i / BATCH_SIZE)

      log.debug(
        { batch: batchIndex, tickers: tickerStr },
        "fetching IEX batch",
      )

      const quotes = await this.tiingoFetch<TiingoIEXQuote[]>(
        `${TIINGO_BASE}/iex/?tickers=${tickerStr}`,
      )

      log.debug(
        { batch: batchIndex, returned: quotes.length, requested: batch.length },
        "IEX batch response",
      )

      for (const q of quotes) {
        results.push({
          symbol: q.ticker,
          price: q.last,
          previousClose: q.prevClose,
          changesPercentage:
            q.prevClose !== 0
              ? ((q.last - q.prevClose) / q.prevClose) * 100
              : 0,
          dayHigh: q.high,
          dayLow: q.low,
          yearHigh: null,
          yearLow: null,
          marketCap: null,
          pe: null,
          eps: null,
          avgVolume: null,
          priceAvg50: null,
          priceAvg200: null,
          volume: q.volume,
        })
      }
    }

    log.info({ total: results.length }, "batch quotes complete")
    return results
  }

  // -------------------------------------------------------------------------
  // Forex
  // -------------------------------------------------------------------------

  async fetchForexRate(pair: string = "USDGBP"): Promise<ForexRate> {
    // Tiingo uses standard major pairs (e.g., "gbpusd"). If the caller
    // requests "USDGBP" we need to fetch "gbpusd" and invert the rate.
    const upper = pair.toUpperCase()
    const base = upper.slice(0, 3)
    const quote = upper.slice(3)
    const reversed = `${quote}${base}`
    const tiingoTicker = reversed.toLowerCase()
    const needsInversion = true

    log.info(
      { pair: upper, tiingoTicker, inverted: needsInversion },
      "fetching forex rate",
    )

    const quotes = await this.tiingoFetch<TiingoForexQuote[]>(
      `${TIINGO_BASE}/tiingo/fx/top?tickers=${tiingoTicker}`,
    )

    if (quotes.length === 0) {
      log.error({ pair: upper, tiingoTicker }, "no forex data returned")
      throw new Error(
        `Tiingo: no forex data returned for pair ${upper} (ticker: ${tiingoTicker})`,
      )
    }

    const raw = quotes[0]
    log.debug(
      {
        ticker: raw.ticker,
        midPrice: raw.midPrice,
        bidPrice: raw.bidPrice,
        askPrice: raw.askPrice,
      },
      "forex raw response",
    )

    const rate = needsInversion ? 1 / raw.midPrice : raw.midPrice

    log.info({ pair: upper, rate }, "forex rate resolved")

    return {
      pair: upper,
      rate,
    }
  }
}
