import type { Metadata } from "next"

import { SourcesTable } from "@/components/dashboard/sources-table"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Источники данных и группы",
}

export default function SourcesPage() {
  return (
    <>
      <Topbar title="Источники и группы (Supabase)" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Группы и синхронизация</h2>
          <p className="text-sm text-muted-foreground">
            Управление синхронизацией сообществ Viber и участников с базой данных Supabase.
          </p>
        </div>

        <SourcesTable />
      </main>
    </>
  )
}
