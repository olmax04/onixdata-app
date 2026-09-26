import type { Metadata } from "next"

import { ViberBroadcastPanel } from "@/components/dashboard/viber-broadcast-panel"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Рассылка Viber",
}

interface BroadcastPageProps {
  searchParams?: {
    instance?: string
    deviceId?: string
  }
}

export default function BroadcastPage({ searchParams }: BroadcastPageProps) {
  const deviceId = searchParams?.instance || searchParams?.deviceId
  const title = deviceId ? `Рассылка: ${deviceId}` : "Рассылка Viber"

  return (
    <>
      <Topbar title={title} />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {deviceId ? `Рассылка инстанса: ${deviceId}` : "Рассылка Viber"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {deviceId
              ? `Массовая отправка сообщений по группам для инстанса ${deviceId}.`
              : "Отправляйте сообщения в выбранные группы по расписанию, чередуя формулировки и сохраняя историю последней отправки."}
          </p>
        </div>

        <ViberBroadcastPanel deviceId={deviceId} />
      </main>
    </>
  )
}
