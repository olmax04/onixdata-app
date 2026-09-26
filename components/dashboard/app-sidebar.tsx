"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MessageCircleIcon,
  RadioIcon,
  SendIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { BrandLogo } from "@/components/brand-logo"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { currentUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export const navItems = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboardIcon },
  { href: "/dashboard/viber", label: "Группы Viber", icon: MessageCircleIcon },
  { href: "/dashboard/stream", label: "Мониторинг Viber", icon: RadioIcon },
  { href: "/dashboard/broadcast", label: "Рассылка Viber", icon: SendIcon },
  { href: "/dashboard/settings", label: "Настройки", icon: SettingsIcon },
]

function isItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarUserMenu() {
  const router = useRouter()

  const signOut = () => {
    toast("Вы вышли из аккаунта", {
      description: "Демо-режим: сессии не существует.",
    })
    router.push("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-sidebar-foreground">
              {currentUser.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {currentUser.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{currentUser.name}</span>
          <span className="block text-xs text-muted-foreground">
            {currentUser.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <UserIcon />
            Профиль
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
        >
          <BrandLogo />
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav aria-label="Основная навигация" className="space-y-1 pb-4">
          {navItems.map((item) => {
            const active = isItemActive(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active && "text-sidebar-primary"
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <SidebarUserMenu />
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarBody />
      </div>
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Открыть меню навигации"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 border-sidebar-border p-0">
        <SheetTitle className="sr-only">Навигация OnixData</SheetTitle>
        <SheetDescription className="sr-only">
          Разделы рабочей области
        </SheetDescription>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
