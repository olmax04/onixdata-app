import type { Metadata } from "next"

import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Настройки",
}

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Настройки" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Настройки профиля</h2>
          <p className="text-sm text-muted-foreground">
            Управление данными профиля и безопасность учетной записи.
          </p>
        </div>

        <SettingsTabs />
      </main>
    </>
  )
}
