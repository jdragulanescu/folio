import { describe, expect, it } from "vitest"
import {
  computeHolding,
  computePortfolio,
  computeRealisedGainsByFiscalYear,
  getFiscalYear,
  toDisplay,
} from "../calculations"
import Big from "big.js"

// ---------------------------------------------------------------------------
// Types matching the TransactionInput interface in calculations.ts
// ---------------------------------------------------------------------------
interface TransactionInput {
  type: "Buy" | "Sell"
  shares: number
  price: number
  date: string
}

// ---------------------------------------------------------------------------
// Helper: build a transaction quickly
// ---------------------------------------------------------------------------
function tx(
  type: "Buy" | "Sell",
  shares: number,
  price: number,
  date: string,
): TransactionInput {
  return { type, shares, price, date }
}

// ============================================================================
// computeHolding
// ============================================================================
describe("computeHolding", () => {
  // ---- Test 1: Single buy ----
  it("calculates correctly for a single buy", () => {
    const transactions = [tx("Buy", 100, 10, "2024-01-01")]
    const result = computeHolding(transactions, 12)

    expect(result.shares).toEqual(new Big(100))
    expect(result.avgCost).toEqual(new Big(10))
    expect(result.totalCost).toEqual(new Big(1000))
    expect(result.marketValue).toEqual(new Big(1200))
    expect(result.unrealisedPnl).toEqual(new Big(200))
    expect(result.realisedPnl).toEqual(new Big(0))
  })

  // ---- Test 2: Multiple buys (cost averaging) ----
  it("averages cost across multiple buys", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      tx("Buy", 50, 14, "2024-01-15"),
    ]
    const result = computeHolding(transactions, 12)

    expect(result.shares).toEqual(new Big(150))
    expect(result.totalCost).toEqual(new Big(1700))
    // avgCost = 1700 / 150 = 11.333...
    expect(Number(result.avgCost.toFixed(2))).toBe(11.33)
    expect(result.marketValue).toEqual(new Big(1800))
    // unrealisedPnl = (12 - 11.333...) * 150 = 100 (with tiny residual from division)
    expect(Number(result.unrealisedPnl.toFixed(2))).toBe(100.0)
    expect(result.realisedPnl).toEqual(new Big(0))
  })

  // ---- Test 3: Buy then partial sell ----
  it("handles partial sell with Section 104 pool reduction", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      tx("Sell", 40, 15, "2024-02-01"),
    ]
    const result = computeHolding(transactions, 12)

    expect(result.shares).toEqual(new Big(60))
    expect(Number(result.avgCost.toFixed(2))).toBe(10.0)
    expect(result.totalCost).toEqual(new Big(600))
    // realisedPnl = 40 * (15 - 10) = 200
    expect(result.realisedPnl).toEqual(new Big(200))
    // unrealisedPnl = 60 * (12 - 10) = 120
    expect(result.unrealisedPnl).toEqual(new Big(120))
    expect(result.marketValue).toEqual(new Big(720))
  })

  // ---- Test 4: Full disposal (pool reset) ----
  it("resets pool to zero on full disposal", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      tx("Sell", 100, 15, "2024-02-01"),
    ]
    const result = computeHolding(transactions, 15)

    expect(result.shares).toEqual(new Big(0))
    expect(result.avgCost).toEqual(new Big(0))
    expect(result.totalCost).toEqual(new Big(0))
    // realisedPnl = 100 * (15 - 10) = 500
    expect(result.realisedPnl).toEqual(new Big(500))
    expect(result.marketValue).toEqual(new Big(0))
    expect(result.unrealisedPnl).toEqual(new Big(0))
  })

  // ---- Test 5: Re-entry after full disposal ----
  it("starts fresh pool after full disposal and re-entry", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      tx("Sell", 100, 15, "2024-02-01"),
      tx("Buy", 50, 20, "2024-03-01"),
    ]
    const result = computeHolding(transactions, 22)

    expect(result.shares).toEqual(new Big(50))
    expect(result.avgCost).toEqual(new Big(20))
    expect(result.totalCost).toEqual(new Big(1000))
    // realisedPnl from previous round = 500
    expect(result.realisedPnl).toEqual(new Big(500))
    // unrealisedPnl = 50 * (22 - 20) = 100
    expect(result.unrealisedPnl).toEqual(new Big(100))
    expect(result.marketValue).toEqual(new Big(1100))
  })

  // ---- Test 6: Complex multiple buys and sells ----
  it("handles complex buy/sell sequences correctly", () => {
    const transactions = [
      tx("Buy", 200, 50, "2024-01-01"),
      tx("Buy", 100, 60, "2024-02-01"),
      tx("Sell", 150, 70, "2024-03-01"),
    ]
    const result = computeHolding(transactions, 75)

    // Pool after buys: 300 shares, totalCost = 10000 + 6000 = 16000
    // avgCost = 16000 / 300 = 53.333...
    // Sell 150: costOfSold = 150 * 53.333... = 8000
    // realisedPnl = (150 * 70) - 8000 = 10500 - 8000 = 2500
    // Remaining: 150 shares, totalCost = 16000 - 8000 = 8000
    expect(result.shares).toEqual(new Big(150))
    expect(Number(result.totalCost.toFixed(2))).toBe(8000.0)
    expect(Number(result.avgCost.toFixed(2))).toBe(53.33)
    expect(Number(result.realisedPnl.toFixed(2))).toBe(2500.0)
    // unrealisedPnl = 150 * (75 - 53.333...) = 150 * 21.666... = 3250
    expect(Number(result.unrealisedPnl.toFixed(2))).toBe(3250.0)
    expect(result.marketValue).toEqual(new Big(11250))
  })

  // ---- Test 7: Fractional shares ----
  it("handles fractional shares correctly", () => {
    const transactions = [tx("Buy", 10.5, 100.5, "2024-01-01")]
    const result = computeHolding(transactions, 105)

    expect(result.shares).toEqual(new Big(10.5))
    expect(result.avgCost).toEqual(new Big(100.5))
    expect(result.totalCost).toEqual(new Big(1055.25))
    // marketValue = 10.5 * 105 = 1102.50
    expect(result.marketValue).toEqual(new Big(1102.5))
    // unrealisedPnl = 10.5 * (105 - 100.5) = 10.5 * 4.5 = 47.25
    expect(result.unrealisedPnl).toEqual(new Big(47.25))
  })

  // ---- Test 8: Sell with zero shares (edge case) ----
  it("skips sell when pool is empty", () => {
    const transactions = [tx("Sell", 50, 10, "2024-01-01")]
    const result = computeHolding(transactions, 10)

    expect(result.shares).toEqual(new Big(0))
    expect(result.avgCost).toEqual(new Big(0))
    expect(result.totalCost).toEqual(new Big(0))
    expect(result.realisedPnl).toEqual(new Big(0))
    expect(result.marketValue).toEqual(new Big(0))
    expect(result.unrealisedPnl).toEqual(new Big(0))
  })

  // ---- Test 9: Transaction sort order ----
  it("sorts transactions by date asc, buys before sells on same day", () => {
    // Sell date is BEFORE buy date -- should be sorted correctly
    // Sell first (skipped, no shares), then buy
    const transactions = [
      tx("Buy", 100, 10, "2024-01-15"),
      tx("Sell", 50, 12, "2024-01-10"),
    ]
    const result = computeHolding(transactions, 12)

    // After sorting: sell on Jan 10 (skipped, empty pool), buy on Jan 15
    expect(result.shares).toEqual(new Big(100))
    expect(result.avgCost).toEqual(new Big(10))
    expect(result.realisedPnl).toEqual(new Big(0))
  })

  // ---- Test 9b: Same-day transactions -- buys before sells ----
  it("processes buys before sells on the same day", () => {
    const transactions = [
      tx("Sell", 50, 15, "2024-01-15"),
      tx("Buy", 100, 10, "2024-01-15"),
    ]
    const result = computeHolding(transactions, 12)

    // Same date: buy first (100 @ 10), then sell 50 (avgCost=10, realisedPnl=250)
    expect(result.shares).toEqual(new Big(50))
    expect(result.avgCost).toEqual(new Big(10))
    expect(result.realisedPnl).toEqual(new Big(250))
  })

  // ---- Test: Amount computed from shares * price ----
  it("computes amount from shares * price", () => {
    const transactions = [
      { type: "Buy" as const, shares: 100, price: 10, date: "2024-01-01" },
      { type: "Sell" as const, shares: 40, price: 15, date: "2024-02-01" },
    ]
    const result = computeHolding(transactions, 12)

    expect(result.shares).toEqual(new Big(60))
    // realisedPnl = 40 * 15 - 40 * 10 = 600 - 400 = 200
    expect(result.realisedPnl).toEqual(new Big(200))
    expect(result.totalCost).toEqual(new Big(600))
  })

  // ---- Test: Float artifact pool reset ----
  it("resets pool to zero when float artifacts leave near-zero residual", () => {
    // Simulates NocoDB returning 1.5010000000000001 instead of 1.501
    const transactions = [
      tx("Buy", 1.501, 100, "2024-01-01"),
      tx("Sell", 1.5010000000000001, 120, "2024-02-01"),
    ]
    const result = computeHolding(transactions, 120)

    expect(result.shares).toEqual(new Big(0))
    expect(result.totalCost).toEqual(new Big(0))
  })

  // ---- Test: Float artifacts in multi-step computation ----
  it("handles accumulated float artifacts across many transactions", () => {
    const transactions = [
      tx("Buy", 25.977, 59.6, "2024-02-26"),
      tx("Sell", 25.977, 90.9, "2024-12-16"),
      tx("Buy", 100, 67.65, "2025-08-04"),
    ]
    const result = computeHolding(transactions, 67.65)

    // After buy/sell of 25.977, pool should be exactly 0, then fresh buy of 100
    expect(result.shares).toEqual(new Big(100))
  })

  // ---- Test: Skips transactions with null/invalid shares ----
  it("skips transactions with null or NaN shares", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      { type: "Buy" as const, shares: null as unknown as number, price: 10, date: "2024-01-15" },
      { type: "Buy" as const, shares: NaN, price: 10, date: "2024-01-20" },
      { type: "Buy" as const, shares: 50, price: null as unknown as number, date: "2024-01-25" },
    ]
    const result = computeHolding(transactions, 12)

    // Only the first valid transaction should count
    expect(result.shares).toEqual(new Big(100))
    expect(result.totalCost).toEqual(new Big(1000))
  })

  // ---- Test: Empty transactions ----
  it("returns zeros for empty transaction array", () => {
    const result = computeHolding([], 50)

    expect(result.shares).toEqual(new Big(0))
    expect(result.avgCost).toEqual(new Big(0))
    expect(result.totalCost).toEqual(new Big(0))
    expect(result.realisedPnl).toEqual(new Big(0))
    expect(result.marketValue).toEqual(new Big(0))
    expect(result.unrealisedPnl).toEqual(new Big(0))
  })

  // ---- Test: Multiple full disposals and re-entries ----
  it("handles multiple full disposals and re-entries", () => {
    const transactions = [
      tx("Buy", 100, 10, "2024-01-01"),
      tx("Sell", 100, 15, "2024-02-01"), // +500 realised
      tx("Buy", 200, 20, "2024-03-01"),
      tx("Sell", 200, 25, "2024-04-01"), // +1000 realised
      tx("Buy", 50, 30, "2024-05-01"),
    ]
    const result = computeHolding(transactions, 35)

    expect(result.shares).toEqual(new Big(50))
    expect(result.avgCost).toEqual(new Big(30))
    expect(result.totalCost).toEqual(new Big(1500))
    // Total realised: 500 + 1000 = 1500
    expect(result.realisedPnl).toEqual(new Big(1500))
    // unrealised: 50 * (35 - 30) = 250
    expect(result.unrealisedPnl).toEqual(new Big(250))
  })
})

