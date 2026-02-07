import { getTransactionsPage } from "@/lib/transactions"
import { TransactionsTable } from "@/components/transactions/transactions-table"

export default async function TransactionsPage() {
  const initialData = await getTransactionsPage()
  return <TransactionsTable initialData={initialData} />
}
