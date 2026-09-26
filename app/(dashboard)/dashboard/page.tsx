import type { Metadata } from "next"

import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata: Metadata = {
  title: "Обзор",
}

export default function OverviewPage() {
  return (
    <>
      <Topbar title="Обзор" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <OverviewDashboard />
      </main>
    </>
  )
}

