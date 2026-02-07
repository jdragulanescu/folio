"use client"

import type { ColumnDef, HeaderContext, SortingFn } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  daysToExpiry,
  pnlClassName,
} from "@/lib/format"
import type { OptionsRow, LeapsDisplayRow } from "@/lib/options-shared"

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
// Null-safe sorting function
// ---------------------------------------------------------------------------

const nullBottomSort: SortingFn<OptionsRow> = (rowA, rowB, columnId) => {
  const a = rowA.getValue<number | null>(columnId)
  const b = rowB.getValue<number | null>(columnId)

  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  return a - b
}

const nullBottomSortLeaps: SortingFn<LeapsDisplayRow> = (rowA, rowB, columnId) => {
  const a = rowA.getValue<number | null>(columnId)
  const b = rowB.getValue<number | null>(columnId)

  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  return a - b
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Open"
      ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : status === "Rolled"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : status === "Assigned"
          ? "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400"
          : "border-muted text-muted-foreground"

  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// DTE Cell
// ---------------------------------------------------------------------------

function DteCell({ expirationDate }: { expirationDate: string }) {
  const dte = daysToExpiry(expirationDate)
  const className =
    dte < 0
      ? "text-destructive"
      : dte <= 7
        ? "text-amber-600 dark:text-amber-400"
        : ""

  return <span className={`tabular-nums text-right ${className}`}>{dte}</span>
}

function DteCellValue({ dte }: { dte: number }) {
  const className =
    dte < 0
      ? "text-destructive"
      : dte <= 7
        ? "text-amber-600 dark:text-amber-400"
        : ""

  return <span className={`tabular-nums text-right ${className}`}>{dte}</span>
}

// ---------------------------------------------------------------------------
// Wheel Columns
// ---------------------------------------------------------------------------

export const wheelColumns: ColumnDef<OptionsRow>[] = [
  {
    id: "expand",
    header: () => null,
    size: 40,
    cell: ({ row }) => {
      if (!row.subRows?.length) return null
      return (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>
      )
    },
  },
  {
    accessorFn: (row) => row.option.ticker,
    id: "ticker",
    header: (ctx) => <SortableHeader {...ctx} label="Ticker" />,
    cell: ({ row }) => (
      <span
        className="font-mono font-bold"
        style={{ paddingLeft: row.depth > 0 ? `${row.depth * 1.5}rem` : undefined }}
      >
        {row.original.option.ticker}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.option.opened,
    id: "opened",
    header: (ctx) => <SortableHeader {...ctx} label="Opened" />,
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDate(row.original.option.opened)}</span>
    ),
  },
  {
    accessorFn: (row) => row.option.call_put,
    id: "call_put",
    header: (ctx) => <SortableHeader {...ctx} label="C/P" />,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.option.call_put}</Badge>
    ),
  },
  {
    accessorFn: (row) => row.option.strike,
    id: "strike",
    header: (ctx) => <SortableHeader {...ctx} label="Strike" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">
        {formatCurrency(row.original.option.strike)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.option.expiration,
    id: "expiration",
    header: (ctx) => <SortableHeader {...ctx} label="Expiration" />,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatDate(row.original.option.expiration)}
      </span>
    ),
  },
  {
    accessorFn: (row) => daysToExpiry(row.option.expiration),
    id: "dte",
    header: (ctx) => <SortableHeader {...ctx} label="DTE" />,
    cell: ({ row }) => <DteCell expirationDate={row.original.option.expiration} />,
  },
  {
    accessorFn: (row) => row.option.delta,
    id: "delta",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Delta" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">
        {row.original.option.delta != null
          ? formatNumber(row.original.option.delta, 3)
          : "\u2014"}
      </span>
    ),
  },
  {
    accessorFn: (row) =>
      row.isChainHead ? row.cumulativePremium : row.option.premium,
    id: "premium",
    header: (ctx) => <SortableHeader {...ctx} label="Premium" />,
    cell: ({ row }) => {
      const value = row.original.isChainHead
        ? row.original.cumulativePremium
        : row.original.option.premium
      return (
        <span
          className="tabular-nums text-right"
          title={row.original.isChainHead ? "Cumulative chain premium" : undefined}
        >
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.collateral,
    id: "collateral",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Collateral" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">
        {row.original.option.collateral != null
          ? formatCurrency(row.original.option.collateral)
          : "\u2014"}
      </span>
    ),
  },
  {
    accessorFn: (row) =>
      row.isChainHead ? row.cumulativeProfit : row.option.profit,
    id: "profit",
    header: (ctx) => <SortableHeader {...ctx} label="Profit" />,
    cell: ({ row }) => {
      const value = row.original.isChainHead
        ? row.original.cumulativeProfit
        : row.original.option.profit
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums text-right">{"\u2014"}</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.return_pct,
    id: "return_pct",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Return%" />,
    cell: ({ row }) => {
      const value = row.original.option.return_pct
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums text-right">{"\u2014"}</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatPercent(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.annualised_return_pct,
    id: "annualised_return_pct",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Ann. Return%" />,
    cell: ({ row }) => {
      const value = row.original.option.annualised_return_pct
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums text-right">{"\u2014"}</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatPercent(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.status,
    id: "status",
    header: (ctx) => <SortableHeader {...ctx} label="Status" />,
    cell: ({ row }) => <StatusBadge status={row.original.option.status} />,
  },
]

// ---------------------------------------------------------------------------
// LEAPS Columns
// ---------------------------------------------------------------------------

export const leapsColumns: ColumnDef<LeapsDisplayRow>[] = [
  {
    accessorKey: "ticker",
    header: (ctx) => <SortableHeader {...ctx} label="Ticker" />,
    cell: ({ getValue }) => (
      <span className="font-mono font-bold">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "opened",
    header: (ctx) => <SortableHeader {...ctx} label="Opened" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatDate(getValue<string>())}</span>
    ),
  },
  {
    accessorKey: "call_put",
    header: (ctx) => <SortableHeader {...ctx} label="C/P" />,
    cell: ({ getValue }) => (
      <Badge variant="secondary">{getValue<string>()}</Badge>
    ),
  },
  {
    accessorKey: "strike",
    header: (ctx) => <SortableHeader {...ctx} label="Strike" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums text-right">
        {formatCurrency(getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "currentPrice",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Current Price" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "N/A"}
        </span>
      )
    },
  },
  {
    accessorKey: "expiration",
    header: (ctx) => <SortableHeader {...ctx} label="Expiration" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatDate(getValue<string>())}</span>
    ),
  },
  {
    accessorKey: "daysToExpiry",
    header: (ctx) => <SortableHeader {...ctx} label="DTE" />,
    cell: ({ getValue }) => <DteCellValue dte={getValue<number>()} />,
  },
  {
    accessorKey: "premium",
    header: (ctx) => <SortableHeader {...ctx} label="Premium Paid" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums text-right">
        {formatCurrency(getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "currentPnl",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Current P&L" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      if (value == null) {
        return <span className="tabular-nums text-right text-muted-foreground">N/A</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorKey: "delta",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Delta" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatNumber(value, 3) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "iv_pct",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="IV%" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatPercent(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "intrinsicValue",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Intrinsic" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "N/A"}
        </span>
      )
    },
  },
  {
    accessorKey: "extrinsicValue",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Extrinsic" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "N/A"}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: (ctx) => <SortableHeader {...ctx} label="Status" />,
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
]

