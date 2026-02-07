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
import { daysToExpiry } from "@/lib/format"
import type { OptionsRow } from "@/lib/options"
import type { OptionRecord } from "@/lib/types"
import { allColumns } from "./options-columns"

// ---------------------------------------------------------------------------
// Row Styling
// ---------------------------------------------------------------------------

function getRowClassName(row: OptionsRow): string {
  const opt = row.option
  const isOpen = opt.status === "Open"

  if (isOpen) {
    const dte = daysToExpiry(opt.expiration)
    if (dte < 0) return "bg-destructive/10"
    if (dte <= 7) return "bg-amber-500/10"
  } else {
    return "opacity-60"
  }

  return ""
}

// ---------------------------------------------------------------------------
// AllOptionsTable Component
// ---------------------------------------------------------------------------

interface AllOptionsTableProps {
  options: OptionRecord[]
}

export function AllOptionsTable({ options }: AllOptionsTableProps) {
  const rows: OptionsRow[] = useMemo(
    () =>
      options.map((opt) => ({
        option: opt,
        isChainHead: false,
        cumulativeProfit: null,
        cumulativePremium: null,
      })),
    [options],
  )

  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: rows,
    columns: allColumns,
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
                  colSpan={allColumns.length}
                  className="h-24 text-center"
                >
                  No options found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-sm">
        {options.length} option{options.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
