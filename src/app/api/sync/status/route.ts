import logger from "@/lib/logger"
import { listRecords } from "@/lib/nocodb"
import type { SettingRecord } from "@/lib/types"

const log = logger.child({ route: "GET /api/sync/status" })

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await listRecords<SettingRecord>("settings", {
    where: "(key,eq,last_synced)",
  })

  const lastSynced =
    result.list.length > 0 ? result.list[0].value : null

  log.debug({ lastSynced }, "sync status checked")

  return Response.json({ lastSynced })
}
