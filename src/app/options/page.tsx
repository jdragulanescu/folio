import { getOptionsPageData } from "@/lib/options"
import { OptionsDashboard } from "@/components/options/options-dashboard"

export default async function OptionsPage() {
  const data = await getOptionsPageData()
  return <OptionsDashboard data={data} />
}
