"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import type { TransactionRecord } from "@/lib/types"
import { formatCurrency, formatNumber, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string
  sorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={onToggle}
    >
      {label}
      {sorted === "asc" ? (
        <ChevronUp className="ml-1 size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDown className="ml-1 size-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5" />
      )}
    </Button>
  )
}

export const columns: ColumnDef<TransactionRecord>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <SortHeader
        label="Date"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting()}
      />
    ),
    cell: ({ row }) => formatDate(row.original.date),
  },
  {
    accessorKey: "symbol",
    header: ({ column }) => (
      <SortHeader
        label="Symbol"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting()}
      />
    ),
    cell: ({ row }) => (
      <span className="font-mono font-bold">{row.original.symbol}</span>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortHeader
        label="Name"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting()}
      />
    ),
    cell: ({ row }) => {
      const name = row.original.name
      if (name.length > 30) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  {name.slice(0, 30)}...
                </span>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
      return <span>{name}</span>
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    enableSorting: false,
    cell: ({ row }) => {
      const type = row.original.type
      return (
        <Badge
          variant="outline"
          className={
            type === "Buy"
              ? "bg-gain/15 text-gain border-transparent"
              : "bg-loss/15 text-loss border-transparent"
          }
        >
          {type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader
          label="Price"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(row.original.price)}</div>
    ),
  },
  {
    accessorKey: "shares",
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader
          label="Shares"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatNumber(row.original.shares, 0)}</div>
    ),
  },
  {
    id: "amount",
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader
          label="Amount"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting()}
        />
      </div>
    ),
    accessorFn: (row) => row.shares * row.price,
    cell: ({ row }) => (
      <div className="text-right">
        {formatCurrency(row.original.shares * row.original.price)}
      </div>
    ),
  },
  {
    accessorKey: "platform",
    header: ({ column }) => (
      <SortHeader
        label="Platform"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting()}
      />
    ),
    cell: ({ row }) => row.original.platform,
  },
  {
    accessorKey: "eps",
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader
          label="EPS"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.eps != null ? formatNumber(row.original.eps) : "\u2014"}
      </div>
    ),
  },
]