// ============================================================================
// computePortfolio
// ============================================================================
describe("computePortfolio", () => {
  // ---- Test 10: Two-symbol portfolio weights ----
  it("computes correct weights for a two-symbol portfolio", () => {
    const holdings = new Map([
      [
        "AAPL",
        {
          transactions: [tx("Buy", 100, 60, "2024-01-01")],
          currentPrice: 60,
          name: "Apple Inc",
          sector: "Technology",
          strategy: "Growth",
        },
      ],
      [
        "MSFT",
        {
          transactions: [tx("Buy", 100, 40, "2024-01-01")],
          currentPrice: 40,
          name: "Microsoft Corp",
          sector: "Technology",
          strategy: "Growth",
        },
      ],
    ])
    const result = computePortfolio(holdings)

    // AAPL: marketValue = 6000, MSFT: marketValue = 4000
    // Total: 10000
    // AAPL weight = 60%, MSFT weight = 40%
    const aapl = result.holdings.find((h) => h.symbol === "AAPL")!
    const msft = result.holdings.find((h) => h.symbol === "MSFT")!

    expect(Number(aapl.weight.toFixed(2))).toBe(60.0)
    expect(Number(msft.weight.toFixed(2))).toBe(40.0)

    // Weights should sum to 100
    const totalWeight = result.holdings.reduce(
      (sum, h) => sum.plus(h.weight),
      new Big(0),
    )
    expect(Number(totalWeight.toFixed(2))).toBe(100.0)
  })

  // ---- Test 11: Portfolio totals ----
  it("computes correct portfolio totals", () => {
    const holdings = new Map([
      [
        "AAPL",
        {
          transactions: [tx("Buy", 100, 50, "2024-01-01")],
          currentPrice: 60,
          name: "Apple Inc",
          sector: "Technology",
          strategy: null,
        },
      ],
      [
        "MSFT",
        {
          transactions: [
            tx("Buy", 50, 40, "2024-01-01"),
            tx("Sell", 20, 45, "2024-02-01"),
          ],
          currentPrice: 50,
          name: "Microsoft Corp",
          sector: "Technology",
          strategy: null,
        },
      ],
    ])
    const result = computePortfolio(holdings)

    // AAPL: marketValue = 6000, unrealised = 1000, realised = 0
    // MSFT: 30 shares left, avgCost=40, totalCost=1200
    //   marketValue = 30*50 = 1500, unrealised = 30*(50-40) = 300
    //   realised = 20*(45-40) = 100
    expect(result.totals.totalMarketValue).toEqual(new Big(7500))
    expect(result.totals.totalUnrealisedPnl).toEqual(new Big(1300))
    expect(result.totals.totalRealisedPnl).toEqual(new Big(100))
    expect(result.totals.totalCost).toEqual(new Big(6200))
  })

  // ---- Test: Empty portfolio ----
  it("returns empty results for an empty portfolio", () => {
    const result = computePortfolio(new Map())

    expect(result.holdings).toEqual([])
    expect(result.totals.totalMarketValue).toEqual(new Big(0))
    expect(result.totals.totalUnrealisedPnl).toEqual(new Big(0))
    expect(result.totals.totalRealisedPnl).toEqual(new Big(0))
    expect(result.totals.totalCost).toEqual(new Big(0))
  })

  // ---- Test: Single holding portfolio weight should be 100% ----
  it("gives 100% weight to a single holding", () => {
    const holdings = new Map([
      [
        "AAPL",
        {
          transactions: [tx("Buy", 10, 150, "2024-01-01")],
          currentPrice: 160,
          name: "Apple Inc",
          sector: "Technology",
          strategy: null,
        },
      ],
    ])
    const result = computePortfolio(holdings)

    expect(Number(result.holdings[0].weight.toFixed(2))).toBe(100.0)
  })

  // ---- Test: Zero market value position excluded from weight ----
  it("handles zero market value positions in weight calculation", () => {
    const holdings = new Map([
      [
        "AAPL",
        {
          transactions: [
            tx("Buy", 100, 10, "2024-01-01"),
            tx("Sell", 100, 15, "2024-02-01"),
          ],
          currentPrice: 20,
          name: "Apple Inc",
          sector: "Technology",
          strategy: null,
        },
      ],
      [
        "MSFT",
        {
          transactions: [tx("Buy", 50, 40, "2024-01-01")],
          currentPrice: 50,
          name: "Microsoft Corp",
          sector: "Technology",
          strategy: null,
        },
      ],
    ])
    const result = computePortfolio(holdings)

    const aapl = result.holdings.find((h) => h.symbol === "AAPL")!
    const msft = result.holdings.find((h) => h.symbol === "MSFT")!

    expect(Number(aapl.weight.toFixed(2))).toBe(0.0)
    expect(Number(msft.weight.toFixed(2))).toBe(100.0)
  })
})

