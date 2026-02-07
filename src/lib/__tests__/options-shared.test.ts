import { describe, expect, it } from "vitest"
import type { OptionRecord } from "../types"
import {
  computeProfit,
  computeDaysHeld,
  computeReturnPct,
  computeLeapsDisplay,
  inferRollChains,
  buildPremiumByMonth,
  buildOptionsRows,
  isShortStrategy,
  isLongStrategy,
} from "../options-shared"

// ---------------------------------------------------------------------------
// Test Fixture Builder
// ---------------------------------------------------------------------------

/** Minimal defaults — override what you need per test. */
function makeOption(overrides: Partial<OptionRecord> & { Id: number }): OptionRecord {
  return {
    ticker: "AAPL",
    opened: "2024-01-15",
    strategy_type: "Wheel",
    call_put: "Put",
    buy_sell: "Sell",
    expiration: "2024-02-16",
    strike: 180,
    delta: null,
    iv_pct: null,
    moneyness: null,
    qty: 1,
    premium: 3.5,
    collateral: 18000,
    status: "Closed",
    close_date: "2024-02-10",
    close_premium: 0.5,
    outer_strike: null,
    commission: null,
    platform: "IBKR",
    notes: null,
    ...overrides,
  }
}

// ============================================================================
// isShortStrategy / isLongStrategy
// ============================================================================

describe("isShortStrategy", () => {
  it("returns true for Wheel, Collar, VPCS", () => {
    expect(isShortStrategy("Wheel")).toBe(true)
    expect(isShortStrategy("Collar")).toBe(true)
    expect(isShortStrategy("VPCS")).toBe(true)
  })

  it("returns false for LEAPS, BET, Spread", () => {
    expect(isShortStrategy("LEAPS")).toBe(false)
    expect(isShortStrategy("BET")).toBe(false)
    expect(isShortStrategy("Spread")).toBe(false)
  })
})

describe("isLongStrategy", () => {
  it("returns true for LEAPS, BET", () => {
    expect(isLongStrategy("LEAPS")).toBe(true)
    expect(isLongStrategy("BET")).toBe(true)
  })

  it("returns false for Wheel, Collar, VPCS, Spread", () => {
    expect(isLongStrategy("Wheel")).toBe(false)
    expect(isLongStrategy("Collar")).toBe(false)
    expect(isLongStrategy("Spread")).toBe(false)
  })
})

// ============================================================================
// computeProfit
// ============================================================================

describe("computeProfit", () => {
  // --- Sell options (credit spreads / wheel) ---

  it("sell option: profit = (premium - closePremium) × qty × 100", () => {
    const opt = makeOption({
      Id: 1,
      buy_sell: "Sell",
      premium: 3.5,
      close_premium: 0.5,
      qty: 1,
    })
    // (3.5 - 0.5) × 1 × 100 = 300
    expect(computeProfit(opt)).toBe(300)
  })

  it("sell option with multiple contracts", () => {
    const opt = makeOption({
      Id: 2,
      buy_sell: "Sell",
      premium: 2.0,
      close_premium: 1.0,
      qty: 3,
    })
    // (2.0 - 1.0) × 3 × 100 = 300
    expect(computeProfit(opt)).toBe(300)
  })

  it("sell option: losing trade (close > open)", () => {
    const opt = makeOption({
      Id: 3,
      buy_sell: "Sell",
      premium: 1.5,
      close_premium: 4.0,
      qty: 1,
    })
    // (1.5 - 4.0) × 1 × 100 = -250
    expect(computeProfit(opt)).toBe(-250)
  })

  // --- Buy options (LEAPS) ---

  it("buy option: profit = (closePremium - premium) × qty × 100", () => {
    const opt = makeOption({
      Id: 4,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 5.0,
      close_premium: 8.0,
      qty: 2,
      status: "Closed",
    })
    // (8.0 - 5.0) × 2 × 100 = 600
    expect(computeProfit(opt)).toBe(600)
  })

  it("buy option: losing trade", () => {
    const opt = makeOption({
      Id: 5,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 12.0,
      close_premium: 3.0,
      qty: 1,
      status: "Closed",
    })
    // (3.0 - 12.0) × 1 × 100 = -900
    expect(computeProfit(opt)).toBe(-900)
  })

  // --- Expired / Assigned ---

  it("expired sell: treats null close_premium as 0 (max profit)", () => {
    const opt = makeOption({
      Id: 6,
      buy_sell: "Sell",
      premium: 2.5,
      close_premium: null,
      status: "Expired",
      qty: 1,
    })
    // (2.5 - 0) × 1 × 100 = 250
    expect(computeProfit(opt)).toBe(250)
  })

  it("assigned sell put: treats null close_premium as 0", () => {
    const opt = makeOption({
      Id: 7,
      buy_sell: "Sell",
      premium: 3.0,
      close_premium: null,
      status: "Assigned",
      qty: 1,
    })
    // (3.0 - 0) × 1 × 100 = 300
    expect(computeProfit(opt)).toBe(300)
  })

  it("expired buy: treats null close_premium as 0 (total loss)", () => {
    const opt = makeOption({
      Id: 8,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 10.0,
      close_premium: null,
      status: "Expired",
      qty: 1,
    })
    // (0 - 10.0) × 1 × 100 = -1000
    expect(computeProfit(opt)).toBe(-1000)
  })

  // --- Open positions ---

  it("open position with no close_premium returns null", () => {
    const opt = makeOption({
      Id: 9,
      buy_sell: "Sell",
      close_premium: null,
      status: "Open",
    })
    expect(computeProfit(opt)).toBeNull()
  })

  it("open position with close_premium still returns computed value", () => {
    // Edge case: should not happen in practice, but close_premium takes priority
    const opt = makeOption({
      Id: 10,
      buy_sell: "Sell",
      premium: 2.0,
      close_premium: 0.5,
      status: "Open",
      qty: 1,
    })
    // close_premium is not null, so compute: (2.0 - 0.5) × 100 = 150
    expect(computeProfit(opt)).toBe(150)
  })

  // --- Rolled ---

  it("rolled sell with close_premium computes profit for that leg", () => {
    const opt = makeOption({
      Id: 11,
      buy_sell: "Sell",
      premium: 2.0,
      close_premium: 1.5,
      status: "Rolled",
      qty: 1,
    })
    // (2.0 - 1.5) × 100 = 50
    expect(computeProfit(opt)).toBe(50)
  })

  it("rolled without close_premium returns null", () => {
    const opt = makeOption({
      Id: 12,
      buy_sell: "Sell",
      close_premium: null,
      status: "Rolled",
    })
    expect(computeProfit(opt)).toBeNull()
  })
})

