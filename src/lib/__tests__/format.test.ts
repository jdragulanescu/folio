import { describe, expect, it } from "vitest"
import {
  formatCurrency,
  formatCompact,
  convertCurrency,
  formatShares,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateShort,
  daysToExpiry,
  pnlClassName,
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

// ============================================================================
// formatPercent
// ============================================================================
describe("formatPercent", () => {
  it("positive value has + sign", () => {
    expect(formatPercent(15.23)).toBe("+15.23%")
  })

  it("negative value has - sign", () => {
    expect(formatPercent(-3.45)).toBe("-3.45%")
  })

  it("zero has no sign", () => {
    expect(formatPercent(0)).toBe("0.00%")
  })

  it("large positive value", () => {
    expect(formatPercent(100)).toBe("+100.00%")
  })

  it("tiny fractional rounds to 2dp", () => {
    expect(formatPercent(0.001)).toBe("+0.00%")
  })
})

// ============================================================================
// formatNumber
// ============================================================================
describe("formatNumber", () => {
  it("default 2dp with thousands separator", () => {
    expect(formatNumber(1234.5)).toContain("1,234.50")
  })

  it("custom dp=0 rounds to integer", () => {
    expect(formatNumber(1234.5, 0)).toContain("1,235")
  })

  it("custom dp=3", () => {
    expect(formatNumber(0.12345, 3)).toContain("0.123")
  })

  it("zero", () => {
    expect(formatNumber(0)).toContain("0.00")
  })

  it("large number with commas", () => {
    expect(formatNumber(1000000)).toContain("1,000,000.00")
  })
})

// ============================================================================
// formatDate
// ============================================================================
describe("formatDate", () => {
  it("formats standard ISO date", () => {
    expect(formatDate("2025-01-15")).toBe("15 Jan 2025")
  })

  it("formats full ISO with time", () => {
    expect(formatDate("2025-06-30T14:30:00.000Z")).toBe("30 Jun 2025")
  })

  it("December edge case", () => {
    expect(formatDate("2024-12-31")).toBe("31 Dec 2024")
  })
})

// ============================================================================
// formatDateShort
// ============================================================================
describe("formatDateShort", () => {
  it("formats standard date as dd/MM/yy", () => {
    expect(formatDateShort("2025-01-15")).toBe("15/01/25")
  })

  it("formats full ISO as dd/MM/yy", () => {
    expect(formatDateShort("2024-06-01T00:00:00.000Z")).toBe("01/06/24")
  })
})

// ============================================================================
// daysToExpiry
// ============================================================================
describe("daysToExpiry", () => {
  it("non-open status Closed returns 0", () => {
    expect(daysToExpiry("2099-01-01", "Closed")).toBe(0)
  })

  it("non-open status Expired returns 0", () => {
    expect(daysToExpiry("2099-01-01", "Expired")).toBe(0)
  })

  it("Open status with future date returns positive", () => {
    expect(daysToExpiry("2099-12-31", "Open")).toBeGreaterThan(0)
  })

  it("no status arg with future date returns positive", () => {
    expect(daysToExpiry("2099-12-31")).toBeGreaterThan(0)
  })

  it("past date with Open returns negative", () => {
    expect(daysToExpiry("2020-01-01", "Open")).toBeLessThan(0)
  })
})

// ============================================================================
// pnlClassName
// ============================================================================
describe("pnlClassName", () => {
  it("positive value returns text-gain", () => {
    expect(pnlClassName(100)).toBe("text-gain")
  })

  it("negative value returns text-loss", () => {
    expect(pnlClassName(-50)).toBe("text-loss")
  })

  it("zero returns text-muted-foreground", () => {
    expect(pnlClassName(0)).toBe("text-muted-foreground")
  })

  it("tiny positive returns text-gain", () => {
    expect(pnlClassName(0.01)).toBe("text-gain")
  })

  it("tiny negative returns text-loss", () => {
    expect(pnlClassName(-0.01)).toBe("text-loss")
  })
})
