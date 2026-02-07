import "server-only"

import logger from "../logger"
import type { FundamentalsData, FundamentalsProvider } from "./types"

// ============================================================================
// Finnhub Fundamentals Provider
// ============================================================================
// Free tier: 60 API calls/min
// https://finnhub.io/docs/api/
// ============================================================================

const FINNHUB_BASE = "https://finnhub.io/api/v1"

const log = logger.child({ provider: "finnhub" })

// ---------------------------------------------------------------------------
// Finnhub Response Shapes
// ---------------------------------------------------------------------------

interface FinnhubMetricResponse {
  metric: {
    "10DayAverageTradingVolume"?: number
    "52WeekHigh"?: number
    "52WeekLow"?: number
    beta?: number
    dividendYieldIndicatedAnnual?: number
    epsBasicExclExtraItemsTTM?: number
    epsGrowthTTMYoy?: number
    marketCapitalization?: number
    peBasicExclExtraTTM?: number
    roeTTM?: number
    roaTTM?: number
  }
}

interface FinnhubProfileResponse {
  country?: string
  currency?: string
  finnhubIndustry?: string
  ipo?: string
  logo?: string
  marketCapitalization?: number
  name?: string
  phone?: string
  shareOutstanding?: number
  ticker?: string
  weburl?: string
}

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class FinnhubProvider implements FundamentalsProvider {
  readonly name = "finnhub"
  private readonly apiKey: string

  constructor() {
    const key = process.env.FINNHUB_API_KEY
    if (!key) {
      throw new Error(
        "FINNHUB_API_KEY is not set. Get a free key at https://finnhub.io/",
      )
    }
    this.apiKey = key
  }

  private async finnhubFetch<T>(path: string): Promise<T> {
    const url = `${FINNHUB_BASE}${path}`
    log.debug({ url: path }, "fetching")

    const response = await fetch(url, {
      cache: "no-store",
      headers: { "X-Finnhub-Token": this.apiKey },
    })

    if (!response.ok) {
      const text = await response.text()
      log.error({ path, status: response.status, body: text }, "request failed")
      throw new Error(`Finnhub ${response.status}: ${text}`)
    }

    return response.json() as Promise<T>
  }

  async fetchFundamentals(symbol: string): Promise<FundamentalsData> {
    log.info({ symbol }, "fetching fundamentals")

    // Fetch metrics and profile in parallel
    const [metrics, profile] = await Promise.all([
      this.finnhubFetch<FinnhubMetricResponse>(
        `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
      ),
      this.finnhubFetch<FinnhubProfileResponse>(
        `/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
      ),
    ])

    const m = metrics.metric

    return {
      symbol,
      eps: m.epsBasicExclExtraItemsTTM ?? null,
      pe: m.peBasicExclExtraTTM ?? null,
      beta: m.beta ?? null,
      dividendYield: m.dividendYieldIndicatedAnnual ?? null,
      marketCap:
        m.marketCapitalization != null
          ? m.marketCapitalization * 1_000_000 // Finnhub returns in millions
          : null,
      sector: profile.finnhubIndustry ?? null,
      forwardPe: null, // Not available from Finnhub free tier
      pegRatio: null, // Not available from Finnhub free tier
      roe: m.roeTTM ?? null,
      roa: m.roaTTM ?? null,
    }
  }
}
