// ============================================================================
// Financial Display Formatting Utilities
// ============================================================================
// Centralised formatting for currency, percentages, numbers, and dates.
// Used by both Server and Client Components -- NOT server-only.
// ============================================================================

import { format, parseISO, differenceInDays } from "date-fns"

/**
 * Format a number as currency (e.g., "$12,345.67" or "£12,345.67").
 * Defaults to USD. Uses en-GB locale for consistent thousands separators.
 */
export function formatCurrency(
  value: number,
  currency: "USD" | "GBP" = "USD",
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
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
 * Format share count: integers with no decimals, fractional with up to 4.
 */
export function formatShares(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.0001) {
    return new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

/**
 * Format a large number in compact notation (e.g., "$1.2B", "$456M").
 * Useful for market cap display.
 */
export function formatCompact(
  value: number,
  currency: "USD" | "GBP" = "USD",
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Convert a value between USD and GBP using the given USD/GBP rate.
 * The rate represents how many GBP per 1 USD (e.g., 0.79).
 */
export function convertCurrency(
  value: number,
  fromCurrency: "USD" | "GBP",
  toCurrency: "USD" | "GBP",
  usdGbpRate: number,
): number {
  if (fromCurrency === toCurrency) return value
  if (fromCurrency === "USD" && toCurrency === "GBP") return value * usdGbpRate
  // GBP to USD
  return value / usdGbpRate
}

/**
 * Format an ISO date string as "dd MMM yyyy" (e.g., "15 Jan 2025").
 */
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd MMM yyyy")
}

/**
 * Format an ISO date string as "dd/MM/yy" (e.g., "15/01/25").
 */
export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yy")
}

/**
 * Calculate the number of days until an expiration date.
 * Positive = days remaining, negative = days past expiry.
 * Returns 0 for closed options (status !== "Open").
 */
export function daysToExpiry(expirationDate: string, status?: string): number {
  if (status && status !== "Open") return 0
  return differenceInDays(parseISO(expirationDate), new Date())
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