// ============================================================================
// computeDaysHeld
// ============================================================================

describe("computeDaysHeld", () => {
  it("closed position: days between opened and close_date", () => {
    const opt = makeOption({
      Id: 1,
      opened: "2024-01-01",
      close_date: "2024-01-31",
    })
    expect(computeDaysHeld(opt)).toBe(30)
  })

  it("same-day close returns 0", () => {
    const opt = makeOption({
      Id: 2,
      opened: "2024-06-15",
      close_date: "2024-06-15",
    })
    expect(computeDaysHeld(opt)).toBe(0)
  })

  it("open position: days between opened and today", () => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    const opt = makeOption({
      Id: 3,
      opened: thirtyDaysAgo.toISOString().split("T")[0],
      close_date: null,
    })
    expect(computeDaysHeld(opt)).toBe(30)
  })
})

// ============================================================================
// computeReturnPct
// ============================================================================

describe("computeReturnPct", () => {
  // --- Short options: annualised return on collateral ---

  it("short option: annualised return = (profit / collateral) × (365 / days) × 100", () => {
    const opt = makeOption({
      Id: 1,
      buy_sell: "Sell",
      strategy_type: "Wheel",
      premium: 3.0,
      close_premium: 0.5,
      qty: 1,
      collateral: 18000,
      opened: "2024-01-01",
      close_date: "2024-01-31",
    })
    // profit = (3.0 - 0.5) × 100 = 250
    // daysHeld = 30
    // return = (250 / 18000) × (365 / 30) × 100 = 16.90%
    const result = computeReturnPct(opt)!
    expect(result).toBeCloseTo(16.9, 0)
  })

  it("short option: returns null when collateral is null", () => {
    const opt = makeOption({
      Id: 2,
      buy_sell: "Sell",
      strategy_type: "Wheel",
      premium: 2.0,
      close_premium: 0.5,
      qty: 1,
      collateral: null,
      opened: "2024-01-01",
      close_date: "2024-01-31",
    })
    expect(computeReturnPct(opt)).toBeNull()
  })

  it("short option: returns null when collateral is 0", () => {
    const opt = makeOption({
      Id: 3,
      buy_sell: "Sell",
      strategy_type: "Wheel",
      premium: 2.0,
      close_premium: 0.5,
      qty: 1,
      collateral: 0,
      opened: "2024-01-01",
      close_date: "2024-01-31",
    })
    expect(computeReturnPct(opt)).toBeNull()
  })

  // --- Long options: profit yield ---

  it("long option: return = (profit / costBasis) × 100", () => {
    const opt = makeOption({
      Id: 4,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 5.0,
      close_premium: 8.0,
      qty: 2,
      opened: "2024-01-01",
      close_date: "2024-07-01",
    })
    // profit = (8.0 - 5.0) × 2 × 100 = 600
    // costBasis = 5.0 × 2 × 100 = 1000
    // return = (600 / 1000) × 100 = 60%
    expect(computeReturnPct(opt)).toBeCloseTo(60, 1)
  })

  it("long option: negative return on loss", () => {
    const opt = makeOption({
      Id: 5,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 10.0,
      close_premium: 3.0,
      qty: 1,
      opened: "2024-01-01",
      close_date: "2024-06-01",
    })
    // profit = (3.0 - 10.0) × 100 = -700
    // costBasis = 10.0 × 100 = 1000
    // return = (-700 / 1000) × 100 = -70%
    expect(computeReturnPct(opt)).toBeCloseTo(-70, 1)
  })

  // --- Edge cases ---

  it("returns null when profit is null (open position)", () => {
    const opt = makeOption({
      Id: 6,
      close_premium: null,
      status: "Open",
    })
    expect(computeReturnPct(opt)).toBeNull()
  })

  it("returns null when daysHeld is 0 (same-day open/close)", () => {
    const opt = makeOption({
      Id: 7,
      opened: "2024-06-15",
      close_date: "2024-06-15",
      premium: 2.0,
      close_premium: 0.5,
    })
    expect(computeReturnPct(opt)).toBeNull()
  })
})

// ============================================================================
// computeLeapsDisplay
// ============================================================================

