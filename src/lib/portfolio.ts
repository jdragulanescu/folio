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

import Big from "big.js"
import {
  computePortfolio,
  toDisplay,
  type SymbolInput,
  type TransactionInput,
} from "./calculations"
import { getAllRecords, fetchParallel } from "./nocodb"
import { computeStats, isLongStrategy } from "./options-shared"
import type {
  SymbolRecord,
  TransactionRecord,
  DepositRecord,
  DividendRecord,
  OptionRecord,
  SettingRecord,
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
  weight: number
  eps: number | null
  peRatio: number | null
  totalEarnings: number | null
  earningsYield: number | null
  annualDividend: number | null
  dividendYield: number | null
  yieldOnCost: number | null
  annualIncome: number | null
  beta: number | null
}

export interface CashBreakdown {
  depositsGbp: number
  depositsUsd: number
  fxPnl: number
  stockBuys: number
  stockSells: number
  dividends: number
  optionsNet: number
  total: number
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
  cashBalance: number
  cashBreakdown: CashBreakdown
  forexRate: number
  options: OptionRecord[]
  transactions: TransactionRecord[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the primary platform (broker) for a symbol by tallying shares
 * per platform across all transactions and picking the one with the most.
 */
export function getPrimaryPlatform(
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
  const [symbols, transactions, deposits, options, dividends, settings] =
    await fetchParallel(
      () => getAllRecords<SymbolRecord>("symbols"),
      () => getAllRecords<TransactionRecord>("transactions"),
      () => getAllRecords<DepositRecord>("deposits"),
      () => getAllRecords<OptionRecord>("options"),
      () => getAllRecords<DividendRecord>("dividends"),
      () => getAllRecords<SettingRecord>("settings"),
    )

  // Extract USD/GBP forex rate from settings (default 0.79 if not found)
  const usdGbpSetting = settings.find((s) => s.key === "usd_gbp_rate")
  const usdGbpRate = usdGbpSetting ? Number(usdGbpSetting.value) || 0.79 : 0.79

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
  const holdingsInput = new Map<string, SymbolInput>()

  for (const [symbol, txList] of txBySymbol) {
    const symbolRecord = symbolMap.get(symbol)
    if (!symbolRecord || symbolRecord.current_price == null) continue

    const transactionInputs: TransactionInput[] = txList.map((tx) => ({
      type: tx.type,
      shares: tx.shares,
      price: tx.price,
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
  const activeHoldings = result.holdings.filter((h) =>
    h.shares.gte(new Big("0.0001")),
  )

  const displayHoldings: DisplayHolding[] = activeHoldings.map((h) => {
    const symbolRecord = symbolMap.get(h.symbol)!
    const symbolTxs = txBySymbol.get(h.symbol) ?? []
    const totalCost = toDisplay(h.totalCost)
    const unrealisedPnl = toDisplay(h.unrealisedPnl)
    const unrealisedPnlPct =
      totalCost !== 0 ? (unrealisedPnl / totalCost) * 100 : 0

    const currentPrice = toDisplay(h.currentPrice)
    const shares = toDisplay(h.shares, 6)
    const avgCost = toDisplay(h.avgCost)
    const eps = symbolRecord.eps
    const dividendYield =
      symbolRecord.dividend_yield_ttm ?? symbolRecord.dividend_yield

    const annualDivPerShare =
      dividendYield != null && currentPrice > 0
        ? (dividendYield / 100) * currentPrice
        : null

    return {
      symbol: h.symbol,
      name: h.name,
      sector: h.sector,
      strategy: h.strategy,
      platform: getPrimaryPlatform(symbolTxs),
      currentPrice,
      previousClose: symbolRecord.previous_close,
      changePct: symbolRecord.change_pct,
      shares,
      avgCost,
      totalCost,
      marketValue: toDisplay(h.marketValue),
      unrealisedPnl,
      unrealisedPnlPct: Number(unrealisedPnlPct.toFixed(2)),
      weight: 0, // recalculated below after adding options + cash
      eps,
      peRatio: symbolRecord.pe_ratio,
      totalEarnings: eps != null ? Number((eps * shares).toFixed(2)) : null,
      earningsYield:
        eps != null && currentPrice > 0
          ? Number(((eps / currentPrice) * 100).toFixed(2))
          : null,
      annualDividend:
        annualDivPerShare != null
          ? Number(annualDivPerShare.toFixed(4))
          : null,
      dividendYield:
        dividendYield != null ? Number(dividendYield.toFixed(2)) : null,
      yieldOnCost:
        annualDivPerShare != null && avgCost > 0
          ? Number(((annualDivPerShare / avgCost) * 100).toFixed(2))
          : null,
      annualIncome:
        annualDivPerShare != null
          ? Number((annualDivPerShare * shares).toFixed(2))
          : null,
      beta: symbolRecord.beta,
    }
  })

  // Step 7: Add open long options as portfolio holdings
  const openLongOptions = options.filter(
    (o) => o.status === "Open" && o.buy_sell === "Buy",
  )
  for (const opt of openLongOptions) {
    const symbolRecord = symbolMap.get(opt.ticker)
    const costBasis = opt.premium * opt.qty * 100
    const suffix = isLongStrategy(opt.strategy_type)
      ? ` (${opt.strategy_type})`
      : " (Option)"

    displayHoldings.push({
      symbol: opt.ticker,
      name: (symbolRecord?.name ?? opt.ticker) + suffix,
      sector: symbolRecord?.sector ?? null,
      strategy: opt.strategy_type,
      platform: opt.platform ?? "IBKR",
      currentPrice: symbolRecord?.current_price ?? 0,
      previousClose: null,
      changePct: null,
      shares: opt.qty,
      avgCost: opt.premium * 100,
      totalCost: costBasis,
      marketValue: costBasis, // no free options pricing
      unrealisedPnl: 0,
      unrealisedPnlPct: 0,
      weight: 0, // recalculated below
      eps: null,
      peRatio: null,
      totalEarnings: null,
      earningsYield: null,
      annualDividend: null,
      dividendYield: null,
      yieldOnCost: null,
      annualIncome: null,
      beta: null,
    })
  }

  // Step 8: Compute totals (convert Big.js to numbers)
  const baseTotals = {
    totalMarketValue: toDisplay(result.totals.totalMarketValue),
    totalCost: toDisplay(result.totals.totalCost),
    totalUnrealisedPnl: toDisplay(result.totals.totalUnrealisedPnl),
    totalRealisedPnl: toDisplay(result.totals.totalRealisedPnl),
  }

  // Add long option cost basis to totals
  const longOptionsCost = openLongOptions.reduce(
    (sum, o) => sum + o.premium * o.qty * 100,
    0,
  )
  baseTotals.totalMarketValue += longOptionsCost
  baseTotals.totalCost += longOptionsCost

  // Step 9: Compute options P&L (needed for both Options P&L card and cash balance)
  const symbolPrices = new Map<string, number>()
  for (const [sym, rec] of symbolMap) {
    if (rec.current_price != null) symbolPrices.set(sym, rec.current_price)
  }
  const optionsStats = computeStats(options, symbolPrices)
  const optionsPremium = optionsStats.totalPnl

  // Step 10: Calculate cash balance (all values converted to USD)
  // Track each component for debugging/display
  let cbDepositsGbp = 0
  let cbDepositsUsd = 0
  let cbBuys = 0
  let cbSells = 0
  let cbDividends = 0

  // + deposits: raw GBP sum + historical USD conversion
  for (const d of deposits) {
    cbDepositsGbp += d.amount
    cbDepositsUsd += d.amount_usd ?? d.amount / usdGbpRate
  }
  // FX P&L: difference between historical USD and current-rate USD
  const cbFxPnl = cbDepositsUsd - cbDepositsGbp / usdGbpRate
  // +/- stock transactions (buys/sells from transactions table only, no option capital gains)
  for (const tx of transactions) {
    const amount = tx.shares * tx.price
    if (tx.type === "Buy") {
      cbBuys += amount
    } else {
      cbSells += amount
    }
  }
  // + dividends
  for (const div of dividends) {
    cbDividends += div.amount
  }
  // Options net: uses computeStats totalPnl (includes commissions)
  const cbOptions = optionsPremium
  const cashBalance = Number(
    (cbDepositsUsd - cbBuys + cbSells + cbDividends + cbOptions).toFixed(2),
  )
  const cashBreakdown: CashBreakdown = {
    depositsGbp: Number(cbDepositsGbp.toFixed(2)),
    depositsUsd: Number(cbDepositsUsd.toFixed(2)),
    fxPnl: Number(cbFxPnl.toFixed(2)),
    stockBuys: Number(cbBuys.toFixed(2)),
    stockSells: Number(cbSells.toFixed(2)),
    dividends: Number(cbDividends.toFixed(2)),
    optionsNet: Number(cbOptions.toFixed(2)),
    total: cashBalance,
  }

  // Add cash to total market value for weight calculation
  const totalMarketValueWithCash =
    baseTotals.totalMarketValue + Math.max(0, cashBalance)

  // Add cash as a holding entry
  if (cashBalance !== 0) {
    displayHoldings.push({
      symbol: "CASH",
      name: "Cash",
      sector: null,
      strategy: null,
      platform: null,
      currentPrice: cashBalance,
      previousClose: null,
      changePct: null,
      shares: 1,
      avgCost: cashBalance,
      totalCost: cashBalance,
      marketValue: cashBalance,
      unrealisedPnl: 0,
      unrealisedPnlPct: 0,
      weight: 0, // recalculated below
      eps: null,
      peRatio: null,
      totalEarnings: null,
      earningsYield: null,
      annualDividend: null,
      dividendYield: null,
      yieldOnCost: null,
      annualIncome: null,
      beta: null,
    })
  }

  // Step 10: Recalculate weights for all holdings (stocks + options + cash)
  for (const h of displayHoldings) {
    h.weight =
      totalMarketValueWithCash !== 0
        ? Number(
            ((h.marketValue / totalMarketValueWithCash) * 100).toFixed(2),
          )
        : 0
  }

  // Step 11: Compute day change at portfolio level
  let dayChange = 0
  for (const h of displayHoldings) {
    if (h.changePct != null) {
      dayChange += h.marketValue * (h.changePct / 100)
    }
  }
  const dayChangePct =
    totalMarketValueWithCash !== 0
      ? (dayChange / totalMarketValueWithCash) * 100
      : 0

  // Step 12: Total deposited is the raw GBP sum
  const totalDeposited = cbDepositsGbp

  return {
    holdings: displayHoldings,
    totals: {
      totalMarketValue: Number(totalMarketValueWithCash.toFixed(2)),
      totalCost: Number(baseTotals.totalCost.toFixed(2)),
      totalUnrealisedPnl: Number(baseTotals.totalUnrealisedPnl.toFixed(2)),
      totalRealisedPnl: Number(baseTotals.totalRealisedPnl.toFixed(2)),
    },
    totalDeposited: Number(totalDeposited.toFixed(2)),
    optionsPremium: Number(optionsPremium.toFixed(2)),
    dayChange: Number(dayChange.toFixed(2)),
    dayChangePct: Number(dayChangePct.toFixed(2)),
    cashBalance,
    cashBreakdown,
    forexRate: usdGbpRate,
    options,
    transactions,
  }
}
