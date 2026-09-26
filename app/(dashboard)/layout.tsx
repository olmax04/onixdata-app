import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { EmulatorsProvider } from "@/lib/emulators-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EmulatorsProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </EmulatorsProvider>
  )
}
