"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useColumnVisibility } from "@/hooks/use-column-visibility"
import { columns } from "./holdings-columns"
import type { DisplayHolding } from "@/lib/portfolio"

// ---------------------------------------------------------------------------
// Column label mapping for the visibility dropdown
// ---------------------------------------------------------------------------

const COLUMN_LABELS: Record<string, string> = {
  symbol: "Symbol",
  name: "Name",
  shares: "Shares",
  avgCost: "Avg Cost",
  totalCost: "Total Cost",
  currentPrice: "Price",
  marketValue: "Market Value",
  unrealisedPnl: "P&L",
  unrealisedPnlPct: "P&L %",
  changePct: "Day %",
  weight: "Weight",
  sector: "Sector",
  strategy: "Strategy",
  platform: "Broker",
  eps: "EPS",
  totalEarnings: "Total Earnings",
  peRatio: "P/E",
  earningsYield: "Earnings Yield",
  annualDividend: "Ann. Dividend",
  dividendYield: "Div. Yield",
  yieldOnCost: "Yield on Cost",
  annualIncome: "Ann. Income",
  beta: "Beta",
}

// ---------------------------------------------------------------------------
// HoldingsTable Component
// ---------------------------------------------------------------------------

export function HoldingsTable({ holdings }: { holdings: DisplayHolding[] }) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: "weight", desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useColumnVisibility()

  const table = useReactTable({
    data: holdings,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const totalCount = holdings.length

  return (
    <div className="min-w-0 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search symbols..."
          value={
            (table.getColumn("symbol")?.getFilterValue() as string) ?? ""
          }
          onChange={(e) =>
            table.getColumn("symbol")?.setFilterValue(e.target.value)
          }
          className="max-w-xs"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings2 className="mr-1.5 size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {COLUMN_LABELS[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
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
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/symbol/${row.original.symbol}`)
                  }
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No holdings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      <p className="text-muted-foreground text-sm">
        Showing {filteredCount} of {totalCount} holdings
      </p>
    </div>
  )
}
