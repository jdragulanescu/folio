"use server"

import {
  getTransactionsPage,
  type TransactionFilters,
  type TransactionsPage,
} from "@/lib/transactions"

/**
 * Server Action for loading additional transaction pages.
 *
 * Called from the client-side infinite scroll to fetch the next page
 * of transactions with the current filter and sort settings.
 */
export async function loadMoreTransactions(
  offset: number,
  filters?: TransactionFilters,
  sortField?: string,
  sortDir?: "asc" | "desc",
): Promise<TransactionsPage> {
  return getTransactionsPage(offset, filters, sortField, sortDir)
}
