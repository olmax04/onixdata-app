import type { Metadata } from "next"

import { DatasetsTable } from "@/components/dashboard/datasets-table"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "База данных пользователей",
}

export default function DatasetsPage() {
  return (
    <>
      <Topbar title="База пользователей (Supabase)" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Пользователи Viber</h2>
          <p className="text-sm text-muted-foreground">
            Контакты, телефонные номера и онлайн-активность, синхронизированные в Supabase.
          </p>
        </div>

        <DatasetsTable />
      </main>
    </>
  )
}
