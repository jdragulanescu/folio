import "server-only"

import logger from "../logger"
import type { FundamentalsData, FundamentalsProvider } from "./types"

// ============================================================================
// Alpha Vantage Fundamentals Provider
// ============================================================================
// Free tier: 25 API calls/day
// https://www.alphavantage.co/documentation/
// ============================================================================

const AV_BASE = "https://www.alphavantage.co/query"

const log = logger.child({ provider: "alpha-vantage" })

// ---------------------------------------------------------------------------
// Alpha Vantage OVERVIEW Response Shape
// ---------------------------------------------------------------------------

interface AlphaVantageOverview {
  Symbol?: string
  Name?: string
  Sector?: string
  Industry?: string
  MarketCapitalization?: string
  EBITDA?: string
  PERatio?: string
  PEGRatio?: string
  BookValue?: string
  DividendPerShare?: string
  DividendYield?: string
  EPS?: string
  ProfitMargin?: string
  Beta?: string
  "52WeekHigh"?: string
  "52WeekLow"?: string
  ForwardPE?: string
  ReturnOnEquityTTM?: string
  ReturnOnAssetsTTM?: string
  // Error response
  Note?: string
  Information?: string
}

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class AlphaVantageProvider implements FundamentalsProvider {
  readonly name = "alpha-vantage"
  private readonly apiKey: string

  constructor() {
    const key = process.env.ALPHA_VANTAGE_API_KEY
    if (!key) {
      throw new Error(
        "ALPHA_VANTAGE_API_KEY is not set. Get a free key at https://www.alphavantage.co/",
      )
    }
    this.apiKey = key
  }

  async fetchFundamentals(symbol: string): Promise<FundamentalsData> {
    log.info({ symbol }, "fetching fundamentals")

    const url = `${AV_BASE}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`

    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      const text = await response.text()
      log.error({ symbol, status: response.status, body: text }, "request failed")
      throw new Error(`Alpha Vantage ${response.status}: ${text}`)
    }

    const data = (await response.json()) as AlphaVantageOverview

    // Check for rate limit or error messages
    if (data.Note || data.Information) {
      const msg = data.Note ?? data.Information ?? "Unknown error"
      log.warn({ symbol, message: msg }, "API limit or error")
      throw new Error(`Alpha Vantage: ${msg}`)
    }

    const parseNum = (val: string | undefined): number | null => {
      if (val == null || val === "" || val === "None" || val === "-") return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }

    return {
      symbol,
      eps: parseNum(data.EPS),
      pe: parseNum(data.PERatio),
      beta: parseNum(data.Beta),
      dividendYield: parseNum(data.DividendYield)
        ? parseNum(data.DividendYield)! * 100 // AV returns as decimal
        : null,
      marketCap: parseNum(data.MarketCapitalization),
      sector: data.Sector && data.Sector !== "None" ? data.Sector : null,
      forwardPe: parseNum(data.ForwardPE),
      pegRatio: parseNum(data.PEGRatio),
      roe: parseNum(data.ReturnOnEquityTTM)
        ? parseNum(data.ReturnOnEquityTTM)! * 100
        : null,
      roa: parseNum(data.ReturnOnAssetsTTM)
        ? parseNum(data.ReturnOnAssetsTTM)! * 100
        : null,
    }
  }
}