// ============================================================================
// toDisplay
// ============================================================================
describe("toDisplay", () => {
  // ---- Test 12: Precision ----
  it("converts Big to 2 decimal places by default", () => {
    expect(toDisplay(new Big("10.33333"))).toBe(10.33)
  })

  it("rounds using ROUND_HALF_UP", () => {
    expect(toDisplay(new Big("10.335"))).toBe(10.34)
    expect(toDisplay(new Big("10.345"))).toBe(10.35)
  })

  it("respects custom decimal places", () => {
    expect(toDisplay(new Big("10.33333"), 4)).toBe(10.3333)
    expect(toDisplay(new Big("10.33333"), 0)).toBe(10)
  })

  it("handles zero", () => {
    expect(toDisplay(new Big(0))).toBe(0)
  })

  it("handles negative values", () => {
    expect(toDisplay(new Big("-123.456"))).toBe(-123.46)
  })
})

// ============================================================================
// Big.js Configuration Verification
// ============================================================================
describe("Big.js configuration", () => {
  it("uses ROUND_HALF_UP rounding mode", () => {
    // After importing calculations module, Big.RM should be set to roundHalfUp
    expect(Big.RM).toBe(Big.roundHalfUp)
  })

  it("does NOT restrict decimal places globally", () => {
    // Big.DP should remain at default 20, not 2
    expect(Big.DP).toBe(20)
  })
})

