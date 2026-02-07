"use client"

import { useCallback, useRef, useState } from "react"
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import type { TransactionRecord } from "@/lib/types"
import type { TransactionFilters, TransactionsPage } from "@/lib/transactions"
import { loadMoreTransactions } from "@/actions/load-transactions"
import { columns } from "@/components/transactions/transactions-columns"
import { TransactionsFilters } from "@/components/transactions/transactions-filters"
import { LoadMoreTrigger } from "@/components/transactions/load-more-trigger"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TransactionsTableProps {
  initialData: TransactionsPage
}

export function TransactionsTable({ initialData }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>(
    initialData.transactions
  )
  const [totalRows, setTotalRows] = useState(initialData.totalRows)
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ])
  const [isLoadingState, setIsLoadingState] = useState(false)
  const isLoading = useRef(false)

  // Derive sort params from TanStack sorting state
  const sortField = sorting[0]?.id ?? "date"
  const sortDir: "asc" | "desc" = sorting[0]?.desc ? "desc" : "asc"

  // Load more (infinite scroll)
  const handleLoadMore = useCallback(async () => {
    if (isLoading.current) return
    isLoading.current = true
    setIsLoadingState(true)

    try {
      const result = await loadMoreTransactions(
        transactions.length,
        filters,
        sortField,
        sortDir
      )
      setTransactions((prev) => [...prev, ...result.transactions])
      setTotalRows(result.totalRows)
      setHasMore(result.hasMore)
    } finally {
      isLoading.current = false
      setIsLoadingState(false)
    }
  }, [transactions.length, filters, sortField, sortDir])

  // Filter change handler
  const handleFiltersChange = useCallback(
    async (newFilters: TransactionFilters) => {
      setFilters(newFilters)
      setTransactions([])
      setHasMore(true)
      isLoading.current = true
      setIsLoadingState(true)

      try {
        const result = await loadMoreTransactions(
          0,
          newFilters,
          sortField,
          sortDir
        )
        setTransactions(result.transactions)
        setTotalRows(result.totalRows)
        setHasMore(result.hasMore)
      } finally {
        isLoading.current = false
        setIsLoadingState(false)
      }
    },
    [sortField, sortDir]
  )

  // Sort change handler
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater
      setSorting(newSorting)

      const newSortField = newSorting[0]?.id ?? "date"
      const newSortDir: "asc" | "desc" = newSorting[0]?.desc ? "desc" : "asc"

      setTransactions([])
      setHasMore(true)
      isLoading.current = true
      setIsLoadingState(true)

      loadMoreTransactions(0, filters, newSortField, newSortDir)
        .then((result) => {
          setTransactions(result.transactions)
          setTotalRows(result.totalRows)
          setHasMore(result.hasMore)
        })
        .finally(() => {
          isLoading.current = false
          setIsLoadingState(false)
        })
    },
    [sorting, filters]
  )

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {totalRows.toLocaleString()} transactions
        </p>
      </div>

      <TransactionsFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isLoadingState ? "Loading..." : "No transactions found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreTrigger
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoading={isLoadingState}
      />
    </div>
  )
}