describe("computeLeapsDisplay", () => {
  // --- Call options ---

  it("call: intrinsic = currentPrice - strike (can be negative for OTM)", () => {
    const opt = makeOption({
      Id: 1,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 10,
      premium: 5.95,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 15.88)

    // intrinsic = 15.88 - 10 = 5.88
    expect(result.intrinsicValue).toBeCloseTo(5.88, 2)
    // extrinsic = 5.95 - 5.88 = 0.07
    expect(result.extrinsicValue).toBeCloseTo(0.07, 2)
    // costBasis = 10 + 5.95 = 15.95 (per share)
    expect(result.costBasis).toBeCloseTo(15.95, 2)
  })

  it("call OTM: negative intrinsic", () => {
    const opt = makeOption({
      Id: 2,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 20,
      premium: 3.0,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 15.0)

    // intrinsic = 15.0 - 20 = -5.0 (OTM — NOT floored to 0)
    expect(result.intrinsicValue).toBe(-5)
    // extrinsic = 3.0 - (-5.0) = 8.0
    expect(result.extrinsicValue).toBe(8)
  })

  // --- Put options ---

  it("put: intrinsic = strike - currentPrice", () => {
    const opt = makeOption({
      Id: 3,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Put",
      strike: 50,
      premium: 8.0,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 42.0)

    // intrinsic = 50 - 42 = 8
    expect(result.intrinsicValue).toBe(8)
    // extrinsic = 8.0 - 8 = 0
    expect(result.extrinsicValue).toBe(0)
    // costBasis = 50 - 8.0 = 42 (per share)
    expect(result.costBasis).toBe(42)
  })

  // --- Premium Fee % ---

  it("premiumFeePct = extrinsic / currentPrice × 100", () => {
    const opt = makeOption({
      Id: 4,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 10,
      premium: 6.0,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 15.0)

    // intrinsic = 15.0 - 10 = 5.0
    // extrinsic = 6.0 - 5.0 = 1.0
    // premiumFeePct = 1.0 / 15.0 × 100 = 6.67%
    expect(result.premiumFeePct).toBeCloseTo(6.67, 1)
  })

  // --- $/Month Lost (time decay) ---

  it("valueLostPerMonth = (extrinsic / initialDte) × 30 × 100", () => {
    const opt = makeOption({
      Id: 5,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 10,
      premium: 5.95,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 15.88)

    // intrinsic = 15.88 - 10 = 5.88
    // extrinsic = 5.95 - 5.88 = 0.07
    // initialDte = days from 2024-01-15 to 2026-01-16 = 732
    // valueLostPerMonth = (0.07 / 732) × 30 × 100 = $0.287
    expect(result.valueLostPerMonth).toBeCloseTo(0.287, 1)
  })

  // --- P&L ---

  it("currentPnl uses intrinsic value for open bought positions", () => {
    const opt = makeOption({
      Id: 6,
      buy_sell: "Buy",
      call_put: "Call",
      strategy_type: "LEAPS",
      strike: 15,
      premium: 5.0,
      close_premium: null,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    // Call: intrinsic = max(0, 20 - 15) = 5, P&L = (5 - 5) × 1 × 100 = 0
    const result = computeLeapsDisplay(opt, 20.0)
    expect(result.currentPnl).toBe(0)
  })

  it("currentPnl uses intrinsic value for open ITM call", () => {
    const opt = makeOption({
      Id: 61,
      buy_sell: "Buy",
      call_put: "Call",
      strategy_type: "LEAPS",
      strike: 10,
      premium: 3.0,
      close_premium: null,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    // Call: intrinsic = max(0, 25 - 10) = 15, P&L = (15 - 3) × 1 × 100 = 1200
    const result = computeLeapsDisplay(opt, 25.0)
    expect(result.currentPnl).toBe(1200)
  })

  it("currentPnl is null for open sold positions", () => {
    const opt = makeOption({
      Id: 62,
      buy_sell: "Sell",
      strategy_type: "Wheel",
      premium: 3.0,
      close_premium: null,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, 20.0)
    expect(result.currentPnl).toBeNull()
  })

  it("currentPnl computed for closed LEAPS", () => {
    const opt = makeOption({
      Id: 7,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      premium: 5.0,
      close_premium: 8.0,
      status: "Closed",
      qty: 1,
      opened: "2024-01-15",
      expiration: "2026-01-16",
      close_date: "2024-06-15",
    })
    const result = computeLeapsDisplay(opt, 25.0)
    // (8.0 - 5.0) × 1 × 100 = 300
    expect(result.currentPnl).toBe(300)
  })

  // --- DTE ---

  it("daysToExpiry > 0 for open options", () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const opt = makeOption({
      Id: 8,
      status: "Open",
      opened: "2024-01-15",
      expiration: futureDate.toISOString().split("T")[0],
    })
    const result = computeLeapsDisplay(opt, 20.0)
    expect(result.daysToExpiry).toBeGreaterThan(300)
  })

  it("daysToExpiry = 0 for closed options", () => {
    const opt = makeOption({
      Id: 9,
      status: "Closed",
      opened: "2024-01-15",
      expiration: "2026-01-16",
      close_date: "2024-06-15",
    })
    const result = computeLeapsDisplay(opt, 20.0)
    expect(result.daysToExpiry).toBe(0)
  })

  // --- Null currentPrice ---

  it("all derived values are null when currentPrice is null", () => {
    const opt = makeOption({
      Id: 10,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const result = computeLeapsDisplay(opt, null)
    expect(result.intrinsicValue).toBeNull()
    expect(result.extrinsicValue).toBeNull()
    expect(result.costBasis).toBeNull()
    expect(result.valueLostPerMonth).toBeNull()
    expect(result.premiumFeePct).toBeNull()
  })
})

// ============================================================================
// inferRollChains
// ============================================================================

describe("inferRollChains", () => {
  it("chains two consecutive rolled options into one chain", () => {
    const leg1 = makeOption({
      Id: 1,
      ticker: "AAPL",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-28",
      premium: 2.0,
      close_premium: 1.5,
      qty: 1,
    })
    const leg2 = makeOption({
      Id: 2,
      ticker: "AAPL",
      call_put: "Put",
      status: "Closed",
      opened: "2024-01-29",
      close_date: "2024-02-20",
      premium: 3.0,
      close_premium: 0.5,
      qty: 1,
    })

    const { chains, standalone } = inferRollChains([leg1, leg2])

    expect(chains).toHaveLength(1)
    expect(chains[0].head).toBe(leg2)
    expect(chains[0].legs).toEqual([leg1])
    // totalProfit = (2.0 - 1.5) × 100 + (3.0 - 0.5) × 100 = 50 + 250 = 300
    expect(chains[0].totalProfit).toBe(300)
    // totalPremium = 2.0 × 100 + 3.0 × 100 = 500
    expect(chains[0].totalPremium).toBe(500)
    expect(standalone).toHaveLength(0)
  })

  it("three-leg roll chain", () => {
    const leg1 = makeOption({
      Id: 1,
      ticker: "TSLA",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-28",
      premium: 2.0,
      close_premium: 1.0,
      qty: 1,
    })
    const leg2 = makeOption({
      Id: 2,
      ticker: "TSLA",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-29",
      close_date: "2024-02-20",
      premium: 3.0,
      close_premium: 2.0,
      qty: 1,
    })
    const leg3 = makeOption({
      Id: 3,
      ticker: "TSLA",
      call_put: "Put",
      status: "Expired",
      opened: "2024-02-21",
      close_date: "2024-03-15",
      premium: 2.5,
      close_premium: null,
      qty: 1,
    })

    const { chains, standalone } = inferRollChains([leg1, leg2, leg3])

    expect(chains).toHaveLength(1)
    expect(chains[0].head).toBe(leg3)
    expect(chains[0].legs).toEqual([leg1, leg2])
    // leg1: (2-1) × 100 = 100, leg2: (3-2) × 100 = 100, leg3: expired = (2.5-0) × 100 = 250
    expect(chains[0].totalProfit).toBe(450)
    expect(standalone).toHaveLength(0)
  })

  it("does not chain options with different call_put", () => {
    const put = makeOption({
      Id: 1,
      ticker: "AAPL",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-28",
    })
    const call = makeOption({
      Id: 2,
      ticker: "AAPL",
      call_put: "Call",
      status: "Closed",
      opened: "2024-01-29",
      close_date: "2024-02-20",
    })

    const { chains, standalone } = inferRollChains([put, call])

    expect(chains).toHaveLength(0)
    expect(standalone).toHaveLength(2)
  })

  it("does not chain options with different tickers", () => {
    const opt1 = makeOption({
      Id: 1,
      ticker: "AAPL",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-28",
    })
    const opt2 = makeOption({
      Id: 2,
      ticker: "MSFT",
      call_put: "Put",
      status: "Closed",
      opened: "2024-01-29",
      close_date: "2024-02-20",
    })

    const { chains, standalone } = inferRollChains([opt1, opt2])

    expect(chains).toHaveLength(0)
    expect(standalone).toHaveLength(2)
  })

  it("does not chain when gap exceeds 30 days", () => {
    const opt1 = makeOption({
      Id: 1,
      ticker: "AAPL",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-15",
    })
    const opt2 = makeOption({
      Id: 2,
      ticker: "AAPL",
      call_put: "Put",
      status: "Closed",
      opened: "2024-02-20", // 36 days after close — too far
      close_date: "2024-03-20",
    })

    const { chains, standalone } = inferRollChains([opt1, opt2])

    expect(chains).toHaveLength(0)
    expect(standalone).toHaveLength(2)
  })

  it("prefers Rolled candidates over terminal statuses to build longer chains", () => {
    // Real scenario: NU puts where replacement opened before original closed
    const leg1 = makeOption({
      Id: 1,
      ticker: "NU",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-11-29",
      close_date: "2024-12-18",
      premium: 0.23,
      close_premium: 1.57,
      qty: 20,
      delta: 0.32,
      collateral: 3000,
    })
    const leg2 = makeOption({
      Id: 2,
      ticker: "NU",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-12-10", // 8 days before leg1 close — early replacement
      close_date: "2025-02-18",
      premium: 1.69,
      close_premium: 0.30,
      qty: 20,
      delta: 0.62,
      strike: 13,
      collateral: 26000,
    })
    const leg3 = makeOption({
      Id: 3,
      ticker: "NU",
      call_put: "Put",
      status: "Closed",
      opened: "2024-12-18",
      close_date: "2025-01-27",
      premium: 2.11,
      close_premium: 0.51,
      qty: 20,
      delta: 0.71,
      collateral: 24000,
    })

    const { chains, standalone } = inferRollChains([leg1, leg2, leg3])

    expect(chains).toHaveLength(1)
    expect(chains[0].legs).toHaveLength(2)
    expect(chains[0].head).toBe(leg3) // Closed option is the head
    expect(standalone).toHaveLength(0)
  })

  it("chains TSLA-style long roll sequence with same-day openers", () => {
    // Two options opened same day; one closes early (dead end), the other
    // continues a long chain. The early-close option should chain through
    // the late-close option into the main chain.
    const a = makeOption({
      Id: 10,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-05-21",
      close_date: "2024-06-06",
      strike: 195,
      premium: 23.02,
      close_premium: 9.01,
      qty: 1,
    })
    const b = makeOption({
      Id: 11,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-05-21",
      close_date: "2024-07-12",
      strike: 215,
      premium: 9.27,
      close_premium: 41.00,
      qty: 1,
    })
    const c = makeOption({
      Id: 12,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-07-12",
      close_date: "2024-10-11",
      strike: 230,
      premium: 40.69,
      close_premium: 17.75,
      qty: 1,
    })
    const d = makeOption({
      Id: 13,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-10-11",
      close_date: "2024-11-04",
      strike: 220,
      premium: 17.05,
      close_premium: 27.83,
      qty: 1,
    })
    const e = makeOption({
      Id: 14,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-11-04",
      close_date: "2024-11-11",
      strike: 240,
      premium: 26.33,
      close_premium: 103.86,
      qty: 1,
    })
    const f = makeOption({
      Id: 15,
      ticker: "TSLA",
      call_put: "Call",
      status: "Rolled",
      opened: "2024-11-11",
      close_date: "2025-03-11",
      strike: 390,
      premium: 102.60,
      close_premium: 44.31,
      qty: 1,
    })
    const g = makeOption({
      Id: 16,
      ticker: "TSLA",
      call_put: "Call",
      status: "Assigned",
      opened: "2025-03-11",
      close_date: "2025-04-26",
      strike: 195,
      premium: 231.45,
      close_premium: 0,
      qty: 1,
    })

    // Pass in shuffled order to test robustness
    const { chains, standalone } = inferRollChains([g, c, a, f, b, d, e])

    expect(chains).toHaveLength(1)
    expect(chains[0].legs).toHaveLength(6)
    expect(chains[0].head).toBe(g)
    expect(standalone).toHaveLength(0)
  })

  it("standalone options returned correctly", () => {
    const opt = makeOption({
      Id: 1,
      status: "Closed",
      opened: "2024-01-15",
      close_date: "2024-02-10",
    })

    const { chains, standalone } = inferRollChains([opt])

    expect(chains).toHaveLength(0)
    expect(standalone).toHaveLength(1)
    expect(standalone[0]).toBe(opt)
  })

  it("empty array returns empty results", () => {
    const { chains, standalone } = inferRollChains([])
    expect(chains).toHaveLength(0)
    expect(standalone).toHaveLength(0)
  })
})

// ============================================================================
// buildPremiumByMonth
// ============================================================================

describe("buildPremiumByMonth", () => {
  it("returns 12 months with zero fills", () => {
    const result = buildPremiumByMonth([], 2024)
    expect(result).toHaveLength(12)
    expect(result[0]).toEqual({ month: "Jan", wheel: 0, leaps: 0 })
    expect(result[11]).toEqual({ month: "Dec", wheel: 0, leaps: 0 })
  })

  it("accumulates Wheel premium in correct month", () => {
    const opt = makeOption({
      Id: 1,
      strategy_type: "Wheel",
      opened: "2024-03-15",
      premium: 2.5,
      qty: 2,
    })
    const result = buildPremiumByMonth([opt], 2024)

    // March = index 2, premium = 2.5 × 2 × 100 = 500
    expect(result[2].wheel).toBe(500)
    expect(result[2].leaps).toBe(0)
  })

  it("accumulates LEAPS premium in correct month", () => {
    const opt = makeOption({
      Id: 2,
      strategy_type: "LEAPS",
      buy_sell: "Buy",
      opened: "2024-06-01",
      premium: 8.0,
      qty: 1,
    })
    const result = buildPremiumByMonth([opt], 2024)

    // June = index 5, premium = 8.0 × 1 × 100 = 800
    expect(result[5].leaps).toBe(800)
    expect(result[5].wheel).toBe(0)
  })

  it("filters by year", () => {
    const opt2023 = makeOption({ Id: 1, opened: "2023-06-15", strategy_type: "Wheel", premium: 5.0, qty: 1 })
    const opt2024 = makeOption({ Id: 2, opened: "2024-06-15", strategy_type: "Wheel", premium: 3.0, qty: 1 })

    const result = buildPremiumByMonth([opt2023, opt2024], 2024)
    expect(result[5].wheel).toBe(300) // Only 2024 option
  })

  it("Spread strategy is not tracked", () => {
    const opt = makeOption({
      Id: 1,
      strategy_type: "Spread",
      opened: "2024-03-15",
      premium: 5.0,
      qty: 1,
    })
    const result = buildPremiumByMonth([opt], 2024)
    expect(result[2].wheel).toBe(0)
    expect(result[2].leaps).toBe(0)
  })

  it("multiple options in same month accumulate", () => {
    const opt1 = makeOption({ Id: 1, strategy_type: "Wheel", opened: "2024-03-01", premium: 2.0, qty: 1 })
    const opt2 = makeOption({ Id: 2, strategy_type: "Wheel", opened: "2024-03-15", premium: 3.0, qty: 1 })

    const result = buildPremiumByMonth([opt1, opt2], 2024)
    // 2.0 × 100 + 3.0 × 100 = 500
    expect(result[2].wheel).toBe(500)
  })
})

// ============================================================================
// buildOptionsRows
// ============================================================================

describe("buildOptionsRows", () => {
  it("standalone options become flat rows", () => {
    const opt1 = makeOption({ Id: 1, ticker: "AAPL", status: "Closed" })
    const opt2 = makeOption({ Id: 2, ticker: "MSFT", status: "Expired" })

    const rows = buildOptionsRows([opt1, opt2])

    expect(rows).toHaveLength(2)
    expect(rows[0].isChainHead).toBe(false)
    expect(rows[0].cumulativeProfit).toBeNull()
    expect(rows[0].cumulativePremium).toBeNull()
    expect(rows[0].subRows).toBeUndefined()
  })

  it("roll chain becomes head row with sub-rows", () => {
    const leg1 = makeOption({
      Id: 1,
      ticker: "AAPL",
      call_put: "Put",
      status: "Rolled",
      opened: "2024-01-01",
      close_date: "2024-01-28",
      premium: 2.0,
      close_premium: 1.0,
      qty: 1,
    })
    const leg2 = makeOption({
      Id: 2,
      ticker: "AAPL",
      call_put: "Put",
      status: "Closed",
      opened: "2024-01-29",
      close_date: "2024-02-20",
      premium: 3.0,
      close_premium: 0.5,
      qty: 1,
    })

    const rows = buildOptionsRows([leg1, leg2])

    expect(rows).toHaveLength(1) // Only head row at top level
    expect(rows[0].isChainHead).toBe(true)
    expect(rows[0].option).toBe(leg2) // Head is the latest
    expect(rows[0].subRows).toHaveLength(1)
    expect(rows[0].subRows![0].option).toBe(leg1)
    // cumulative profit = 100 + 250 = 350
    expect(rows[0].cumulativeProfit).toBe(350)
    // cumulative premium = 200 + 300 = 500
    expect(rows[0].cumulativePremium).toBe(500)
  })
})

// ============================================================================
// Stats Logic Integration
// ============================================================================
// computeStats is private in options.ts (behind server-only), but we test
// the same aggregation logic using the exported pure functions.
// ============================================================================

describe("stats aggregation logic", () => {
  const CLOSED_STATUSES: OptionRecord["status"][] = ["Closed", "Expired", "Assigned", "Rolled"]

  function computeStatsFromOptions(options: OptionRecord[]) {
    const shortPnl = options
      .filter((o) => o.buy_sell === "Sell")
      .reduce((sum, o) => sum + (computeProfit(o) ?? (o.premium * o.qty * 100)), 0)

    const longPnl = options
      .filter((o) => o.buy_sell === "Buy")
      .reduce((sum, o) => sum + (computeProfit(o) ?? 0), 0)

    const totalCommission = options
      .filter((o) => o.commission != null)
      .reduce((sum, o) => sum + o.commission! * o.qty, 0)

    const totalPnl = shortPnl + longPnl + totalCommission

    const closedOptions = options.filter((o) => CLOSED_STATUSES.includes(o.status))
    const profitable = closedOptions.filter((o) => (computeProfit(o) ?? 0) > 0)
    const winRate = closedOptions.length > 0
      ? (profitable.length / closedOptions.length) * 100
      : 0

    const closedWithDays = closedOptions.filter((o) => o.close_date != null)
    const avgDaysHeld = closedWithDays.length > 0
      ? closedWithDays.reduce((sum, o) => sum + computeDaysHeld(o), 0) / closedWithDays.length
      : 0

    return { totalPnl, shortPnl, longPnl, totalCommission, winRate, avgDaysHeld }
  }

  it("shortPnl: net premium from sell options", () => {
    const options = [
      // Closed sell: profit = (2.0 - 0.5) × 100 = 150
      makeOption({ Id: 1, buy_sell: "Sell", premium: 2.0, close_premium: 0.5, qty: 1, status: "Closed" }),
      // Expired sell: profit = (3.0 - 0) × 100 = 300
      makeOption({ Id: 2, buy_sell: "Sell", premium: 3.0, close_premium: null, qty: 1, status: "Expired" }),
      // Open sell: computeProfit returns null, falls back to gross = 1.5 × 100 = 150
      makeOption({ Id: 3, buy_sell: "Sell", premium: 1.5, close_premium: null, qty: 1, status: "Open" }),
      // Buy option: should be excluded
      makeOption({ Id: 4, buy_sell: "Buy", premium: 5.0, close_premium: 8.0, qty: 1, status: "Closed" }),
    ]

    const stats = computeStatsFromOptions(options)
    // 150 + 300 + 150 = 600
    expect(stats.shortPnl).toBe(600)
  })

  it("longPnl: only from buy options", () => {
    const options = [
      // Buy closed: profit = (8.0 - 5.0) × 100 = 300
      makeOption({ Id: 1, buy_sell: "Buy", strategy_type: "LEAPS", premium: 5.0, close_premium: 8.0, qty: 1, status: "Closed" }),
      // Buy closed loss: profit = (2.0 - 10.0) × 100 = -800
      makeOption({ Id: 2, buy_sell: "Buy", strategy_type: "LEAPS", premium: 10.0, close_premium: 2.0, qty: 1, status: "Closed" }),
      // Buy open: computeProfit null → 0
      makeOption({ Id: 3, buy_sell: "Buy", strategy_type: "LEAPS", premium: 7.0, close_premium: null, qty: 1, status: "Open" }),
      // Sell option: excluded
      makeOption({ Id: 4, buy_sell: "Sell", premium: 2.0, close_premium: 0.5, qty: 1, status: "Closed" }),
    ]

    const stats = computeStatsFromOptions(options)
    // 300 + (-800) + 0 = -500
    expect(stats.longPnl).toBe(-500)
  })

  it("totalPnl: combines short and long P&L", () => {
    const options = [
      // Sell closed: profit = (2.0 - 0.5) × 100 = 150
      makeOption({ Id: 1, buy_sell: "Sell", premium: 2.0, close_premium: 0.5, qty: 1, status: "Closed" }),
      // Buy closed: profit = (8.0 - 5.0) × 100 = 300
      makeOption({ Id: 2, buy_sell: "Buy", strategy_type: "LEAPS", premium: 5.0, close_premium: 8.0, qty: 1, status: "Closed" }),
    ]

    const stats = computeStatsFromOptions(options)
    // 150 + 300 = 450
    expect(stats.totalPnl).toBe(450)
    expect(stats.shortPnl).toBe(150)
    expect(stats.longPnl).toBe(300)
  })

  it("winRate: profitable closed / total closed × 100", () => {
    const options = [
      // Closed, profitable: profit = 300
      makeOption({ Id: 1, buy_sell: "Sell", premium: 3.5, close_premium: 0.5, qty: 1, status: "Closed" }),
      // Expired, profitable: profit = 200
      makeOption({ Id: 2, buy_sell: "Sell", premium: 2.0, close_premium: null, qty: 1, status: "Expired" }),
      // Closed, loss: profit = -100
      makeOption({ Id: 3, buy_sell: "Sell", premium: 1.0, close_premium: 2.0, qty: 1, status: "Closed" }),
      // Open: not in closed statuses
      makeOption({ Id: 4, buy_sell: "Sell", premium: 1.5, close_premium: null, qty: 1, status: "Open" }),
    ]

    const stats = computeStatsFromOptions(options)
    // 2 profitable out of 3 closed = 66.67%
    expect(stats.winRate).toBeCloseTo(66.67, 1)
  })

  it("avgDaysHeld: average across closed with close_date", () => {
    const options = [
      makeOption({ Id: 1, opened: "2024-01-01", close_date: "2024-01-31", status: "Closed" }), // 30 days
      makeOption({ Id: 2, opened: "2024-01-01", close_date: "2024-01-11", status: "Expired" }), // 10 days
      makeOption({ Id: 3, opened: "2024-01-01", close_date: null, status: "Expired" }), // no close_date, excluded
    ]

    const stats = computeStatsFromOptions(options)
    // (30 + 10) / 2 = 20
    expect(stats.avgDaysHeld).toBe(20)
  })

  it("totalCommission: summed and subtracted from totalPnl", () => {
    const options = [
      // Sell closed: profit = (2.0 - 0.5) × 100 = 150, commission = -3.50
      makeOption({ Id: 1, buy_sell: "Sell", premium: 2.0, close_premium: 0.5, qty: 1, status: "Closed", commission: -3.50 }),
      // Buy closed: profit = (8.0 - 5.0) × 100 = 300, commission = -2.00
      makeOption({ Id: 2, buy_sell: "Buy", strategy_type: "LEAPS", premium: 5.0, close_premium: 8.0, qty: 1, status: "Closed", commission: -2.00 }),
      // No commission
      makeOption({ Id: 3, buy_sell: "Sell", premium: 1.0, close_premium: null, qty: 1, status: "Expired" }),
    ]

    const stats = computeStatsFromOptions(options)
    expect(stats.shortPnl).toBe(250) // 150 + 100 (expired)
    expect(stats.longPnl).toBe(300)
    expect(stats.totalCommission).toBe(-5.50)
    // totalPnl = 250 + 300 + (-5.50) = 544.50
    expect(stats.totalPnl).toBe(544.50)
  })

  it("empty options returns zeroes", () => {
    const stats = computeStatsFromOptions([])
    expect(stats.totalPnl).toBe(0)
    expect(stats.shortPnl).toBe(0)
    expect(stats.longPnl).toBe(0)
    expect(stats.totalCommission).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.avgDaysHeld).toBe(0)
  })
})

// ============================================================================
// Yearly Stats Computation Logic
// ============================================================================
// Tests the same aggregation logic used in yearly-stats-table.tsx
// ============================================================================

describe("yearly stats computation", () => {
  function computeYearlyStats(options: OptionRecord[]) {
    const CLOSED_STATUSES: OptionRecord["status"][] = ["Closed", "Expired", "Assigned", "Rolled"]
    const closedShort = options.filter(
      (o) => isShortStrategy(o.strategy_type) && CLOSED_STATUSES.includes(o.status),
    )

    const byYear = new Map<number, OptionRecord[]>()
    for (const opt of closedShort) {
      const year = new Date(opt.opened).getFullYear()
      const group = byYear.get(year) ?? []
      group.push(opt)
      byYear.set(year, group)
    }

    const stats: Array<{
      year: number
      avgProfitYield: number
      avgDaysHeld: number
      avgReturn: number
      avgCollateral: number
      avgIv: number
      avgDelta: number
      totalProfit: number
      count: number
    }> = []

    for (const [year, opts] of byYear) {
      const profitYields = opts
        .filter((o) => o.collateral != null && o.collateral > 0 && computeProfit(o) != null)
        .map((o) => (computeProfit(o)! / o.collateral!) * 100)
      const avgProfitYield = profitYields.length > 0
        ? profitYields.reduce((a, b) => a + b, 0) / profitYields.length
        : 0

      const daysArr = opts.filter((o) => o.close_date != null).map((o) => computeDaysHeld(o))
      const avgDaysHeld = daysArr.length > 0
        ? daysArr.reduce((a, b) => a + b, 0) / daysArr.length
        : 0

      const returns = opts.map((o) => computeReturnPct(o)).filter((v): v is number => v != null)
      const avgReturn = returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : 0

      const collaterals = opts.filter((o) => o.collateral != null).map((o) => o.collateral!)
      const avgCollateral = collaterals.length > 0
        ? collaterals.reduce((a, b) => a + b, 0) / collaterals.length
        : 0

      const ivs = opts.filter((o) => o.iv_pct != null).map((o) => o.iv_pct!)
      const avgIv = ivs.length > 0
        ? ivs.reduce((a, b) => a + b, 0) / ivs.length
        : 0

      const deltas = opts.filter((o) => o.delta != null).map((o) => o.delta!)
      const avgDelta = deltas.length > 0
        ? deltas.reduce((a, b) => a + b, 0) / deltas.length
        : 0

      const totalProfit = opts.reduce((sum, o) => sum + (computeProfit(o) ?? 0), 0)

      stats.push({ year, avgProfitYield, avgDaysHeld, avgReturn, avgCollateral, avgIv, avgDelta, totalProfit, count: opts.length })
    }

    return stats.sort((a, b) => b.year - a.year)
  }

  it("groups by year and computes averages for short closed options", () => {
    const options = [
      makeOption({
        Id: 1,
        strategy_type: "Wheel",
        status: "Closed",
        opened: "2024-03-01",
        close_date: "2024-03-31",
        premium: 3.0,
        close_premium: 0.5,
        qty: 1,
        collateral: 15000,
        iv_pct: 0.35,
        delta: 0.25,
      }),
      makeOption({
        Id: 2,
        strategy_type: "Wheel",
        status: "Expired",
        opened: "2024-06-01",
        close_date: "2024-06-21",
        premium: 2.0,
        close_premium: null,
        qty: 1,
        collateral: 10000,
        iv_pct: 0.45,
        delta: 0.30,
      }),
    ]

    const stats = computeYearlyStats(options)
    expect(stats).toHaveLength(1)
    expect(stats[0].year).toBe(2024)
    expect(stats[0].count).toBe(2)

    // profitYield: opt1 = (250/15000)*100 = 1.667%, opt2 = (200/10000)*100 = 2%
    // avg = (1.667 + 2) / 2 = 1.833%
    expect(stats[0].avgProfitYield).toBeCloseTo(1.833, 1)

    // totalProfit = 250 + 200 = 450
    expect(stats[0].totalProfit).toBe(450)

    // avgDaysHeld = (30 + 20) / 2 = 25
    expect(stats[0].avgDaysHeld).toBe(25)

    // avgCollateral = (15000 + 10000) / 2 = 12500
    expect(stats[0].avgCollateral).toBe(12500)

    // avgIv = (0.35 + 0.45) / 2 = 0.4
    expect(stats[0].avgIv).toBeCloseTo(0.4, 2)

    // avgDelta = (0.25 + 0.30) / 2 = 0.275
    expect(stats[0].avgDelta).toBeCloseTo(0.275, 3)
  })

  it("excludes LEAPS (long strategies)", () => {
    const options = [
      makeOption({ Id: 1, strategy_type: "LEAPS", buy_sell: "Buy", status: "Closed", opened: "2024-01-01", close_date: "2024-06-01" }),
    ]
    const stats = computeYearlyStats(options)
    expect(stats).toHaveLength(0)
  })

  it("excludes open options", () => {
    const options = [
      makeOption({ Id: 1, strategy_type: "Wheel", status: "Open" }),
    ]
    const stats = computeYearlyStats(options)
    expect(stats).toHaveLength(0)
  })

  it("iv_pct displayed as avgIv × 100 in percentage", () => {
    const options = [
      makeOption({
        Id: 1,
        strategy_type: "Wheel",
        status: "Closed",
        opened: "2024-01-01",
        close_date: "2024-01-31",
        premium: 2.0,
        close_premium: 0.5,
        qty: 1,
        collateral: 10000,
        iv_pct: 0.6465,
        delta: 0.20,
      }),
    ]
    const stats = computeYearlyStats(options)
    // avgIv = 0.6465 (raw decimal from NocoDB)
    // Display should be avgIv × 100 = 64.65%
    expect(stats[0].avgIv * 100).toBeCloseTo(64.65, 2)
  })
})

// ============================================================================
// LEAPS Column Display Logic
// ============================================================================
// Tests the accessor logic from options-columns.tsx longColumns
// ============================================================================

describe("LEAPS column display logic", () => {
  it("cost basis is per-share from computeLeapsDisplay", () => {
    const opt = makeOption({
      Id: 1,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 10,
      premium: 5.95,
      qty: 5,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const display = computeLeapsDisplay(opt, 15.88)

    // costBasis should be per-share: strike + premium = 15.95
    // NOT total: 15.95 × 5 × 100
    expect(display.costBasis).toBeCloseTo(15.95, 2)
  })

  it("leverage = currentPrice / premium", () => {
    const opt = makeOption({
      Id: 2,
      buy_sell: "Buy",
      strategy_type: "LEAPS",
      call_put: "Call",
      strike: 10,
      premium: 5.95,
      status: "Open",
      opened: "2024-01-15",
      expiration: "2026-01-16",
    })
    const display = computeLeapsDisplay(opt, 15.88)

    // leverage = 15.88 / 5.95 = 2.669x
    const leverage = display.currentPrice! / display.premium
    expect(leverage).toBeCloseTo(2.67, 1)
  })

  it("IV% display: raw decimal × 100 gives percentage", () => {
    // iv_pct in NocoDB is stored as decimal (e.g., 0.6465 = 64.65%)
    const iv_pct = 0.6465
    // Display: formatPercent(value * 100) where value = iv_pct
    const displayValue = iv_pct * 100
    expect(displayValue).toBeCloseTo(64.65, 2)
  })
})
