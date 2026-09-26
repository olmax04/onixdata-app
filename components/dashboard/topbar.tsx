"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOutIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-provider"
import { MobileSidebar } from "@/components/dashboard/app-sidebar"
import { HeaderSearch } from "@/components/dashboard/header-search"
import { NotificationsMenu } from "@/components/dashboard/notifications-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { currentUser } from "@/lib/mock-data"

export function Topbar({ title }: { title: string }) {
  const router = useRouter()
  const { profile, signOut: authSignOut } = useAuth()
  const displayUser = profile ?? currentUser

  const signOut = async () => {
    try {
      if (authSignOut) {
        await authSignOut()
      }
      toast.success("Вы вышли из аккаунта")
      router.push("/login")
    } catch {
      router.push("/login")
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <MobileSidebar />

        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Активный поиск */}
          <HeaderSearch />

          {/* Подключенные уведомления */}
          <NotificationsMenu />

          {/* Профиль пользователя */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Меню пользователя"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-medium">
                    {displayUser.initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">
                  {displayUser.name}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {displayUser.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <UserIcon className="size-4 mr-2" />
                  Профиль
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOutIcon className="size-4 mr-2" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
