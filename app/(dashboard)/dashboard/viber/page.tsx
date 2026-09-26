import type { Metadata } from "next"

import { Topbar } from "@/components/dashboard/topbar"
import { ViberParserPanel } from "@/components/dashboard/viber-parser-panel"

export const metadata: Metadata = {
  title: "Группы Viber",
}

interface ViberParserPageProps {
  searchParams?: {
    instance?: string
    deviceId?: string
  }
}

export default function ViberParserPage({ searchParams }: ViberParserPageProps) {
  const deviceId = searchParams?.instance || searchParams?.deviceId
  const title = deviceId ? `Группы: ${deviceId}` : "Группы Viber"

  return (
    <>
      <Topbar title={title} />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {deviceId ? `Группы инстанса: ${deviceId}` : "Группы Viber"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {deviceId
              ? `Управление и сбор участников для инстанса ${deviceId}.`
              : "Запускайте сессию, выбирайте группу и просматривайте декодированные номера телефонов."}
          </p>
        </div>

        <ViberParserPanel deviceId={deviceId} />
      </main>
    </>
  )
}
