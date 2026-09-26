import type { Metadata } from "next"

import { Topbar } from "@/components/dashboard/topbar"
import { EmulatorsPanel } from "@/components/dashboard/emulators-panel"

export const metadata: Metadata = {
  title: "Инстансы Viber",
}

export default function InstancesPage() {
  return (
    <>
      <Topbar title="Инстансы Viber" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Рабочие инстансы Viber</h2>
          <p className="text-sm text-muted-foreground">
            Управление и настройка изолированных инстансов Viber: параметры окружения,
            подключение ADB, авторизация и интерактивный экран.
          </p>
        </div>

        <EmulatorsPanel />
      </main>
    </>
  )
}
