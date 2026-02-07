"use client"

import { useEffect, useRef } from "react"

import { Skeleton } from "@/components/ui/skeleton"

interface LoadMoreTriggerProps {
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
}

export function LoadMoreTrigger({
  onLoadMore,
  hasMore,
  isLoading,
}: LoadMoreTriggerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [onLoadMore, hasMore, isLoading])

  if (!hasMore) return null

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isLoading && <Skeleton className="h-8 w-32" />}
    </div>
  )
}
