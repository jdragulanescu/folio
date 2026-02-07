import { describe, expect, it, vi } from "vitest"

// Mock server-only (throws at import time in non-Next.js env)
vi.mock("server-only", () => ({}))

// Mock all external deps so the module can be imported
vi.mock("../logger", () => ({
  default: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    }),
  },
}))
vi.mock("../nocodb", () => ({
  createRecord: vi.fn(),
  createRecords: vi.fn(),
  getAllRecords: vi.fn(),
  listRecords: vi.fn(),
  updateRecord: vi.fn(),
  updateRecords: vi.fn(),
}))
vi.mock("../providers", () => ({
  provider: { fetchBatchQuotes: vi.fn(), fetchForexRate: vi.fn() },
}))
vi.mock("../providers/finnhub", () => ({ FinnhubProvider: vi.fn() }))
vi.mock("../providers/alpha-vantage", () => ({ AlphaVantageProvider: vi.fn() }))

import { mergeFundamentals, mapSector, isRateLimitError } from "../sync"

// ============================================================================
// mergeFundamentals
// ============================================================================
describe("mergeFundamentals", () => {
  it("empty results array returns all-null fields with symbol", () => {
    const result = mergeFundamentals("AAPL", [])
    expect(result.symbol).toBe("AAPL")
    expect(result.eps).toBeNull()
    expect(result.pe).toBeNull()
    expect(result.beta).toBeNull()
    expect(result.dividendYield).toBeNull()
    expect(result.marketCap).toBeNull()
    expect(result.sector).toBeNull()
    expect(result.forwardPe).toBeNull()
    expect(result.pegRatio).toBeNull()
    expect(result.roe).toBeNull()
    expect(result.roa).toBeNull()
  })

  it("single result copies all non-null values", () => {
    const result = mergeFundamentals("MSFT", [
      {
        symbol: "MSFT",
        eps: 10.5,
        pe: 30,
        beta: 1.2,
        dividendYield: 0.8,
        marketCap: 3000000000000,
        sector: "Technology",
        forwardPe: 28,
        pegRatio: 2.1,
        roe: 0.45,
        roa: 0.2,
      },
    ])
    expect(result.symbol).toBe("MSFT")
    expect(result.eps).toBe(10.5)
    expect(result.pe).toBe(30)
    expect(result.beta).toBe(1.2)
    expect(result.dividendYield).toBe(0.8)
    expect(result.marketCap).toBe(3000000000000)
    expect(result.sector).toBe("Technology")
    expect(result.forwardPe).toBe(28)
    expect(result.pegRatio).toBe(2.1)
    expect(result.roe).toBe(0.45)
    expect(result.roa).toBe(0.2)
  })

  it("first non-null wins across multiple results", () => {
    const result = mergeFundamentals("GOOG", [
      {
        symbol: "GOOG",
        eps: 5,
        pe: null,
        beta: null,
        dividendYield: null,
        marketCap: null,
        sector: "Technology",
        forwardPe: null,
        pegRatio: null,
        roe: null,
        roa: null,
      },
      {
        symbol: "GOOG",
        eps: 10,
        pe: 25,
        beta: 1.1,
        dividendYield: null,
        marketCap: 2000000000000,
        sector: "Communication",
        forwardPe: 22,
        pegRatio: 1.5,
        roe: 0.3,
        roa: 0.15,
      },
    ])
    // First non-null wins: eps=5 from first result, not 10 from second
    expect(result.eps).toBe(5)
    // First was null, so second's value wins
    expect(result.pe).toBe(25)
    expect(result.beta).toBe(1.1)
    // First non-null sector: "Technology" from first result
    expect(result.sector).toBe("Technology")
    expect(result.marketCap).toBe(2000000000000)
    expect(result.forwardPe).toBe(22)
  })

  it("all fields remain null if all results have null", () => {
    const nullResult = {
      symbol: "X",
      eps: null,
      pe: null,
      beta: null,
      dividendYield: null,
      marketCap: null,
      sector: null,
      forwardPe: null,
      pegRatio: null,
      roe: null,
      roa: null,
    }
    const result = mergeFundamentals("X", [nullResult, nullResult])
    expect(result.eps).toBeNull()
    expect(result.pe).toBeNull()
    expect(result.beta).toBeNull()
    expect(result.sector).toBeNull()
  })
})

// ============================================================================
// mapSector
// ============================================================================
describe("mapSector", () => {
  it("null input returns null", () => {
    expect(mapSector(null)).toBeNull()
  })

  it("empty string returns null", () => {
    expect(mapSector("")).toBeNull()
  })

  it("TECHNOLOGY maps to Technology", () => {
    expect(mapSector("TECHNOLOGY")).toBe("Technology")
  })

  it("mixed case Technology maps correctly", () => {
    expect(mapSector("Technology")).toBe("Technology")
  })

  it("CONSUMER CYCLICAL maps to Consumer", () => {
    expect(mapSector("CONSUMER CYCLICAL")).toBe("Consumer")
  })

  it("CONSUMER DEFENSIVE maps to Consumer", () => {
    expect(mapSector("CONSUMER DEFENSIVE")).toBe("Consumer")
  })

  it("CONSUMER DISCRETIONARY maps to Consumer", () => {
    expect(mapSector("CONSUMER DISCRETIONARY")).toBe("Consumer")
  })

  it("CONSUMER STAPLES maps to Consumer", () => {
    expect(mapSector("CONSUMER STAPLES")).toBe("Consumer")
  })

  it("FINANCIAL SERVICES maps to Financial", () => {
    expect(mapSector("FINANCIAL SERVICES")).toBe("Financial")
  })

  it("FINANCIALS maps to Financial", () => {
    expect(mapSector("FINANCIALS")).toBe("Financial")
  })

  it("unknown sector returns null", () => {
    expect(mapSector("SPACE EXPLORATION")).toBeNull()
  })

  it("HEALTHCARE maps to Healthcare", () => {
    expect(mapSector("HEALTHCARE")).toBe("Healthcare")
  })

  it("ENERGY maps to Energy", () => {
    expect(mapSector("ENERGY")).toBe("Energy")
  })

  it("BASIC MATERIALS maps to Industrial", () => {
    expect(mapSector("BASIC MATERIALS")).toBe("Industrial")
  })

  it("UTILITIES maps to Energy", () => {
    expect(mapSector("UTILITIES")).toBe("Energy")
  })
})

// ============================================================================
// isRateLimitError
// ============================================================================
describe("isRateLimitError", () => {
  it("contains 'rate limit' returns true", () => {
    expect(isRateLimitError("hit rate limit")).toBe(true)
  })

  it("contains 'API rate limit' returns true", () => {
    expect(isRateLimitError("API rate limit exceeded")).toBe(true)
  })

  it("contains 'requests per day' returns true", () => {
    expect(isRateLimitError("exceeded 500 requests per day")).toBe(true)
  })

  it("contains 'per-second burst' returns true", () => {
    expect(isRateLimitError("per-second burst limit reached")).toBe(true)
  })

  it("generic error returns false", () => {
    expect(isRateLimitError("Connection timeout")).toBe(false)
  })

  it("empty string returns false", () => {
    expect(isRateLimitError("")).toBe(false)
  })

  it("partial match not present returns false", () => {
    expect(isRateLimitError("limit exceeded")).toBe(false)
  })
})
