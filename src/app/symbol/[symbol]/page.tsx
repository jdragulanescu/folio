import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { listRecords, getAllRecords } from "@/lib/nocodb"
import { computeHolding, toDisplay } from "@/lib/calculations"
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompact,
  formatDate,
  pnlClassName,
} from "@/lib/format"
import type { SymbolRecord, TransactionRecord } from "@/lib/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>
}): Promise<Metadata> {
  const { symbol } = await params
  return { title: `${symbol.toUpperCase()} | Folio` }
}

// ---------------------------------------------------------------------------
// Stat Item Component
// ---------------------------------------------------------------------------

function StatItem({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${className ?? ""}`}>
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fundamental Item Component
// ---------------------------------------------------------------------------

function FundamentalItem({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">
        {value ?? <span className="text-muted-foreground">&ndash;</span>}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Symbol Detail Page
// ---------------------------------------------------------------------------

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol: rawSymbol } = await params
  const upperSymbol = rawSymbol.toUpperCase()

  // Fetch symbol data and transactions in parallel
  const [symbolResult, transactions] = await Promise.all([
    listRecords<SymbolRecord>("symbols", {
      where: `(symbol,eq,${upperSymbol})`,
    }),
    getAllRecords<TransactionRecord>("transactions", {
      where: `(symbol,eq,${upperSymbol})`,
      sort: "-date",
    }),
  ])

  const symbolData = symbolResult.list[0]

  // Symbol not found
  if (!symbolData) {
    return (
      <div className="space-y-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Portfolio
        </Link>
        <div className="flex flex-col items-center justify-center py-24">
          <h1 className="text-2xl font-bold">Symbol not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            No data found for &ldquo;{upperSymbol}&rdquo;.
          </p>
        </div>
      </div>
    )
  }

  // Compute holding from transactions
  const hasPrice = symbolData.current_price != null
  const holding = hasPrice
    ? computeHolding(
        transactions.map((tx) => ({
          type: tx.type,
          shares: tx.shares,
          price: tx.price,
          date: tx.date,
        })),
        symbolData.current_price!,
      )
    : null

  // Display values
  const shares = holding ? toDisplay(holding.shares, 6) : 0
  const avgCost = holding ? toDisplay(holding.avgCost) : 0
  const marketValue = holding ? toDisplay(holding.marketValue) : 0
  const unrealisedPnl = holding ? toDisplay(holding.unrealisedPnl) : 0
  const totalCost = holding ? toDisplay(holding.totalCost) : 0
  const unrealisedPnlPct =
    holding && totalCost !== 0 ? (unrealisedPnl / totalCost) * 100 : 0
  const realisedPnl = holding ? toDisplay(holding.realisedPnl) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Portfolio
        </Link>
        <div className="mt-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {upperSymbol}
          </h1>
          <p className="text-muted-foreground text-sm">{symbolData.name}</p>
        </div>
      </div>

      {/* Position Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Position Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPrice ? (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <StatItem
                label="Current Price"
                value={formatCurrency(symbolData.current_price!)}
              />
              <StatItem
                label="Shares"
                value={formatNumber(shares, 4)}
              />
              <StatItem
                label="Avg Cost"
                value={formatCurrency(avgCost)}
              />
              <StatItem
                label="Market Value"
                value={formatCurrency(marketValue)}
              />
              <StatItem
                label="Unrealised P&L"
                value={`${formatCurrency(unrealisedPnl)} (${formatPercent(unrealisedPnlPct)})`}
                className={pnlClassName(unrealisedPnl)}
              />
              <StatItem
                label="Realised P&L"
                value={formatCurrency(realisedPnl)}
                className={pnlClassName(realisedPnl)}
              />
              <StatItem
                label="Day Change"
                value={
                  symbolData.change_pct != null
                    ? formatPercent(symbolData.change_pct)
                    : "\u2013"
                }
                className={
                  symbolData.change_pct != null
                    ? pnlClassName(symbolData.change_pct)
                    : "text-muted-foreground"
                }
              />
              <StatItem label="Weight" value="N/A" />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No pricing data available for this symbol.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fundamentals */}
      <Card>
        <CardHeader>
          <CardTitle>Fundamentals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <FundamentalItem
              label="P/E Ratio"
              value={
                symbolData.pe_ratio != null
                  ? symbolData.pe_ratio.toFixed(2)
                  : null
              }
            />
            <FundamentalItem
              label="EPS"
              value={
                symbolData.eps != null
                  ? formatCurrency(symbolData.eps)
                  : null
              }
            />
            <FundamentalItem
              label="Market Cap"
              value={
                symbolData.market_cap != null
                  ? formatCompact(symbolData.market_cap)
                  : null
              }
            />
            <FundamentalItem
              label="Dividend Yield"
              value={
                symbolData.dividend_yield != null
                  ? `${symbolData.dividend_yield.toFixed(2)}%`
                  : null
              }
            />
            <FundamentalItem
              label="52-Week Range"
              value={
                symbolData.year_low != null && symbolData.year_high != null
                  ? `${formatCurrency(symbolData.year_low)} \u2013 ${formatCurrency(symbolData.year_high)}`
                  : null
              }
            />
            <FundamentalItem
              label="Forward P/E"
              value={
                symbolData.forward_pe != null
                  ? symbolData.forward_pe.toFixed(2)
                  : null
              }
            />
            <FundamentalItem
              label="PEG Ratio"
              value={
                symbolData.peg_ratio != null
                  ? symbolData.peg_ratio.toFixed(2)
                  : null
              }
            />
            <FundamentalItem
              label="ROE"
              value={
                symbolData.roe != null
                  ? `${(symbolData.roe * 100).toFixed(2)}%`
                  : null
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Platform</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.Id}>
                      <TableCell className="tabular-nums">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.type === "Buy" ? "default" : "secondary"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(tx.price)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatNumber(tx.shares, 4)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(tx.shares * tx.price)}
                      </TableCell>
                      <TableCell>{tx.platform ?? "\u2013"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No transactions for this symbol.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
