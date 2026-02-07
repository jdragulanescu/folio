"use client"

import { useState, useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  type SortingState,
  type ExpandedState,
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
import { daysToExpiry } from "@/lib/format"
import { buildOptionsRows, isShortStrategy, type OptionsRow } from "@/lib/options-shared"
import type { OptionRecord } from "@/lib/types"
import { shortColumns } from "./options-columns"

// ---------------------------------------------------------------------------
// Row Styling
// ---------------------------------------------------------------------------

function getRowClassName(row: OptionsRow, depth: number): string {
  const opt = row.option
  const isOpen = opt.status === "Open"

  if (isOpen) {
    const dte = daysToExpiry(opt.expiration)
    if (dte < 0) return "bg-destructive/10"
    if (dte <= 7) return "bg-amber-500/10"
  }

  if (depth > 0) {
    return "border-l-2 border-muted"
  }

  return ""
}

// ---------------------------------------------------------------------------
// ShortOptionsTable Component (formerly WheelTable)
// ---------------------------------------------------------------------------

interface ShortOptionsTableProps {
  options: OptionRecord[]
  symbolPrices: Record<string, number>
}

export function ShortOptionsTable({ options }: ShortOptionsTableProps) {
  const rows = useMemo(() => {
    const shortOptions = options.filter(
      (opt) => isShortStrategy(opt.strategy_type),
    )
    return buildOptionsRows(shortOptions)
  }, [options])

  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data: rows,
    columns: shortColumns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
                  className={cn(
                    getRowClassName(row.original, row.depth),
                    row.depth > 0 && "border-l-2 border-muted",
                  )}
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
                  colSpan={shortColumns.length}
                  className="h-24 text-center"
                >
                  No short option positions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-sm">
        {rows.length} position{rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

// Backwards-compatible alias
export { ShortOptionsTable as WheelTable }
