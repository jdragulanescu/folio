import { runSync } from "@/lib/sync"

export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const progress of runSync()) {
          controller.enqueue(encoder.encode(JSON.stringify(progress) + "\n"))
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown sync error"
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", message } as const) + "\n",
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  })
}
