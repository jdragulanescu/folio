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
import { computeProfit, computeDaysHeld, computeReturnPct } from "@/lib/options-shared"

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
// Null-safe sorting functions
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

function DteCell({ expirationDate, status }: { expirationDate: string; status: string }) {
  const dte = daysToExpiry(expirationDate, status)
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
// Short Options Columns (formerly Wheel)
// ---------------------------------------------------------------------------

export const shortColumns: ColumnDef<OptionsRow>[] = [
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
    accessorFn: (row) => row.option.qty,
    id: "qty",
    header: (ctx) => <SortableHeader {...ctx} label="Qty" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">{row.original.option.qty}</span>
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
    accessorFn: (row) => row.option.outer_strike,
    id: "outer_strike",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Outer Strike" />,
    cell: ({ row }) => {
      const value = row.original.option.outer_strike
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
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
    accessorFn: (row) => daysToExpiry(row.option.expiration, row.option.status),
    id: "dte",
    header: (ctx) => <SortableHeader {...ctx} label="DTE" />,
    cell: ({ row }) => <DteCell expirationDate={row.original.option.expiration} status={row.original.option.status} />,
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
    accessorFn: (row) => row.option.moneyness,
    id: "moneyness",
    header: (ctx) => <SortableHeader {...ctx} label="Moneyness" />,
    cell: ({ row }) => {
      const value = row.original.option.moneyness
      return value ? <Badge variant="secondary">{value}</Badge> : "\u2014"
    },
  },
  {
    accessorFn: (row) => {
      const opt = row.option
      return row.isChainHead
        ? (row.cumulativePremium ?? 0)
        : opt.premium * opt.qty * 100
    },
    id: "credit",
    header: (ctx) => <SortableHeader {...ctx} label="Credit" />,
    cell: ({ row }) => {
      const opt = row.original.option
      const value = row.original.isChainHead
        ? (row.original.cumulativePremium ?? 0)
        : opt.premium * opt.qty * 100
      return (
        <span
          className="tabular-nums text-right"
          title={row.original.isChainHead ? "Cumulative chain credit" : undefined}
        >
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => {
      const opt = row.option
      return opt.close_premium != null ? opt.close_premium * opt.qty * 100 : null
    },
    id: "debit",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Debit" />,
    cell: ({ row }) => {
      const opt = row.original.option
      const value = opt.close_premium != null ? opt.close_premium * opt.qty * 100 : null
      return (
        <span className="tabular-nums text-right">
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
    accessorFn: (row) => row.option.commission != null ? row.option.commission * row.option.qty : null,
    id: "commission",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Commission" />,
    cell: ({ row }) => {
      const c = row.original.option.commission
      const value = c != null ? c * row.original.option.qty : null
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => {
      return row.isChainHead
        ? (row.cumulativeProfit ?? 0)
        : computeProfit(row.option)
    },
    id: "profit",
    header: (ctx) => <SortableHeader {...ctx} label="Profit" />,
    cell: ({ row }) => {
      const value = row.original.isChainHead
        ? (row.original.cumulativeProfit ?? 0)
        : computeProfit(row.original.option)
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
    accessorFn: (row) => computeReturnPct(row.option),
    id: "return_pct",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Return%" />,
    cell: ({ row }) => {
      const value = computeReturnPct(row.original.option)
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
    accessorFn: (row) => computeDaysHeld(row.option),
    id: "days_held",
    header: (ctx) => <SortableHeader {...ctx} label="Days Held" />,
    cell: ({ row }) => {
      const value = computeDaysHeld(row.original.option)
      return (
        <span className="tabular-nums text-right">
          {value}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.close_date,
    id: "close_date",
    header: (ctx) => <SortableHeader {...ctx} label="Date Closed" />,
    cell: ({ row }) => {
      const value = row.original.option.close_date
      return (
        <span className="tabular-nums">
          {value ? formatDate(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.close_premium,
    id: "closing_cost",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Closing Cost" />,
    cell: ({ row }) => {
      const value = row.original.option.close_premium
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
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
// Long Options Columns (formerly LEAPS)
// ---------------------------------------------------------------------------

export const longColumns: ColumnDef<LeapsDisplayRow>[] = [
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
    accessorKey: "qty",
    header: (ctx) => <SortableHeader {...ctx} label="Qty" />,
    cell: ({ getValue }) => (
      <span className="tabular-nums text-right">{getValue<number>()}</span>
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
    id: "debit",
    accessorFn: (row) => row.premium * row.qty * 100,
    header: (ctx) => <SortableHeader {...ctx} label="Debit" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right text-loss">
        {formatCurrency(row.original.premium * row.original.qty * 100)}
      </span>
    ),
  },
  {
    id: "credit",
    accessorFn: (row) => row.close_premium != null ? row.close_premium * row.qty * 100 : null,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Credit" />,
    cell: ({ row }) => {
      const cp = row.original.close_premium
      if (cp == null) return <span className="tabular-nums text-right text-muted-foreground">{"\u2014"}</span>
      return (
        <span className="tabular-nums text-right text-gain">
          {formatCurrency(cp * row.original.qty * 100)}
        </span>
      )
    },
  },
  {
    id: "costBasis",
    accessorFn: (row) => row.costBasis,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Cost Basis" />,
    cell: ({ row }) => {
      const value = row.original.costBasis
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "currentPnl",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Profit" />,
    cell: ({ row }) => {
      const value = row.original.currentPnl
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
          {value != null ? formatPercent(value * 100) : "\u2014"}
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
    id: "valueLostPerMonth",
    accessorFn: (row) => row.valueLostPerMonth,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="$/Month Lost" />,
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
    id: "premiumFeePct",
    accessorFn: (row) => row.premiumFeePct,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Premium Fee%" />,
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
    id: "leverage",
    accessorFn: (row) =>
      row.currentPrice != null && row.premium > 0
        ? row.currentPrice / row.premium
        : null,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Leverage" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? `${formatNumber(value, 1)}x` : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "close_date",
    header: (ctx) => <SortableHeader {...ctx} label="Date Closed" />,
    cell: ({ getValue }) => {
      const value = getValue<string | null>()
      return (
        <span className="tabular-nums">
          {value ? formatDate(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "close_premium",
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Closing Cost" />,
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    id: "commission",
    accessorFn: (row) => row.commission != null ? row.commission * row.qty : null,
    sortingFn: nullBottomSortLeaps,
    header: (ctx) => <SortableHeader {...ctx} label="Commission" />,
    cell: ({ row }) => {
      const c = row.original.commission
      const value = c != null ? c * row.original.qty : null
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
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
    accessorFn: (row) => row.option.qty,
    id: "qty",
    header: (ctx) => <SortableHeader {...ctx} label="Qty" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-right">{row.original.option.qty}</span>
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
    accessorFn: (row) => daysToExpiry(row.option.expiration, row.option.status),
    id: "dte",
    header: (ctx) => <SortableHeader {...ctx} label="DTE" />,
    cell: ({ row }) => <DteCell expirationDate={row.original.option.expiration} status={row.original.option.status} />,
  },
  {
    accessorFn: (row) => row.option.premium * row.option.qty * 100,
    id: "premium",
    header: (ctx) => <SortableHeader {...ctx} label="Premium" />,
    cell: ({ row }) => {
      const value = row.original.option.premium * row.original.option.qty * 100
      return (
        <span className="tabular-nums text-right">
          {formatCurrency(value)}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => computeProfit(row.option),
    id: "profit",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Profit" />,
    cell: ({ row }) => {
      const value = computeProfit(row.original.option)
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
    accessorFn: (row) => computeReturnPct(row.option),
    id: "return_pct",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Return%" />,
    cell: ({ row }) => {
      const value = computeReturnPct(row.original.option)
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
    accessorFn: (row) => row.option.close_date,
    id: "close_date",
    header: (ctx) => <SortableHeader {...ctx} label="Date Closed" />,
    cell: ({ row }) => {
      const value = row.original.option.close_date
      return (
        <span className="tabular-nums">
          {value ? formatDate(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.close_premium,
    id: "closing_cost",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Closing Cost" />,
    cell: ({ row }) => {
      const value = row.original.option.close_premium
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorFn: (row) => row.option.commission != null ? row.option.commission * row.option.qty : null,
    id: "commission",
    sortingFn: nullBottomSort,
    header: (ctx) => <SortableHeader {...ctx} label="Commission" />,
    cell: ({ row }) => {
      const c = row.original.option.commission
      const value = c != null ? c * row.original.option.qty : null
      return (
        <span className="tabular-nums text-right">
          {value != null ? formatCurrency(value) : "\u2014"}
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

// Backwards-compatible aliases
export { shortColumns as wheelColumns, longColumns as leapsColumns }
