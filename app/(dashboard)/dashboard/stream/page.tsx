import type { Metadata } from "next"

import { ViberMonitorPanel } from "@/components/dashboard/viber-monitor-panel"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Мониторинг Viber",
}

export default function StreamPage() {
  return (
    <>
      <Topbar title="Мониторинг Viber" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <ViberMonitorPanel />
      </main>
    </>
  )
}
