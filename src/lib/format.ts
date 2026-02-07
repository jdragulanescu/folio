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
 * Format a large number in compact notation (e.g., "$1.2B", "$456M").
 * Useful for market cap display.
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
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
 */
export function daysToExpiry(expirationDate: string): number {
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
