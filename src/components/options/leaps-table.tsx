"use client"

import { useState, useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { computeLeapsDisplay, isLongStrategy, type LeapsDisplayRow } from "@/lib/options-shared"
import type { OptionRecord } from "@/lib/types"
import { longColumns } from "./options-columns"

// ---------------------------------------------------------------------------
// Row Styling
// ---------------------------------------------------------------------------

function getRowClassName(row: LeapsDisplayRow): string {
  if (row.status === "Open") {
    const dte = row.daysToExpiry
    if (dte < 0) return "bg-destructive/10"
    if (dte <= 7) return "bg-amber-500/10"
  }

  return ""
}

// ---------------------------------------------------------------------------
// LongOptionsTable Component (formerly LeapsTable)
// ---------------------------------------------------------------------------

interface LongOptionsTableProps {
  options: OptionRecord[]
  symbolPrices: Record<string, number>
}

export function LongOptionsTable({ options, symbolPrices }: LongOptionsTableProps) {
  const longRows = useMemo(() => {
    const longOptions = options.filter(
      (opt) => isLongStrategy(opt.strategy_type),
    )
    return longOptions.map((opt) =>
      computeLeapsDisplay(opt, symbolPrices[opt.ticker] ?? null),
    )
  }, [options, symbolPrices])

  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: longRows,
    columns: longColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
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
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(getRowClassName(row.original))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={longColumns.length}
                  className="h-24 text-center"
                >
                  No long option positions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-sm">
        {longRows.length} position{longRows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

// Backwards-compatible alias
export { LongOptionsTable as LeapsTable }