// ============================================================================
// getFiscalYear
// ============================================================================
describe("getFiscalYear", () => {
  it("date after 5 April returns current/next year", () => {
    expect(getFiscalYear("2024-04-06")).toBe("2024/25")
    expect(getFiscalYear("2024-12-31")).toBe("2024/25")
  })

  it("5 April is still previous fiscal year", () => {
    expect(getFiscalYear("2025-04-05")).toBe("2024/25")
  })

  it("date before 6 April returns previous/current year", () => {
    expect(getFiscalYear("2025-01-10")).toBe("2024/25")
    expect(getFiscalYear("2025-03-31")).toBe("2024/25")
  })

  it("exactly 6 April starts new fiscal year", () => {
    expect(getFiscalYear("2025-04-06")).toBe("2025/26")
  })

  it("handles edge of year boundary", () => {
    expect(getFiscalYear("2024-01-01")).toBe("2023/24")
    expect(getFiscalYear("2024-04-06")).toBe("2024/25")
  })
})

// ============================================================================
// computeRealisedGainsByFiscalYear
// ============================================================================
describe("computeRealisedGainsByFiscalYear", () => {
  it("computes P&L for single symbol with one sell", () => {
    const txBySymbol = new Map([
      [
        "AAPL",
        [
          tx("Buy", 100, 50, "2024-01-01"), // cost = 5000
          tx("Sell", 100, 60, "2024-06-15"), // proceeds = 6000, P&L = 1000
        ],
      ],
    ])
    const result = computeRealisedGainsByFiscalYear(txBySymbol)

    expect(result).toHaveLength(1)
    expect(result[0].fiscalYear).toBe("2024/25")
    expect(result[0].sellCount).toBe(1)
    expect(Number(result[0].totalProceeds.toFixed(2))).toBe(6000)
    expect(Number(result[0].totalCostBasis.toFixed(2))).toBe(5000)
    expect(Number(result[0].realisedPnl.toFixed(2))).toBe(1000)
  })

  it("computes P&L across multiple symbols", () => {
    const txBySymbol = new Map([
      [
        "AAPL",
        [
          tx("Buy", 100, 50, "2024-01-01"),
          tx("Sell", 50, 60, "2024-06-15"), // P&L = 50*(60-50) = 500
        ],
      ],
      [
        "MSFT",
        [
          tx("Buy", 200, 40, "2024-02-01"),
          tx("Sell", 100, 35, "2024-07-01"), // P&L = 100*(35-40) = -500
        ],
      ],
    ])
    const result = computeRealisedGainsByFiscalYear(txBySymbol)

    expect(result).toHaveLength(1) // both in 2024/25
    expect(result[0].sellCount).toBe(2)
    expect(Number(result[0].realisedPnl.toFixed(2))).toBe(0) // 500 + (-500) = 0
  })

  it("splits sales across fiscal years", () => {
    const txBySymbol = new Map([
      [
        "AAPL",
        [
          tx("Buy", 200, 50, "2024-01-01"),
          tx("Sell", 100, 60, "2024-06-15"), // FY 2024/25, P&L = 1000
          tx("Sell", 100, 70, "2025-06-15"), // FY 2025/26, P&L = 2000
        ],
      ],
    ])
    const result = computeRealisedGainsByFiscalYear(txBySymbol)

    expect(result).toHaveLength(2)
    // Sorted descending by fiscal year
    expect(result[0].fiscalYear).toBe("2025/26")
    expect(Number(result[0].realisedPnl.toFixed(2))).toBe(2000)
    expect(result[1].fiscalYear).toBe("2024/25")
    expect(Number(result[1].realisedPnl.toFixed(2))).toBe(1000)
  })

  it("computes amount from shares * price in fiscal year gains", () => {
    const txBySymbol = new Map([
      [
        "AAPL",
        [
          { type: "Buy" as const, shares: 100, price: 50, date: "2024-01-01" },
          { type: "Sell" as const, shares: 100, price: 60, date: "2024-06-15" },
        ],
      ],
    ])
    const result = computeRealisedGainsByFiscalYear(txBySymbol)

    expect(result).toHaveLength(1)
    expect(Number(result[0].totalProceeds.toFixed(2))).toBe(6000)
    expect(Number(result[0].realisedPnl.toFixed(2))).toBe(1000)
  })

  it("returns empty array when no sells", () => {
    const txBySymbol = new Map([
      ["AAPL", [tx("Buy", 100, 50, "2024-01-01")]],
    ])
    const result = computeRealisedGainsByFiscalYear(txBySymbol)
    expect(result).toHaveLength(0)
  })

  it("handles empty input", () => {
    const result = computeRealisedGainsByFiscalYear(new Map())
    expect(result).toHaveLength(0)
  })
})
