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
import { buildOptionsRows, type OptionsRow } from "@/lib/options"
import type { OptionRecord } from "@/lib/types"
import { wheelColumns } from "./options-columns"

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
  } else {
    return "opacity-60"
  }

  if (depth > 0) {
    return "border-l-2 border-muted"
  }

  return ""
}

// ---------------------------------------------------------------------------
// WheelTable Component
// ---------------------------------------------------------------------------

interface WheelTableProps {
  options: OptionRecord[]
  symbolPrices: Record<string, number>
}

export function WheelTable({ options }: WheelTableProps) {
  const rows = useMemo(() => {
    const wheelOptions = options.filter(
      (opt) => opt.strategy_type === "Wheel",
    )
    return buildOptionsRows(wheelOptions)
  }, [options])

  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data: rows,
    columns: wheelColumns,
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
                  colSpan={wheelColumns.length}
                  className="h-24 text-center"
                >
                  No wheel positions found.
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
