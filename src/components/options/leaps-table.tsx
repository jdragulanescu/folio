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
import { computeLeapsDisplay, type LeapsDisplayRow } from "@/lib/options-shared"
import type { OptionRecord } from "@/lib/types"
import { leapsColumns } from "./options-columns"

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
// LeapsTable Component
// ---------------------------------------------------------------------------

interface LeapsTableProps {
  options: OptionRecord[]
  symbolPrices: Record<string, number>
}

export function LeapsTable({ options, symbolPrices }: LeapsTableProps) {
  const leapsRows = useMemo(() => {
    const leapsOptions = options.filter(
      (opt) => opt.strategy_type === "LEAPS",
    )
    return leapsOptions.map((opt) =>
      computeLeapsDisplay(opt, symbolPrices[opt.ticker] ?? null),
    )
  }, [options, symbolPrices])

  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: leapsRows,
    columns: leapsColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
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
                  colSpan={leapsColumns.length}
                  className="h-24 text-center"
                >
                  No LEAPS positions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-sm">
        {leapsRows.length} position{leapsRows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
