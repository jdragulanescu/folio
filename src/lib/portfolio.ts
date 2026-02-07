import "server-only"

// ============================================================================
// Server-Side Portfolio Data Assembly
// ============================================================================
// Fetches all data from NocoDB, computes holdings via the calculations engine,
// and converts Big.js values to plain numbers at the serialisation boundary.
//
// This module is the SOLE bridge between raw NocoDB records and the display
// layer. All Big.js values are converted to numbers here via toDisplay().
// ============================================================================

import {
  computePortfolio,
  toDisplay,
  type SymbolInput,
  type TransactionInput,
} from "./calculations"
import { getAllRecords, fetchParallel } from "./nocodb"
import type {
  SymbolRecord,
  TransactionRecord,
  DepositRecord,
  OptionRecord,
} from "./types"

// ---------------------------------------------------------------------------
// Display Types (all plain numbers -- safe for JSON serialisation)
// ---------------------------------------------------------------------------

export interface DisplayHolding {
  symbol: string
  name: string
  sector: string | null
  strategy: string | null
  platform: string | null
  currentPrice: number
  previousClose: number | null
  changePct: number | null
  shares: number
  avgCost: number
  totalCost: number
  marketValue: number
  unrealisedPnl: number
  unrealisedPnlPct: number
  realisedPnl: number
  weight: number
}

export interface PortfolioData {
  holdings: DisplayHolding[]
  totals: {
    totalMarketValue: number
    totalCost: number
    totalUnrealisedPnl: number
    totalRealisedPnl: number
  }
  totalDeposited: number
  optionsPremium: number
  dayChange: number
  dayChangePct: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the primary platform (broker) for a symbol by tallying shares
 * per platform across all transactions and picking the one with the most.
 */
function getPrimaryPlatform(
  transactions: TransactionRecord[],
): string | null {
  const tally = new Map<string, number>()

  for (const tx of transactions) {
    if (!tx.platform) continue
    const current = tally.get(tx.platform) ?? 0
    if (tx.type === "Buy") {
      tally.set(tx.platform, current + tx.shares)
    } else {
      tally.set(tx.platform, current - tx.shares)
    }
  }

  let best: string | null = null
  let bestCount = -Infinity

  for (const [platform, count] of tally) {
    if (count > bestCount) {
      bestCount = count
      best = platform
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Main Data Assembly
// ---------------------------------------------------------------------------

export async function getPortfolioData(): Promise<PortfolioData> {
  // Step 1: Fetch all needed data in parallel
  const [symbols, transactions, deposits, options] = await fetchParallel(
    () => getAllRecords<SymbolRecord>("symbols"),
    () => getAllRecords<TransactionRecord>("transactions"),
    () => getAllRecords<DepositRecord>("deposits"),
    () => getAllRecords<OptionRecord>("options"),
  )

  // Step 2: Build symbol lookup map
  const symbolMap = new Map<string, SymbolRecord>()
  for (const s of symbols) {
    symbolMap.set(s.symbol, s)
  }

  // Step 3: Group transactions by symbol
  const txBySymbol = new Map<string, TransactionRecord[]>()
  for (const tx of transactions) {
    const existing = txBySymbol.get(tx.symbol) ?? []
    existing.push(tx)
    txBySymbol.set(tx.symbol, existing)
  }

  // Step 4: Build SymbolInput map for computePortfolio
  // Only include symbols with BOTH transactions AND a non-null current_price
  const holdingsInput = new Map<string, SymbolInput>()

  for (const [symbol, txList] of txBySymbol) {
    const symbolRecord = symbolMap.get(symbol)
    if (!symbolRecord || symbolRecord.current_price == null) continue

    const transactionInputs: TransactionInput[] = txList.map((tx) => ({
      type: tx.type,
      shares: tx.shares,
      price: tx.price,
      amount: tx.amount,
      date: tx.date,
    }))

    holdingsInput.set(symbol, {
      transactions: transactionInputs,
      currentPrice: symbolRecord.current_price,
      name: symbolRecord.name,
      sector: symbolRecord.sector,
      strategy: symbolRecord.strategy,
    })
  }

  // Step 5: Compute portfolio (returns Big.js values)
  const result = computePortfolio(holdingsInput)

  // Step 6: Filter to only active holdings (shares > 0) and convert to display
  const activeHoldings = result.holdings.filter((h) => h.shares.gt(0))

  const displayHoldings: DisplayHolding[] = activeHoldings.map((h) => {
    const symbolRecord = symbolMap.get(h.symbol)!
    const symbolTxs = txBySymbol.get(h.symbol) ?? []
    const totalCost = toDisplay(h.totalCost)
    const unrealisedPnl = toDisplay(h.unrealisedPnl)
    const unrealisedPnlPct =
      totalCost !== 0 ? (unrealisedPnl / totalCost) * 100 : 0

    return {
      symbol: h.symbol,
      name: h.name,
      sector: h.sector,
      strategy: h.strategy,
      platform: getPrimaryPlatform(symbolTxs),
      currentPrice: toDisplay(h.currentPrice),
      previousClose: symbolRecord.previous_close,
      changePct: symbolRecord.change_pct,
      shares: toDisplay(h.shares, 6),
      avgCost: toDisplay(h.avgCost),
      totalCost,
      marketValue: toDisplay(h.marketValue),
      unrealisedPnl,
      unrealisedPnlPct: Number(unrealisedPnlPct.toFixed(2)),
      realisedPnl: toDisplay(h.realisedPnl),
      weight: toDisplay(h.weight),
    }
  })

  // Step 7: Compute totals (convert Big.js to numbers)
  const totals = {
    totalMarketValue: toDisplay(result.totals.totalMarketValue),
    totalCost: toDisplay(result.totals.totalCost),
    totalUnrealisedPnl: toDisplay(result.totals.totalUnrealisedPnl),
    totalRealisedPnl: toDisplay(result.totals.totalRealisedPnl),
  }

  // Step 8: Compute day change at portfolio level
  let dayChange = 0
  for (const h of displayHoldings) {
    if (h.changePct != null) {
      dayChange += h.marketValue * (h.changePct / 100)
    }
  }
  const dayChangePct =
    totals.totalMarketValue !== 0
      ? (dayChange / totals.totalMarketValue) * 100
      : 0

  // Step 9: Compute total deposited
  let totalDeposited = 0
  for (const d of deposits) {
    totalDeposited += d.amount
  }

  // Step 10: Compute options premium (premium received from selling)
  let optionsPremium = 0
  for (const o of options) {
    if (o.buy_sell === "Sell") {
      optionsPremium += o.premium
    }
  }

  return {
    holdings: displayHoldings,
    totals,
    totalDeposited: Number(totalDeposited.toFixed(2)),
    optionsPremium: Number(optionsPremium.toFixed(2)),
    dayChange: Number(dayChange.toFixed(2)),
    dayChangePct: Number(dayChangePct.toFixed(2)),
  }
}
