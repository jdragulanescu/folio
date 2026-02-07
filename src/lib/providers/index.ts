// ============================================================================
// Active Price Provider
// ============================================================================
// Single import point for the price data provider. Swap providers by changing
// the instantiation below -- all consumers (sync.ts, etc.) use `provider`.
//
// Available providers:
//   TiingoProvider  -- free tier, IEX quotes + forex (env: TIINGO_API_TOKEN)
//   FMPProvider     -- paid Starter+ plan required (env: FMP_API_KEY)
// ============================================================================

import { TiingoProvider } from "./tiingo"
import type { PriceProvider } from "./types"

export const provider: PriceProvider = new TiingoProvider()

export type {
  ForexRate,
  PriceProvider,
  StockQuote,
  FundamentalsData,
  FundamentalsProvider,
} from "./types"
