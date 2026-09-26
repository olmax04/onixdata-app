"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MessageCircleIcon,
  PlusIcon,
  RadioIcon,
  SendIcon,
  SettingsIcon,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/auth/auth-provider"
import { useEmulators } from "@/lib/emulators-context"
import { formatPhoneNumber, getAuthDetail, getEmulatorStatus } from "@/lib/emulator-status"
import { currentUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export const navItems = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboardIcon },
  { href: "/dashboard/instances", label: "Инстансы", icon: FolderKanbanIcon },
  { href: "/dashboard/datasets", label: "База пользователей", icon: UsersIcon },
  { href: "/dashboard/sources", label: "Источники", icon: DatabaseIcon },
  { href: "/dashboard/settings", label: "Настройки", icon: SettingsIcon },
]

function SidebarUserMenu() {
  const { profile, signOut } = useAuth()
  const displayUser = profile ?? currentUser

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success("Вы вышли из аккаунта")
    } catch {
      toast("Вы вышли из аккаунта")
    }
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
              {displayUser.initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-sidebar-foreground">
              {displayUser.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {displayUser.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{displayUser.name}</span>
          <span className="block text-xs text-muted-foreground">
            {displayUser.role || "Пользователь"}
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
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOutIcon />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarNavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentInstance = searchParams?.get("instance") || searchParams?.get("deviceId") || ""

  const { emulators, loading } = useEmulators()

  // Секция "Инстансы" развернута по умолчанию
  const [instancesSectionOpen, setInstancesSectionOpen] = React.useState(true)

  // Список развернутых аккордеонов инстансов
  const [expandedInstances, setExpandedInstances] = React.useState<Set<string>>(new Set())

  // Автоматически разворачиваем активный инстанс из URL или первый по умолчанию
  React.useEffect(() => {
    if (emulators.length > 0) {
      setExpandedInstances((prev) => {
        const next = new Set(prev)
        if (currentInstance) {
          const activeEmu = emulators.find(
            (e) => e.name === currentInstance || e.id === currentInstance
          )
          if (activeEmu) next.add(activeEmu.id)
        } else if (next.size === 0) {
          const defaultEmu = emulators.find((e) => e.state === "running") || emulators[0]
          if (defaultEmu) next.add(defaultEmu.id)
        }
        return next
      })
    }
  }, [emulators, currentInstance])

  const toggleInstance = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedInstances((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isOverviewActive = pathname === "/dashboard"
  const isInstancesPageActive =
    (pathname === "/dashboard/instances" ||
      pathname === "/dashboard/emulators" ||
      pathname.startsWith("/dashboard/emulators/")) &&
    !currentInstance
  const isDatasetsActive = pathname === "/dashboard/datasets"
  const isSourcesActive = pathname === "/dashboard/sources"
  const isSettingsActive =
    pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")

  const runningCount = emulators.filter((e) => e.state === "running").length

  return (
    <nav aria-label="Основная навигация" className="space-y-1.5 pb-4">
      {/* 1. Обзор */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        aria-current={isOverviewActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
          isOverviewActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        <LayoutDashboardIcon
          className={cn("size-4 shrink-0", isOverviewActive && "text-sidebar-primary")}
          aria-hidden="true"
        />
        <span>Обзор</span>
      </Link>

      {/* 2. Секция: Инстансы (выпадающий список) */}
      <div className="space-y-1 pt-1">
        {/* Главная кнопка секции Инстансы */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors group",
            isInstancesPageActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <Link
            href="/dashboard/instances"
            onClick={onNavigate}
            className="flex flex-1 items-center gap-3 min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          >
            <FolderKanbanIcon
              className={cn("size-4 shrink-0", isInstancesPageActive && "text-sidebar-primary")}
              aria-hidden="true"
            />
            <span className="truncate">Инстансы</span>
            {emulators.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sidebar-accent border border-sidebar-border text-muted-foreground shrink-0">
                {runningCount}/{emulators.length}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setInstancesSectionOpen((v) => !v)}
            className="p-1 -mr-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors shrink-0"
            aria-label={instancesSectionOpen ? "Свернуть список инстансов" : "Развернуть список инстансов"}
          >
            {instancesSectionOpen ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </button>
        </div>

        {/* Раскрывающийся список инстансов */}
        {instancesSectionOpen && (
          <div className="pl-3 space-y-1 pt-0.5">
            {loading && emulators.length === 0 ? (
              <div className="space-y-2 py-1 px-3">
                <Skeleton className="h-5 w-28 bg-sidebar-accent" />
                <Skeleton className="h-4 w-20 bg-sidebar-accent/60 ml-3" />
                <Skeleton className="h-4 w-20 bg-sidebar-accent/60 ml-3" />
              </div>
            ) : emulators.length === 0 ? (
              <Link
                href="/dashboard/instances"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40 transition-colors"
              >
                <PlusIcon className="size-3.5" />
                <span>Создать инстанс</span>
              </Link>
            ) : (
              emulators.map((emu) => {
                const isExpanded = expandedInstances.has(emu.id)
                const status = getEmulatorStatus(emu)
                const accountPhone = formatPhoneNumber(emu.viberAccount?.phoneNumber)
                const accountTitle = getAuthDetail(emu.viberAccount).text

                const groupsHref = `/dashboard/viber?instance=${encodeURIComponent(emu.name)}`
                const streamHref = `/dashboard/stream?instance=${encodeURIComponent(emu.name)}`
                const broadcastHref = `/dashboard/broadcast?instance=${encodeURIComponent(emu.name)}`

                const isGroupsActive =
                  pathname === "/dashboard/viber" && currentInstance === emu.name
                const isStreamActive =
                  pathname === "/dashboard/stream" && currentInstance === emu.name
                const isBroadcastActive =
                  pathname === "/dashboard/broadcast" && currentInstance === emu.name
                const isAnySubActive = isGroupsActive || isStreamActive || isBroadcastActive

                let dotColorClass = ""
                switch (status.tone) {
                  case "success":
                    dotColorClass = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                    break
                  case "info":
                    dotColorClass = "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]"
                    break
                  case "warning":
                    dotColorClass = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]"
                    break
                  case "danger":
                    dotColorClass = "bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                    break
                  case "neutral":
                  default:
                    dotColorClass = "bg-muted-foreground/40"
                    break
                }

                return (
                  <div key={emu.id} className="space-y-0.5">
                    {/* Строка конкретного инстанса */}
                    <div
                      onClick={(e) => toggleInstance(emu.id, e)}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none",
                        isAnySubActive
                          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "size-2 rounded-full shrink-0 transition-all",
                            dotColorClass,
                            status.busy && "animate-pulse"
                          )}
                          title={`${status.label}: ${status.description}`}
                        />
                        <SmartphoneIcon className="size-3.5 shrink-0 text-primary/80" />
                        <div className="min-w-0">
                          <div className="truncate">{emu.name}</div>
                          {accountPhone && (
                            <div
                              className="truncate text-[10px] font-normal text-muted-foreground/80"
                              title={accountTitle}
                            >
                              {accountPhone}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-muted-foreground/70">
                        {isExpanded ? (
                          <ChevronDownIcon className="size-3.5" />
                        ) : (
                          <ChevronRightIcon className="size-3.5" />
                        )}
                      </div>
                    </div>

                    {/* Дочерние подразделы инстанса: Группы, Мониторинг, Рассылка */}
                    {isExpanded && (
                      <div className="ml-3 pl-2.5 border-l border-sidebar-border/60 space-y-0.5 py-0.5">
                        <Link
                          href={groupsHref}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            isGroupsActive
                              ? "bg-sidebar-accent text-sidebar-primary font-medium"
                              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <MessageCircleIcon
                            className={cn("size-3.5 shrink-0", isGroupsActive && "text-sidebar-primary")}
                          />
                          <span>Группы</span>
                        </Link>

                        <Link
                          href={streamHref}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            isStreamActive
                              ? "bg-sidebar-accent text-sidebar-primary font-medium"
                              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <RadioIcon
                            className={cn("size-3.5 shrink-0", isStreamActive && "text-sidebar-primary")}
                          />
                          <span>Мониторинг</span>
                        </Link>

                        <Link
                          href={broadcastHref}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            isBroadcastActive
                              ? "bg-sidebar-accent text-sidebar-primary font-medium"
                              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <SendIcon
                            className={cn("size-3.5 shrink-0", isBroadcastActive && "text-sidebar-primary")}
                          />
                          <span>Рассылка</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 3. База данных пользователей (Supabase) */}
      <div className="pt-1">
        <Link
          href="/dashboard/datasets"
          onClick={onNavigate}
          aria-current={isDatasetsActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
            isDatasetsActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <UsersIcon
            className={cn("size-4 shrink-0", isDatasetsActive && "text-sidebar-primary")}
            aria-hidden="true"
          />
          <span>База пользователей</span>
        </Link>
      </div>

      {/* 4. Источники и группы (Supabase) */}
      <div className="pt-0.5">
        <Link
          href="/dashboard/sources"
          onClick={onNavigate}
          aria-current={isSourcesActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
            isSourcesActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <DatabaseIcon
            className={cn("size-4 shrink-0", isSourcesActive && "text-sidebar-primary")}
            aria-hidden="true"
          />
          <span>Источники</span>
        </Link>
      </div>

      {/* 5. Настройки */}
      <div className="pt-1">
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          aria-current={isSettingsActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
            isSettingsActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <SettingsIcon
            className={cn("size-4 shrink-0", isSettingsActive && "text-sidebar-primary")}
            aria-hidden="true"
          />
          <span>Настройки</span>
        </Link>
      </div>
    </nav>
  )
}

function SidebarNavSkeleton() {
  return (
    <div className="space-y-3 px-3 py-2">
      <Skeleton className="h-8 w-full bg-sidebar-accent" />
      <Skeleton className="h-8 w-full bg-sidebar-accent" />
      <div className="pl-4 space-y-2">
        <Skeleton className="h-6 w-3/4 bg-sidebar-accent/60" />
        <Skeleton className="h-6 w-1/2 bg-sidebar-accent/40" />
      </div>
      <Skeleton className="h-8 w-full bg-sidebar-accent" />
    </div>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
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
        <React.Suspense fallback={<SidebarNavSkeleton />}>
          <SidebarNavItems onNavigate={onNavigate} />
        </React.Suspense>
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

