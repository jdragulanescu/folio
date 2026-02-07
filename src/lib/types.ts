// ============================================================================
// NocoDB Table Type Definitions
// ============================================================================
// TypeScript interfaces for all 8 NocoDB tables. Every interface name ends
// with `Record` to distinguish raw DB rows from computed types added later.
// ============================================================================

// ---------------------------------------------------------------------------
// Broker Constants (DATA-12)
// ---------------------------------------------------------------------------

export const BROKERS = {
  active: ["IBKR", "Trading 212", "Robinhood"] as const,
  archived: ["Freetrade", "Stake", "eToro"] as const,
} as const

export type ActiveBroker = (typeof BROKERS.active)[number]
export type ArchivedBroker = (typeof BROKERS.archived)[number]
export type Broker = ActiveBroker | ArchivedBroker

// ---------------------------------------------------------------------------
// Table Names
// ---------------------------------------------------------------------------

export type TableName =
  | "symbols"
  | "transactions"
  | "options"
  | "deposits"
  | "dividends"
  | "monthly_snapshots"
  | "price_history"
  | "settings"
  | "fundamentals_history"

// ---------------------------------------------------------------------------
// NocoDB Pagination Types
// ---------------------------------------------------------------------------

export interface PageInfo {
  totalRows: number
  page: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
}

export interface NocoDBListResponse<T> {
  list: T[]
  pageInfo: PageInfo
}

// ---------------------------------------------------------------------------
// List Parameters
// ---------------------------------------------------------------------------

export interface ListParams {
  where?: string
  sort?: string
  limit?: number
  offset?: number
  fields?: string[]
}

// ---------------------------------------------------------------------------
// Table Record Interfaces
// ---------------------------------------------------------------------------

/** Symbols table -- tracked tickers with market data */
export interface SymbolRecord {
  Id: number
  symbol: string
  name: string
  sector: string | null
  strategy: string | null
  currency: "USD" | "GBP" | null
  current_price: number | null
  previous_close: number | null
  change_pct: number | null
  day_high: number | null
  day_low: number | null
  year_high: number | null
  year_low: number | null
  market_cap: number | null
  pe_ratio: number | null
  eps: number | null
  dividend_yield: number | null
  avg_volume: number | null
  last_price_update: string | null
  // Extended fundamental metrics (populated from FMP key-metrics-ttm)
  forward_pe: number | null
  peg_ratio: number | null
  dividend_yield_ttm: number | null
  revenue_per_share: number | null
  roe: number | null
  roa: number | null
  debt_to_equity: number | null
  free_cash_flow_per_share: number | null
  book_value_per_share: number | null
  current_ratio: number | null
  beta: number | null
  price_avg_50: number | null
  price_avg_200: number | null
  last_fundamentals_update: string | null
  CreatedAt?: string
  UpdatedAt?: string
}

/** Transactions table -- buy/sell stock transactions */
export interface TransactionRecord {
  Id: number
  symbol: string
  name: string
  type: "Buy" | "Sell"
  price: number
  shares: number
  amount: number
  eps: number | null
  date: string
  platform: Broker
  CreatedAt?: string
  UpdatedAt?: string
}

/** Options table -- options contracts (wheels, LEAPS, spreads) */
export interface OptionRecord {
  Id: number
  ticker: string
  opened: string
  strategy_type: "Wheel" | "LEAPS" | "Spread" | "Collar" | "VPCS" | "BET"
  call_put: "Call" | "Put"
  buy_sell: "Buy" | "Sell"
  expiration: string
  strike: number
  delta: number | null
  iv_pct: number | null
  moneyness: "OTM" | "ATM" | "ITM" | null
  qty: number
  premium: number
  collateral: number | null
  status: "Open" | "Closed" | "Expired" | "Rolled" | "Assigned"
  close_date: string | null
  close_premium: number | null
  outer_strike: number | null
  commission: number | null
  platform: string | null
  notes: string | null
  CreatedAt?: string
  UpdatedAt?: string
}

/** Fundamentals history table -- daily fundamental snapshots per symbol */
export interface FundamentalsHistoryRecord {
  Id: number
  symbol: string
  date: string
  eps: number | null
  pe: number | null
  beta: number | null
  dividend_yield: number | null
  market_cap: number | null
  sector: string | null
  forward_pe: number | null
  peg_ratio: number | null
  roe: number | null
  roa: number | null
  CreatedAt?: string
  UpdatedAt?: string
}

/** Deposits table -- monthly capital deposits by platform */
export interface DepositRecord {
  Id: number
  month: string
  amount: number
  platform: Broker
  CreatedAt?: string
  UpdatedAt?: string
}

/** Dividends table -- individual dividend payments */
export interface DividendRecord {
  Id: number
  symbol: string
  amount: number
  date: string
  platform: Broker
  CreatedAt?: string
  UpdatedAt?: string
}

/** Monthly snapshots table -- portfolio state at end of each month */
export interface MonthlySnapshotRecord {
  Id: number
  month: string
  total_invested: number | null
  portfolio_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  dividend_income: number | null
  options_premium: number | null
  options_capital_gains: number | null
  total_deposits: number | null
  CreatedAt?: string
  UpdatedAt?: string
}

/** Price history table -- daily closing prices */
export interface PriceHistoryRecord {
  Id: number
  symbol: string
  date: string
  close_price: number
  volume: number | null
  CreatedAt?: string
  UpdatedAt?: string
}

/** Settings table -- application key-value configuration */
export interface SettingRecord {
  Id: number
  key: string
  value: string
  description: string | null
  CreatedAt?: string
  UpdatedAt?: string
}
