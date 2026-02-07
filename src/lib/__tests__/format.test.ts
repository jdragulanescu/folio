import { describe, expect, it } from "vitest"
import {
  formatCurrency,
  formatCompact,
  convertCurrency,
  formatShares,
} from "../format"

// ============================================================================
// formatCurrency
// ============================================================================
describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.56)).toMatch(/\$1,234\.56/)
  })

  it("formats GBP when specified", () => {
    expect(formatCurrency(1234.56, "GBP")).toMatch(/\u00a31,234\.56/)
  })

  it("handles zero", () => {
    expect(formatCurrency(0)).toMatch(/\$0\.00/)
  })

  it("handles negative values", () => {
    const result = formatCurrency(-500.5)
    expect(result).toContain("500.50")
  })

  it("rounds to 2 decimal places", () => {
    expect(formatCurrency(10.999)).toMatch(/11\.00/)
  })
})

// ============================================================================
// formatCompact
// ============================================================================
describe("formatCompact", () => {
  it("formats large numbers compactly in USD", () => {
    const result = formatCompact(1_500_000_000)
    expect(result).toContain("1.5")
  })

  it("accepts GBP currency", () => {
    const result = formatCompact(1_000_000, "GBP")
    expect(result).toContain("1")
  })
})

// ============================================================================
// convertCurrency
// ============================================================================
describe("convertCurrency", () => {
  const rate = 0.79 // 1 USD = 0.79 GBP

  it("USD to GBP multiplies by rate", () => {
    expect(convertCurrency(100, "USD", "GBP", rate)).toBeCloseTo(79)
  })

  it("GBP to USD divides by rate", () => {
    expect(convertCurrency(79, "GBP", "USD", rate)).toBeCloseTo(100)
  })

  it("same currency returns same value", () => {
    expect(convertCurrency(100, "USD", "USD", rate)).toBe(100)
    expect(convertCurrency(100, "GBP", "GBP", rate)).toBe(100)
  })

  it("handles zero", () => {
    expect(convertCurrency(0, "USD", "GBP", rate)).toBe(0)
  })
})

// ============================================================================
// formatShares
// ============================================================================
describe("formatShares", () => {
  it("integer shares have no decimals", () => {
    expect(formatShares(100)).toBe("100")
  })

  it("fractional shares show 2-4 decimals", () => {
    const result = formatShares(10.5)
    expect(result).toContain("10.5")
  })

  it("near-integer treated as integer", () => {
    // Math.abs(99.99999 - 100) < 0.0001 => true => formatted as integer
    expect(formatShares(99.99999)).toBe("100")
  })

  it("value at threshold boundary is fractional", () => {
    // Math.abs(99.9999 - 100) = 0.0001 which is NOT < 0.0001
    const result = formatShares(99.9999)
    expect(result).toContain("99.9999")
  })
})
