"use client"

import { useCallback, useState } from "react"
import useSWRMutation from "swr/mutation"
import { mutate } from "swr"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SyncProgress =
  | { type: "start"; total: number }
  | { type: "progress"; completed: number; total: number; batch: number }
  | { type: "complete"; timestamp: string; updated: number; failed: number }
  | { type: "error"; message: string }

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function triggerSync(
  _key: string,
  {
    arg,
  }: {
    arg: {
      onProgress?: (progress: SyncProgress) => void
    }
  },
): Promise<SyncProgress> {
  const response = await fetch("/api/sync", { method: "POST" })

  if (!response.ok) {
    throw new Error(`Sync request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("Response body is not readable")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let lastProgress: SyncProgress = { type: "error", message: "No response" }

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse complete NDJSON lines
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.trim() === "") continue

      try {
        const progress = JSON.parse(line) as SyncProgress
        lastProgress = progress
        arg.onProgress?.(progress)
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const progress = JSON.parse(buffer) as SyncProgress
      lastProgress = progress
      arg.onProgress?.(progress)
    } catch {
      // Skip malformed line
    }
  }

  // Revalidate last-synced cache after sync completes
  await mutate("/api/sync/status")

  if (lastProgress.type === "error") {
    throw new Error(lastProgress.message)
  }

  return lastProgress
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSync() {
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  const { trigger, isMutating, error } = useSWRMutation(
    "/api/sync",
    triggerSync,
  )

  const startSync = useCallback(async () => {
    setProgress(null)
    return trigger({
      onProgress: setProgress,
    })
  }, [trigger])

  return {
    trigger: startSync,
    isSyncing: isMutating,
    progress,
    error: error as Error | undefined,
  }
}
