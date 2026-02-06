import "server-only"

import type { FMPForexQuote, FMPKeyMetricsTTM, FMPQuote } from "./fmp-types"

// ============================================================================
// FMP (Financial Modeling Prep) API Client
// ============================================================================
// Server-only client for the FMP REST API. Importing this module in a Client
// Component triggers a build-time error, protecting the API key.
// ============================================================================

// ---------------------------------------------------------------------------
// Environment Configuration
// ---------------------------------------------------------------------------

const FMP_BASE = "https://financialmodelingprep.com"
const API_KEY = process.env.FMP_API_KEY!

// ---------------------------------------------------------------------------
// Internal Fetch Wrapper
// ---------------------------------------------------------------------------

/** Maximum symbols per batch quote request (URL length safety). */
const BATCH_SIZE = 30

/**
 * Generic FMP fetch helper. Appends the API key to the URL and throws on
 * non-ok responses with status code and body text for debugging.
 */
async function fmpFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?"
  const url = `${FMP_BASE}${path}${separator}apikey=${API_KEY}`

  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`FMP ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

/**
 * Fetch quotes for multiple symbols in batched requests.
 *
 * Splits symbols into groups of BATCH_SIZE (30) to stay within safe URL
 * lengths. Batches are fetched sequentially to respect rate limits.
 * Returns a flat array of all quote results.
 */
export async function fetchBatchQuotes(
  symbols: string[],
): Promise<FMPQuote[]> {
  if (symbols.length === 0) return []

  const results: FMPQuote[] = []

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    const symbolStr = batch.join(",")
    const quotes = await fmpFetch<FMPQuote[]>(
      `/api/v3/quote/${symbolStr}`,
    )
    results.push(...quotes)
  }

  return results
}

/**
 * Fetch the current forex rate for a currency pair.
 *
 * Defaults to USDGBP. Returns the first (and typically only) element
 * from the FMP forex endpoint response array.
 */
export async function fetchForexRate(
  pair: string = "USDGBP",
): Promise<FMPForexQuote> {
  const quotes = await fmpFetch<FMPForexQuote[]>(`/api/v3/fx/${pair}`)

  if (quotes.length === 0) {
    throw new Error(`FMP: no forex data returned for pair ${pair}`)
  }

  return quotes[0]
}

/**
 * Fetch trailing twelve month key metrics for a single symbol.
 *
 * Returns null on failure (403, empty response) as a graceful fallback
 * for FMP free tier restrictions on non-sample symbols.
 */
export async function fetchKeyMetricsTTM(
  symbol: string,
): Promise<FMPKeyMetricsTTM | null> {
  try {
    const metrics = await fmpFetch<FMPKeyMetricsTTM[]>(
      `/api/v3/key-metrics-ttm/${symbol}`,
    )
    return metrics.length > 0 ? metrics[0] : null
  } catch {
    // Graceful fallback: free tier may restrict access (403) or return errors
    return null
  }
}
