import type { Metadata } from "next"

import { ViberMonitorPanel } from "@/components/dashboard/viber-monitor-panel"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Мониторинг Viber",
}

interface StreamPageProps {
  searchParams?: {
    instance?: string
    deviceId?: string
    q?: string
    search?: string
  }
}

export default function StreamPage({ searchParams }: StreamPageProps) {
  const deviceId = searchParams?.instance || searchParams?.deviceId
  const initialQuery = searchParams?.q || searchParams?.search || ""
  const title = deviceId ? `Мониторинг: ${deviceId}` : "Мониторинг Viber"

  return (
    <>
      <Topbar title={title} />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {deviceId ? `Мониторинг инстанса: ${deviceId}` : "Онлайн-мониторинг сообщений"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {deviceId
              ? `Отслеживание входящих сообщений в реальном времени для инстанса ${deviceId}.`
              : "Отслеживайте входящие сообщения в группах и сообществах Viber в реальном времени."}
          </p>
        </div>

        <ViberMonitorPanel deviceId={deviceId} initialQuery={initialQuery} />
      </main>
    </>
  )
}
