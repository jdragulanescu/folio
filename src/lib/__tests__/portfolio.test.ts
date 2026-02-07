import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("../nocodb", () => ({
  getAllRecords: vi.fn(),
  fetchParallel: vi.fn(),
}))
vi.mock("../options-shared", () => ({
  computeProfit: vi.fn(() => 0),
  computeOpenLongPnl: vi.fn(() => 0),
  isLongStrategy: vi.fn(() => false),
}))
vi.mock("../calculations", () => ({
  computePortfolio: vi.fn(),
  toDisplay: vi.fn((v: unknown) => Number(v)),
}))

import { getPrimaryPlatform } from "../portfolio"
import type { TransactionRecord } from "../types"

// Helper to create minimal transaction-like objects
const tx = (
  type: "Buy" | "Sell",
  platform: string | null,
  shares: number,
) =>
  ({
    Id: 1,
    symbol: "X",
    name: "Test",
    date: "2025-01-01",
    price: 100,
    amount: 1000,
    shares,
    type,
    platform,
    eps: null,
    CreatedAt: undefined,
    UpdatedAt: undefined,
  }) as unknown as TransactionRecord

// ============================================================================
// getPrimaryPlatform
// ============================================================================
describe("getPrimaryPlatform", () => {
  it("empty array returns null", () => {
    expect(getPrimaryPlatform([])).toBeNull()
  })

  it("single Buy transaction returns that platform", () => {
    expect(getPrimaryPlatform([tx("Buy", "IBKR", 10)])).toBe("IBKR")
  })

  it("multiple platforms, highest net shares wins", () => {
    expect(
      getPrimaryPlatform([
        tx("Buy", "IBKR", 100),
        tx("Buy", "Trading 212", 50),
      ]),
    ).toBe("IBKR")
  })

  it("sells reduce platform tally", () => {
    // IBKR net = 100 - 80 = 20, T212 net = 50
    expect(
      getPrimaryPlatform([
        tx("Buy", "IBKR", 100),
        tx("Sell", "IBKR", 80),
        tx("Buy", "Trading 212", 50),
      ]),
    ).toBe("Trading 212")
  })

  it("all sold from one platform still returns it when no others", () => {
    // IBKR net = 0 (100 - 100), 0 > -Infinity so best is IBKR
    expect(
      getPrimaryPlatform([
        tx("Buy", "IBKR", 100),
        tx("Sell", "IBKR", 100),
      ]),
    ).toBe("IBKR")
  })

  it("null platform transactions are skipped", () => {
    expect(
      getPrimaryPlatform([
        tx("Buy", null, 50),
        tx("Buy", "IBKR", 10),
      ]),
    ).toBe("IBKR")
  })

  it("tie-breaking: first platform inserted wins with strict >", () => {
    // Both have 50 shares. "A" inserted first into Map, bestCount starts -Infinity.
    // "A" (50 > -Infinity) wins, then "B" (50 > 50) is false, so "A" stays.
    expect(
      getPrimaryPlatform([
        tx("Buy", "A", 50),
        tx("Buy", "B", 50),
      ]),
    ).toBe("A")
  })
})
