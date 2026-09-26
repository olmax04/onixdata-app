import type { Metadata } from "next"

import { ViberBroadcastPanel } from "@/components/dashboard/viber-broadcast-panel"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Рассылка Viber",
}

export default function BroadcastPage() {
  return (
    <>
      <Topbar title="Рассылка Viber" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Отправляйте сообщения в выбранные группы по расписанию, чередуя
          формулировки и сохраняя историю последней отправки.
        </p>

        <ViberBroadcastPanel />
      </main>
    </>
  )
}
