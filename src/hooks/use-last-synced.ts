"use client"

import useSWR from "swr"

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchLastSynced(
  url: string,
): Promise<{ lastSynced: string | null }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch sync status: ${response.status}`)
  }
  return response.json() as Promise<{ lastSynced: string | null }>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * SWR hook for the last-synced timestamp.
 *
 * Polls GET /api/sync/status every 60 seconds for automatic updates.
 * Also revalidated on-demand after a sync completes (via SWR mutate).
 */
export function useLastSynced() {
  const { data, isLoading, mutate } = useSWR(
    "/api/sync/status",
    fetchLastSynced,
    { refreshInterval: 60_000 },
  )

  return {
    lastSynced: data?.lastSynced ?? null,
    isLoading,
    revalidate: mutate,
  }
}
