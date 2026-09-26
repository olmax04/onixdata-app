import type { Metadata } from "next"

import { Topbar } from "@/components/dashboard/topbar"
import { ViberParserPanel } from "@/components/dashboard/viber-parser-panel"

export const metadata: Metadata = {
  title: "Группы Viber",
}

export default function ViberParserPage() {
  return (
    <>
      <Topbar title="Группы Viber" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Запускайте сессию, выбирайте группу и просматривайте декодированные
          номера телефонов.
        </p>

        <ViberParserPanel />
      </main>
    </>
  )
}
