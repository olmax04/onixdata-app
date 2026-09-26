"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellIcon, LogOutIcon, PlusIcon, SearchIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { MobileSidebar } from "@/components/dashboard/app-sidebar"
import { NewParseDialog } from "@/components/dashboard/new-parse-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { currentUser, notificationsCount } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function Topbar({ title }: { title: string }) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    toast("Поиск", {
      description: "Демо-режим: индекс не подключён.",
    })
  }

  const signOut = () => {
    toast("Вы вышли из аккаунта", {
      description: "Демо-режим: сессии не существует.",
    })
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <MobileSidebar />

        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <form
            role="search"
            onSubmit={search}
            className="relative hidden md:block"
          >
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Поиск по сообщениям…"
              aria-label="Поиск по сообщениям"
              className="w-56 pl-9 lg:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <NewParseDialog
            trigger={
              <Button size="sm" className="hidden sm:inline-flex">
                <PlusIcon />
                Новая задача
              </Button>
            }
          />

          <NewParseDialog
            trigger={
              <Button size="icon" className="sm:hidden" aria-label="Новая задача">
                <PlusIcon />
              </Button>
            }
          />

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Уведомления: ${notificationsCount}`}
            onClick={() =>
              toast("Уведомления", {
                description: "Демо-режим: центр уведомлений не подключён.",
              })
            }
          >
            <BellIcon />
            {/* span, а не Badge: Badge — это div, внутри button он недопустим. */}
            <span
              className={cn(
                badgeVariants(),
                "absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
              )}
            >
              {notificationsCount}
            </span>
          </Button>

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
                    {currentUser.initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">
                  {currentUser.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {currentUser.email}
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
        </div>
      </div>
    </header>
  )
}
