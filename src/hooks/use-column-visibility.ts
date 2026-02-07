"use client"

import { useState, useCallback, useEffect } from "react"
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
  realisedPnl: false,
  unrealisedPnlPct: false,
  sector: false,
  strategy: false,
  platform: false,
}

export function useColumnVisibility(): [
  VisibilityState,
  (
    updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
  ) => void,
] {
  const [visibility, setVisibilityState] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBILITY

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as VisibilityState
        }
      }
    } catch {
      // Invalid JSON or storage error -- fall through to defaults
    }

    return DEFAULT_VISIBILITY
  })

  // Persist to localStorage whenever visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
    } catch {
      // Storage full or unavailable -- silently ignore
    }
  }, [visibility])

  const setVisibility = useCallback(
    (
      updater: VisibilityState | ((prev: VisibilityState) => VisibilityState),
    ) => {
      setVisibilityState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        return next
      })
    },
    [],
  )

  return [visibility, setVisibility]
}
