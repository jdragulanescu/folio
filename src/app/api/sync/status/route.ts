import { listRecords } from "@/lib/nocodb"
import type { SettingRecord } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await listRecords<SettingRecord>("settings", {
    where: "(key,eq,last_synced)",
  })

  const lastSynced =
    result.list.length > 0 ? result.list[0].value : null

  return Response.json({ lastSynced })
}
