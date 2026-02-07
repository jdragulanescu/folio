// ============================================================================
// Financial Display Formatting Utilities
// ============================================================================
// Centralised formatting for currency, percentages, and numbers. Used by both
// Server and Client Components -- NOT server-only.
// ============================================================================

/**
 * Format a number as GBP currency (e.g., "£12,345.67").
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a number as a signed percentage (e.g., "+15.23%", "-3.45%").
 */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Format a number with locale-aware thousands separators.
 */
export function formatNumber(value: number, dp: number = 2): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value)
}

/**
 * Format a large number in compact notation (e.g., "£1.2B", "£456M").
 * Useful for market cap display.
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Return Tailwind class for gain/loss colouring.
 * Uses --color-gain and --color-loss custom properties from globals.css.
 */
export function pnlClassName(value: number): string {
  if (value > 0) return "text-gain"
  if (value < 0) return "text-loss"
  return "text-muted-foreground"
}
