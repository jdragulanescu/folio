import "server-only"

import logger from "./logger"
import type {
  ListParams,
  NocoDBListResponse,
  TableName,
} from "./types"

// ============================================================================
// NocoDB REST Client
// ============================================================================
// Custom typed client for NocoDB API v2. Server-only -- importing this module
// in a Client Component triggers a build-time error, protecting the API token.
// ============================================================================

// ---------------------------------------------------------------------------
// Environment Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NOCODB_BASE_URL!
const API_TOKEN = process.env.NOCODB_API_TOKEN!

const TABLE_IDS: Record<TableName, string> = {
  symbols: process.env.NOCODB_TABLE_SYMBOLS!,
  transactions: process.env.NOCODB_TABLE_TRANSACTIONS!,
  options: process.env.NOCODB_TABLE_OPTIONS!,
  deposits: process.env.NOCODB_TABLE_DEPOSITS!,
  dividends: process.env.NOCODB_TABLE_DIVIDENDS!,
  monthly_snapshots: process.env.NOCODB_TABLE_SNAPSHOTS!,
  price_history: process.env.NOCODB_TABLE_PRICE_HISTORY!,
  settings: process.env.NOCODB_TABLE_SETTINGS!,
}

// ---------------------------------------------------------------------------
// Internal Fetch Wrapper
// ---------------------------------------------------------------------------

const PAGE_SIZE = 200

const log = logger.child({ module: "nocodb" })

async function nocodbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`

  log.debug({ method: init?.method ?? "GET", path }, "request")

  const response = await fetch(url, {
    ...init,
    headers: {
      "xc-token": API_TOKEN,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    log.error({ path, status: response.status, body: text }, "request failed")
    throw new Error(`NocoDB ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

/**
 * Fetch a single page of records from a NocoDB table.
 *
 * Supports filtering (where), sorting (sort), pagination (limit/offset),
 * and field selection (fields).
 */
export async function listRecords<T>(
  table: TableName,
  params?: ListParams,
): Promise<NocoDBListResponse<T>> {
  const tableId = TABLE_IDS[table]
  const searchParams = new URLSearchParams()

  if (params?.where) searchParams.set("where", params.where)
  if (params?.sort) searchParams.set("sort", params.sort)
  if (params?.limit != null) searchParams.set("limit", String(params.limit))
  if (params?.offset != null) searchParams.set("offset", String(params.offset))
  if (params?.fields?.length) searchParams.set("fields", params.fields.join(","))

  const query = searchParams.toString()
  const path = `/api/v2/tables/${tableId}/records${query ? `?${query}` : ""}`

  return nocodbFetch<NocoDBListResponse<T>>(path)
}

/**
 * Auto-paginate through all records in a NocoDB table.
 *
 * Fetches pages of PAGE_SIZE (200) sequentially until pageInfo.isLastPage
 * is true. Supports filtering, sorting, and field selection but not
 * manual limit/offset (those are managed internally).
 */
export async function getAllRecords<T>(
  table: TableName,
  params?: Omit<ListParams, "limit" | "offset">,
): Promise<T[]> {
  const records: T[] = []
  let offset = 0

  while (true) {
    const page = await listRecords<T>(table, {
      ...params,
      limit: PAGE_SIZE,
      offset,
    })

    records.push(...page.list)

    if (page.pageInfo.isLastPage) {
      break
    }

    offset += PAGE_SIZE
  }

  return records
}

/**
 * Fetch a single record by its row ID.
 */
export async function getRecord<T>(
  table: TableName,
  rowId: number,
): Promise<T> {
  const tableId = TABLE_IDS[table]
  return nocodbFetch<T>(`/api/v2/tables/${tableId}/records/${rowId}`)
}

/**
 * Create a new record in a NocoDB table.
 */
export async function createRecord<T>(
  table: TableName,
  data: Partial<T>,
): Promise<T> {
  const tableId = TABLE_IDS[table]
  return nocodbFetch<T>(`/api/v2/tables/${tableId}/records`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * Update an existing record by row ID.
 */
export async function updateRecord<T>(
  table: TableName,
  rowId: number,
  data: Partial<T>,
): Promise<T> {
  const tableId = TABLE_IDS[table]
  return nocodbFetch<T>(`/api/v2/tables/${tableId}/records`, {
    method: "PATCH",
    body: JSON.stringify({ Id: rowId, ...data }),
  })
}

/**
 * Bulk-create multiple records in a single API call.
 *
 * Posts an array of records to NocoDB. Returns empty array immediately
 * if no records are provided (skips the API call).
 */
export async function createRecords<T>(
  table: TableName,
  records: Partial<T>[],
): Promise<T[]> {
  if (records.length === 0) return []

  const tableId = TABLE_IDS[table]
  return nocodbFetch<T[]>(`/api/v2/tables/${tableId}/records`, {
    method: "POST",
    body: JSON.stringify(records),
  })
}

/** Maximum records per bulk update request (safe NocoDB batch size). */
const BULK_UPDATE_BATCH_SIZE = 50

/**
 * Bulk-update multiple records in a single API call.
 *
 * Each record must include its `Id` field (NocoDB v2 requirement).
 * Automatically batches in groups of 50 records per request to stay
 * within safe NocoDB limits. Batches are sent sequentially and results
 * are concatenated.
 *
 * Returns empty array immediately if no records are provided.
 */
export async function updateRecords<T>(
  table: TableName,
  records: Array<Partial<T> & { Id: number }>,
): Promise<T[]> {
  if (records.length === 0) return []

  const tableId = TABLE_IDS[table]
  const results: T[] = []

  for (let i = 0; i < records.length; i += BULK_UPDATE_BATCH_SIZE) {
    const batch = records.slice(i, i + BULK_UPDATE_BATCH_SIZE)
    const batchResults = await nocodbFetch<T[]>(
      `/api/v2/tables/${tableId}/records`,
      {
        method: "PATCH",
        body: JSON.stringify(batch),
      },
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Fetch from multiple tables concurrently with type-safe results.
 *
 * Each fetcher is a function returning a Promise. Results are returned
 * as a typed tuple matching the input order.
 *
 * @example
 * const [symbols, transactions] = await fetchParallel(
 *   () => getAllRecords<SymbolRecord>("symbols"),
 *   () => getAllRecords<TransactionRecord>("transactions"),
 * )
 */
export async function fetchParallel<T extends readonly unknown[]>(
  ...fetchers: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  const results = await Promise.all(fetchers.map((fn) => fn()))
  return results as unknown as T
}
