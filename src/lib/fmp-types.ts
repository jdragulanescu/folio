// ============================================================================
// FMP (Financial Modeling Prep) API Type Definitions
// ============================================================================
// TypeScript interfaces for FMP API response shapes. These mirror the JSON
// returned by FMP endpoints and are used as return types by the FMP client.
// ============================================================================

// ---------------------------------------------------------------------------
// Quote -- GET /api/v3/quote/{symbols}
// ---------------------------------------------------------------------------

/** Single stock quote from the FMP batch quote endpoint. */
export interface FMPQuote {
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

// ---------------------------------------------------------------------------
// Forex -- GET /api/v3/fx/{pair}
// ---------------------------------------------------------------------------

/** Single forex pair quote from the FMP forex endpoint. */
export interface FMPForexQuote {
  ticker: string
  bid: number
  ask: number
  open: number
  low: number
  high: number
  changes: number
  date: string
}

// ---------------------------------------------------------------------------
// Key Metrics TTM -- GET /api/v3/key-metrics-ttm/{symbol}
// ---------------------------------------------------------------------------

/**
 * Trailing twelve month key metrics from FMP.
 *
 * All numeric fields are nullable because the free tier may restrict access
 * to certain symbols or endpoints, returning 403 or empty arrays.
 */
export interface FMPKeyMetricsTTM {
  symbol: string
  peRatioTTM: number | null
  pegRatioTTM: number | null
  dividendYieldTTM: number | null
  revenuePerShareTTM: number | null
  netIncomePerShareTTM: number | null
  operatingCashFlowPerShareTTM: number | null
  freeCashFlowPerShareTTM: number | null
  cashPerShareTTM: number | null
  bookValuePerShareTTM: number | null
  debtToEquityTTM: number | null
  currentRatioTTM: number | null
  returnOnEquityTTM: number | null
  returnOnAssetsTTM: number | null
}
