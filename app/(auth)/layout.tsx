import Link from "next/link"

import { authEnter } from "@/components/auth/auth-motion"
import { AuthShowcase } from "@/components/auth/auth-showcase"
import { BrandLogo } from "@/components/brand-logo"
import { cn } from "@/lib/utils"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3">
      <div className="onix-glow flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:min-h-0 lg:px-8">
        <div className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col gap-6">
          {/* header/footer лежат вне main: логотип и копирайт — не контент страницы. */}
          <header className="flex">
            <Link
              href="/login"
              className={cn(
                "rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                authEnter.logo
              )}
              aria-label="OnixData — на страницу входа"
            >
              <BrandLogo size={30} />
            </Link>
          </header>

          <main className="flex flex-1 flex-col justify-center py-2">
            {children}
          </main>

          <footer
            className={cn("text-xs text-muted-foreground", authEnter.copyright)}
          >
            © 2026 OnixData. Только публичные данные · демо-интерфейс
          </footer>
        </div>
      </div>

      <AuthShowcase />
    </div>
  )
}