// ---------------------------------------------------------------------------
// All Options Columns (flat list, no roll chain expansion)
// ---------------------------------------------------------------------------

export const allColumns: ColumnDef<OptionsRow>[] = [
  {
    accessorFn: (row) => row.option.ticker,
    id: "ticker",
    header: (ctx) => <SortableHeader {...ctx} label="Ticker" />,
    cell: ({ row }) => (
      <span className="font-mono font-bold">{row.original.option.ticker}</span>
    ),
  },
  {
    accessorFn: (row) => row.option.strategy_type,
    id: "strategy_type",
    header: (ctx) => <SortableHeader {...ctx} label="Strategy" />,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.option.strategy_type}</Badge>
    ),
  },
  {
    accessorFn: (row) => row.option.opened,
    id: "opened",
    header: (ctx) => <SortableHeader {...ctx} label="Opened" />,
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDate(row.original.option.opened)}</span>
    ),
  },
  {
    accessorFn: (row) => row.option.call_put,
    id: "call_put",
    header: (ctx) => <SortableHeader {...ctx} label="C/P" />,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.option.call_put}</Badge>
    ),
  },
  {
    accessorFn: (row) => row.option.strike,
    id: "strike",
    header: (ctx) => <SortableHeader {...ctx} label="Strike" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">
        {formatCurrency(row.original.option.strike)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.option.expiration,
    id: "expiration",
    header: (ctx) => <SortableHeader {...ctx} label="Expiration" />,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatDate(row.original.option.expiration)}
      </span>
    ),
  },
  {
    accessorFn: (row) => daysToExpiry(row.option.expiration),
    id: "dte",
    header: (ctx) => <SortableHeader {...ctx} label="DTE" />,
    cell: ({ row }) => <DteCell expirationDate={row.original.option.expiration} />,
  },
  {
    accessorFn: (row) => row.option.premium,
    id: "premium",
    header: (ctx) => <SortableHeader {...ctx} label="Premium" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">
        {formatCurrency(row.original.option.premium)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.option.profit,
    id: "profit",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Profit" />,
    cell: ({ row }) => {
      const value = row.original.option.profit
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums text-right">{"\u2014"}</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.return_pct,
    id: "return_pct",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Return%" />,
    cell: ({ row }) => {
      const value = row.original.option.return_pct
      if (value == null) {
        return <span className="text-muted-foreground tabular-nums text-right">{"\u2014"}</span>
      }
      return (
        <span className={`tabular-nums text-right ${pnlClassName(value)}`}>
          {formatPercent(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.status,
    id: "status",
    header: (ctx) => <SortableHeader {...ctx} label="Status" />,
    cell: ({ row }) => <StatusBadge status={row.original.option.status} />,
  },
]
