// ============================================================================
// Price Provider Abstraction Types
// ============================================================================
// Provider-agnostic interfaces for stock quotes, forex rates, and the
// PriceProvider contract. Any data source (Tiingo, FMP, Polygon, etc.) can
// implement PriceProvider to slot into the sync pipeline.
// ============================================================================

// ---------------------------------------------------------------------------
// Stock Quote
// ---------------------------------------------------------------------------

/** Provider-agnostic stock quote shape consumed by sync.ts. */
export interface StockQuote {
  symbol: string
  price: number
  previousClose: number
  changesPercentage: number
  dayHigh: number
  dayLow: number
  yearHigh: number | null
  yearLow: number | null
  marketCap: number | null
  pe: number | null
  eps: number | null
  avgVolume: number | null
  priceAvg50: number | null
  priceAvg200: number | null
  volume: number
}

// ---------------------------------------------------------------------------
// Forex Rate
// ---------------------------------------------------------------------------

/** Provider-agnostic forex rate shape. */
export interface ForexRate {
  pair: string
  rate: number
}

// ---------------------------------------------------------------------------
// Provider Contract
// ---------------------------------------------------------------------------

/** Interface that all price data providers must implement. */
export interface PriceProvider {
  fetchBatchQuotes(symbols: string[]): Promise<StockQuote[]>
  fetchForexRate(pair?: string): Promise<ForexRate>
}
