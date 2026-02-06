// ============================================================================
// Active Price Provider
// ============================================================================
// Single import point for the price data provider. Swap providers by changing
// the instantiation below -- all consumers (sync.ts, etc.) use `provider`.
// ============================================================================

import { TiingoProvider } from "./tiingo"
import type { PriceProvider } from "./types"

export const provider: PriceProvider = new TiingoProvider()

export type { ForexRate, PriceProvider, StockQuote } from "./types"
