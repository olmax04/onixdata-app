"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircle2Icon,
  CheckIcon,
  InfoIcon,
  RadioIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"

export type NotificationType = "info" | "success" | "warning" | "error"

export interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  timestamp: number
  read: boolean
  type: NotificationType
  link?: string
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Мониторинг Viber",
    description: "Обнаружены новые входящие сообщения с телефонными номерами.",
    time: "2 мин назад",
    timestamp: Date.now() - 2 * 60 * 1000,
    read: false,
    type: "info",
    link: "/dashboard/stream",
  },
  {
    id: "notif-2",
    title: "Сбор участников",
    description: "База данных успешно синхронизирована, дедупликация завершена.",
    time: "15 мин назад",
    timestamp: Date.now() - 15 * 60 * 1000,
    read: false,
    type: "success",
    link: "/dashboard/viber",
  },
  {
    id: "notif-3",
    title: "Инстанс worker",
    description: "Эмулятор подключен и готов к выполнению сценариев автоматизации.",
    time: "1 час назад",
    timestamp: Date.now() - 60 * 60 * 1000,
    read: false,
    type: "success",
    link: "/dashboard/instances",
  },
  {
    id: "notif-4",
    title: "Дешифровка базы",
    description: "Завершена дешифровка номеров участников сообществ.",
    time: "3 часа назад",
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    read: true,
    type: "info",
    link: "/dashboard/viber",
  },
  {
    id: "notif-5",
    title: "Система Viber Bot",
    description: "Сервер API и драйвер AdbUi работают в штатном режиме.",
    time: "Вчера",
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    read: true,
    type: "info",
  },
]

const STORAGE_KEY = "viber_bot_notifications"

function getIcon(type: NotificationType) {
  switch (type) {
    case "success":
      return <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
    case "warning":
      return <RadioIcon className="size-4 text-amber-500 shrink-0 mt-0.5" />
    case "error":
      return <AlertCircleIcon className="size-4 text-rose-500 shrink-0 mt-0.5" />
    default:
      return <InfoIcon className="size-4 text-primary shrink-0 mt-0.5" />
  }
}

export function NotificationsMenu() {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [isOpen, setIsOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<"all" | "unread">("all")

  // Инициализация из localStorage или начального списка
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setNotifications(JSON.parse(stored))
      } else {
        setNotifications(INITIAL_NOTIFICATIONS)
      }
    } catch {
      setNotifications(INITIAL_NOTIFICATIONS)
    }
  }, [])

  // Сохранение в localStorage
  const saveNotifications = React.useCallback((items: NotificationItem[]) => {
    setNotifications(items)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [])

  // Периодическая проверка статуса задач для актуализации уведомлений
  React.useEffect(() => {
    let mounted = true

    async function checkTasks() {
      try {
        const res = await fetch("/api/viber/status", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return

        if (data.state === "ERROR" && data.error) {
          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === `error-${data.error}`)
            if (exists) return prev
            const newItem: NotificationItem = {
              id: `error-${data.error}`,
              title: "Ошибка службы сбора",
              description: data.error,
              time: "Только что",
              timestamp: Date.now(),
              read: false,
              type: "error",
              link: "/dashboard/viber",
            }
            const updated = [newItem, ...prev]
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            } catch {}
            return updated
          })
        }
      } catch {
        // ignore network glitches
      }
    }

    void checkTasks()
    const interval = setInterval(checkTasks, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }))
    saveNotifications(updated)
    toast.success("Все уведомления прочитаны")
  }

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    saveNotifications(updated)
  }

  const clearAll = () => {
    saveNotifications([])
    toast.info("Список уведомлений очищен")
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read
    return true
  })

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Уведомления: ${unreadCount} непрочитанных`}
        >
          <BellIcon className="size-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-primary text-primary-foreground animate-in zoom-in-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-lg border bg-popover text-popover-foreground"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Уведомления</span>
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                {unreadCount} новых
              </Badge>
            ) : (
              <Badge variant="outline" className="px-1.5 py-0 text-xs text-muted-foreground font-normal">
                0
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
                title="Отметить все как прочитанные"
              >
                <CheckIcon className="size-3.5 mr-1 text-primary" />
                Прочитать все
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Очистить всё"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            className={cn(
              "px-2 py-0.5 rounded font-medium transition-colors",
              filter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            )}
            onClick={() => setFilter("all")}
          >
            Все ({notifications.length})
          </button>
          <button
            type="button"
            className={cn(
              "px-2 py-0.5 rounded font-medium transition-colors",
              filter === "unread"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            )}
            onClick={() => setFilter("unread")}
          >
            Непрочитанные ({unreadCount})
          </button>
        </div>

        <ScrollArea className="max-h-80 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {filter === "unread"
                ? "Все уведомления прочитаны 🎉"
                : "Нет уведомлений"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((item) => {
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 text-xs transition-colors hover:bg-muted/50 cursor-pointer",
                      !item.read && "bg-muted/20"
                    )}
                    onClick={() => {
                      markAsRead(item.id)
                      if (item.link) {
                        setIsOpen(false)
                      }
                    }}
                  >
                    {getIcon(item.type)}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-medium", !item.read && "text-foreground font-semibold")}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    {!item.read && (
                      <span
                        className="size-2 rounded-full bg-primary shrink-0 mt-1"
                        aria-label="Не прочитано"
                      />
                    )}
                  </div>
                )

                return (
                  <div key={item.id}>
                    {item.link ? (
                      <Link href={item.link} className="block">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 text-center bg-muted/20">
          <Link
            href="/dashboard/settings"
            onClick={() => setIsOpen(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Настройки уведомлений
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
