// ============================================================================
// Transaction Data Assembly
// ============================================================================
// Server-side data fetching for the transactions page. Handles paginated
// fetching with filtering and sorting via NocoDB where/sort params.
// ============================================================================

import "server-only"

import { listRecords } from "./nocodb"
import type { TransactionRecord } from "./types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRANSACTIONS_PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionFilters {
  symbol?: string
  platform?: string
  type?: string
  dateFrom?: string
  dateTo?: string
}

export interface TransactionsPage {
  transactions: TransactionRecord[]
  totalRows: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a single page of transactions with optional filtering and sorting.
 *
 * Builds a NocoDB `where` clause from the provided filters:
 * - symbol: `like` (case-insensitive substring match)
 * - platform: `eq` (exact match)
 * - type: `eq` (exact match on "Buy" or "Sell")
 * - dateFrom: `gte,exactDate,` (4-part NocoDB date syntax)
 * - dateTo: `lte,exactDate,` (4-part NocoDB date syntax)
 *
 * Default sort: date descending (most recent first).
 */
export async function getTransactionsPage(
  offset: number = 0,
  filters?: TransactionFilters,
  sortField: string = "date",
  sortDir: "asc" | "desc" = "desc",
): Promise<TransactionsPage> {
  // Build NocoDB where clause from filters
  const conditions: string[] = []

  if (filters?.symbol) {
    conditions.push(`(symbol,like,${filters.symbol})`)
  }
  if (filters?.platform) {
    conditions.push(`(platform,eq,${filters.platform})`)
  }
  if (filters?.type) {
    conditions.push(`(type,eq,${filters.type})`)
  }
  if (filters?.dateFrom) {
    conditions.push(`(date,gte,exactDate,${filters.dateFrom})`)
  }
  if (filters?.dateTo) {
    conditions.push(`(date,lte,exactDate,${filters.dateTo})`)
  }

  const where =
    conditions.length > 0 ? conditions.join("~and") : undefined
  const sort = sortDir === "desc" ? `-${sortField}` : sortField

  const result = await listRecords<TransactionRecord>("transactions", {
    where,
    sort,
    limit: TRANSACTIONS_PAGE_SIZE,
    offset,
  })

  return {
    transactions: result.list,
    totalRows: result.pageInfo.totalRows,
    hasMore: !result.pageInfo.isLastPage,
  }
}
