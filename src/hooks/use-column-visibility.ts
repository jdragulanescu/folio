"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { VisibilityState } from "@tanstack/react-table"

const STORAGE_KEY = "folio-holdings-columns"

const DEFAULT_VISIBILITY: VisibilityState = {
  symbol: true,
  currentPrice: true,
  marketValue: true,
  unrealisedPnl: true,
  changePct: true,
  weight: true,
  // Hidden by default
  name: false,
  shares: false,
  avgCost: false,
  totalCost: false,
  unrealisedPnlPct: false,
  sector: false,
  strategy: false,
  platform: false,
  eps: false,
  totalEarnings: false,
  peRatio: false,
  earningsYield: false,
  annualDividend: false,
  dividendYield: false,
  yieldOnCost: false,
  annualIncome: false,
  beta: false,
}

// Module-level cache to avoid parsing JSON on every getSnapshot call.
// useSyncExternalStore requires referential stability when data hasn't changed.
let cached: VisibilityState = DEFAULT_VISIBILITY
let cachedRaw: string | null = null

function getSnapshot(): VisibilityState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cached

  cachedRaw = raw
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        cached = parsed as VisibilityState
        return cached
      }
    } catch {
      // Invalid JSON -- fall through to defaults
    }
  }
  cached = DEFAULT_VISIBILITY
  return cached
}

function getServerSnapshot(): VisibilityState {
  return DEFAULT_VISIBILITY
}

function subscribe(callback: () => void) {
  // Listen for cross-tab storage changes
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export function useColumnVisibility(): [
  VisibilityState,
  (
    updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
  ) => void,
] {
  const visibility = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const setVisibility = useCallback(
    (
      updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
    ) => {
      const current = getSnapshot()
      const next = typeof updater === "function" ? updater(current) : updater

      // Update cache + localStorage, then notify subscribers
      cached = next
      cachedRaw = JSON.stringify(next)
      try {
        localStorage.setItem(STORAGE_KEY, cachedRaw)
      } catch {
        // Storage full or unavailable
      }

      // Dispatch a storage event so useSyncExternalStore re-reads
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
    },
    [],
  )

  return [visibility, setVisibility]
}
