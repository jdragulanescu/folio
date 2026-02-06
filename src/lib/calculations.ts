// ============================================================================
// Core Financial Calculations Engine
// ============================================================================
// Section 104 pool cost basis, realised/unrealised P&L, and portfolio-level
// aggregations. All arithmetic uses Big.js -- no floating-point operations.
//
// Key export functions:
//   computeHolding  -- Process transactions into a single holding
//   computePortfolio -- Aggregate multiple holdings with weights
//   toDisplay       -- Convert Big.js value to display number
// ============================================================================

import Big from "big.js"

// ---------------------------------------------------------------------------
// Big.js Configuration
// ---------------------------------------------------------------------------
// ROUND_HALF_UP for financial rounding (0.5 rounds up).
// Leave DP at default 20 for full intermediate precision.
// ---------------------------------------------------------------------------
Big.RM = Big.roundHalfUp

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface TransactionInput {
  type: "Buy" | "Sell"
  shares: number
  price: number
  amount: number
  date: string
}

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface HoldingResult {
  shares: Big
  avgCost: Big
  totalCost: Big
  realisedPnl: Big
  unrealisedPnl: Big
  marketValue: Big
}

export interface PortfolioHolding extends HoldingResult {
  symbol: string
  name: string
  sector: string | null
  strategy: string | null
  currentPrice: Big
  weight: Big
}

export interface PortfolioTotals {
  totalMarketValue: Big
  totalCost: Big
  totalUnrealisedPnl: Big
  totalRealisedPnl: Big
}

export interface PortfolioResult {
  holdings: PortfolioHolding[]
  totals: PortfolioTotals
}

export interface SymbolInput {
  transactions: TransactionInput[]
  currentPrice: number
  name: string
  sector: string | null
  strategy: string | null
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface PoolState {
  shares: Big
  totalCost: Big
}

function zeroTotals(): PortfolioTotals {
  return {
    totalMarketValue: new Big(0),
    totalCost: new Big(0),
    totalUnrealisedPnl: new Big(0),
    totalRealisedPnl: new Big(0),
  }
}

// ---------------------------------------------------------------------------
// computeHolding
// ---------------------------------------------------------------------------
// Process a sorted array of transactions using the Section 104 pool algorithm.
// Transactions are sorted by date ascending; for same-day, buys before sells.
//
// Returns Big values for composition. Use toDisplay() at the render boundary.
// ---------------------------------------------------------------------------

export function computeHolding(
  transactions: TransactionInput[],
  currentPrice: number,
): HoldingResult {
  const price = new Big(currentPrice)

  // Sort transactions: date ascending, buys before sells on same day
  const sorted = [...transactions].sort((a, b) => {
    const dateCompare =
      new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateCompare !== 0) return dateCompare
    // Same day: buys first (Buy < Sell alphabetically works here)
    if (a.type === "Buy" && b.type === "Sell") return -1
    if (a.type === "Sell" && b.type === "Buy") return 1
    return 0
  })

  let pool: PoolState = { shares: new Big(0), totalCost: new Big(0) }
  let realisedPnl = new Big(0)

  for (const tx of sorted) {
    const txShares = new Big(tx.shares)
    const txAmount = new Big(tx.amount)

    if (tx.type === "Buy") {
      pool.shares = pool.shares.plus(txShares)
      pool.totalCost = pool.totalCost.plus(txAmount)
    } else {
      // Sell: reduce pool proportionally
      if (pool.shares.eq(0)) continue

      const avgCost = pool.totalCost.div(pool.shares)
      const costOfSold = avgCost.times(txShares)
      realisedPnl = realisedPnl.plus(txAmount.minus(costOfSold))

      pool.shares = pool.shares.minus(txShares)
      pool.totalCost = pool.totalCost.minus(costOfSold)

      // Reset pool if fully sold (or gone negative from data issues)
      if (pool.shares.lte(0)) {
        pool = { shares: new Big(0), totalCost: new Big(0) }
      }
    }
  }

  const avgCost = pool.shares.gt(0)
    ? pool.totalCost.div(pool.shares)
    : new Big(0)
  const marketValue = pool.shares.times(price)
  const unrealisedPnl = pool.shares.gt(0)
    ? price.minus(avgCost).times(pool.shares)
    : new Big(0)

  return {
    shares: pool.shares,
    avgCost,
    totalCost: pool.totalCost,
    realisedPnl,
    unrealisedPnl,
    marketValue,
  }
}

// ---------------------------------------------------------------------------
// computePortfolio
// ---------------------------------------------------------------------------
// Aggregate multiple holdings into a portfolio with weights and totals.
// ---------------------------------------------------------------------------

export function computePortfolio(
  holdings: Map<string, SymbolInput>,
): PortfolioResult {
  if (holdings.size === 0) {
    return { holdings: [], totals: zeroTotals() }
  }

  // Step 1: Compute each holding
  const computed = [...holdings].map(([symbol, data]) => ({
    symbol,
    ...data,
    result: computeHolding(data.transactions, data.currentPrice),
  }))

  // Step 2: Calculate portfolio totals
  const totals = computed.reduce<PortfolioTotals>((acc, h) => {
    acc.totalMarketValue = acc.totalMarketValue.plus(h.result.marketValue)
    acc.totalCost = acc.totalCost.plus(h.result.totalCost)
    acc.totalUnrealisedPnl = acc.totalUnrealisedPnl.plus(
      h.result.unrealisedPnl,
    )
    acc.totalRealisedPnl = acc.totalRealisedPnl.plus(h.result.realisedPnl)
    return acc
  }, zeroTotals())

  // Step 3: Calculate weights (as percentage of total market value)
  const portfolioHoldings: PortfolioHolding[] = computed.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    sector: h.sector,
    strategy: h.strategy,
    currentPrice: new Big(h.currentPrice),
    weight: totals.totalMarketValue.gt(0)
      ? h.result.marketValue.div(totals.totalMarketValue).times(100)
      : new Big(0),
    ...h.result,
  }))

  return { holdings: portfolioHoldings, totals }
}

// ---------------------------------------------------------------------------
// toDisplay
// ---------------------------------------------------------------------------
// Convert a Big.js value to a display-ready number with fixed decimal places.
// This is the ONLY place where Big values should be converted to numbers.
// ---------------------------------------------------------------------------

export function toDisplay(value: Big, dp: number = 2): number {
  return Number(value.toFixed(dp))
}
