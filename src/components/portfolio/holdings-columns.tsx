"use client"

import type { ColumnDef, HeaderContext, SortingFn } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  pnlClassName,
} from "@/lib/format"
import type { DisplayHolding } from "@/lib/portfolio"

// ---------------------------------------------------------------------------
// Reusable Sortable Header
// ---------------------------------------------------------------------------

function SortableHeader<T>({
  column,
  label,
}: HeaderContext<T, unknown> & { label: string }) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 size-3.5" />
      )}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Custom sorting function: null values always go to the bottom
// ---------------------------------------------------------------------------

const nullBottomSort: SortingFn<DisplayHolding> = (rowA, rowB, columnId) => {
  const a = rowA.getValue<number | null>(columnId)
  const b = rowB.getValue<number | null>(columnId)

  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  return a - b
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

export const columns: ColumnDef<DisplayHolding>[] = [
  {
    accessorKey: "symbol",
    header: (ctx) => <SortableHeader {...ctx} label="Symbol" />,
    cell: ({ row }) => (
      <Link
        href={`/symbol/${row.original.symbol}`}
        className="font-bold hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.symbol}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: (ctx) => <SortableHeader {...ctx} label="Name" />,
    cell: ({ getValue }) => (
      <span className="max-w-[200px] truncate">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "shares",
    header: (ctx) => <SortableHeader {...ctx} label="Shares" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatNumber(getValue<number>(), 4)}</span>
    ),
  },
  {
    accessorKey: "avgCost",
    header: (ctx) => <SortableHeader {...ctx} label="Avg Cost" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatCurrency(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "totalCost",
    header: (ctx) => <SortableHeader {...ctx} label="Total Cost" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatCurrency(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "currentPrice",
    header: (ctx) => <SortableHeader {...ctx} label="Price" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatCurrency(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "marketValue",
    header: (ctx) => <SortableHeader {...ctx} label="Market Value" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatCurrency(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "unrealisedPnl",
    header: (ctx) => <SortableHeader {...ctx} label="P&L" />,
    cell: ({ getValue }) => {
      const value = getValue<number>()
      return (
        <span className={`tabular-nums ${pnlClassName(value)}`}>
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorKey: "unrealisedPnlPct",
    header: (ctx) => <SortableHeader {...ctx} label="P&L %" />,
    cell: ({ getValue }) => {
      const value = getValue<number>()
      return (
        <span className={`tabular-nums ${pnlClassName(value)}`}>
          {formatPercent(value)}
        </span>
      )
    },
  },
  {
    accessorKey: "realisedPnl",
    header: (ctx) => <SortableHeader {...ctx} label="Realised" />,
    cell: ({ getValue }) => {
      const value = getValue<number>()
      return (
        <span className={`tabular-nums ${pnlClassName(value)}`}>
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorKey: "changePct",
    header: (ctx) => <SortableHeader {...ctx} label="Day %" />,
    sortingFn: nullBottomSort,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums">&ndash;</span>
      }
      return (
        <span className={`tabular-nums ${pnlClassName(value)}`}>
          {formatPercent(value)}
        </span>
      )
    },
  },
  {
    accessorKey: "weight",
    header: (ctx) => <SortableHeader {...ctx} label="Weight" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{getValue<number>().toFixed(2)}%</span>
    ),
  },
  {
    accessorKey: "sector",
    header: (ctx) => <SortableHeader {...ctx} label="Sector" />,
    cell: ({ getValue }) => {
      const value = getValue<string | null>()
      return value ? <Badge variant="secondary">{value}</Badge> : null
    },
  },
  {
    accessorKey: "strategy",
    header: (ctx) => <SortableHeader {...ctx} label="Strategy" />,
    cell: ({ getValue }) => {
      const value = getValue<string | null>()
      return value ? <Badge variant="outline">{value}</Badge> : null
    },
  },
  {
    accessorKey: "platform",
    header: (ctx) => <SortableHeader {...ctx} label="Broker" />,
    cell: ({ getValue }) => getValue<string | null>() ?? "",
  },
]
