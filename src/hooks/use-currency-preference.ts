"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "folio-currency"

type Currency = "USD" | "GBP"

let cached: Currency = "USD"
let cachedRaw: string | null = null

function getSnapshot(): Currency {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cached

  cachedRaw = raw
  if (raw === "USD" || raw === "GBP") {
    cached = raw
    return cached
  }
  cached = "USD"
  return cached
}

function getServerSnapshot(): Currency {
  return "USD"
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export function useCurrencyPreference(): [Currency, (c: Currency) => void] {
  const currency = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const setCurrency = useCallback((c: Currency) => {
    cached = c
    cachedRaw = c
    try {
      localStorage.setItem(STORAGE_KEY, c)
    } catch {
      // Storage full or unavailable
    }
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
  }, [])

  return [currency, setCurrency]
}
