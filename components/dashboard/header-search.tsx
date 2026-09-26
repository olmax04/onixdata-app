"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FolderKanbanIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  RadioIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  SmartphoneIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEmulators } from "@/lib/emulators-context"
import { streamMessages } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const PAGES = [
  {
    title: "Инстансы Viber",
    href: "/dashboard/instances",
    category: "Разделы",
    icon: FolderKanbanIcon,
    description: "Управление эмуляторами, ADB и контейнерами",
  },
  {
    title: "Мониторинг Viber",
    href: "/dashboard/stream",
    category: "Разделы",
    icon: RadioIcon,
    description: "Онлайн-поток входящих сообщений групп",
  },
  {
    title: "Сбор участников Viber",
    href: "/dashboard/viber",
    category: "Разделы",
    icon: MessageCircleIcon,
    description: "Сбор контактов, дешифровка и дедупликация",
  },
  {
    title: "Рассылка сообщений",
    href: "/dashboard/broadcast",
    category: "Разделы",
    icon: SendIcon,
    description: "Кампании и отправка сообщений по аудитории",
  },
  {
    title: "Обзор",
    href: "/dashboard",
    category: "Разделы",
    icon: LayoutDashboardIcon,
    description: "Сводные метрики, ключевые слова и статистика",
  },
  {
    title: "Настройки",
    href: "/dashboard/settings",
    category: "Разделы",
    icon: SettingsIcon,
    description: "Профиль, API-ключи и уведомления",
  },
]

export function HeaderSearch() {
  const router = useRouter()
  const { emulators } = useEmulators()

  const [query, setQuery] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Глобальный хоткей: Ctrl+K / Cmd+K или / для фокуса на поиске
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName))
      ) {
        event.preventDefault()
        if (window.innerWidth < 768) {
          setMobileOpen(true)
        } else {
          inputRef.current?.focus()
          setIsOpen(true)
        }
      } else if (event.key === "Escape") {
        setIsOpen(false)
        setMobileOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Клик вне компонента закрывает выпадающий список результатов
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const normalized = query.trim().toLowerCase()

  // Поиск по страницам
  const matchedPages = React.useMemo(() => {
    if (!normalized) return []
    return PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(normalized) ||
        p.description.toLowerCase().includes(normalized)
    )
  }, [normalized])

  // Поиск по инстансам
  const matchedEmulators = React.useMemo(() => {
    if (!normalized) return []
    return emulators.filter(
      (e) =>
        e.name.toLowerCase().includes(normalized) ||
        e.containerName.toLowerCase().includes(normalized) ||
        (e.adbSerial && e.adbSerial.toLowerCase().includes(normalized))
    )
  }, [emulators, normalized])

  // Поиск по сообщениям (автор, текст, источник)
  const matchedMessages = React.useMemo(() => {
    if (!normalized) return []
    return streamMessages
      .filter(
        (m) =>
          m.text.toLowerCase().includes(normalized) ||
          m.author.toLowerCase().includes(normalized) ||
          m.source.toLowerCase().includes(normalized)
      )
      .slice(0, 5)
  }, [normalized])

  const hasResults =
    matchedPages.length > 0 || matchedEmulators.length > 0 || matchedMessages.length > 0

  const handleSelectMessage = (text: string) => {
    setIsOpen(false)
    setMobileOpen(false)
    router.push(`/dashboard/stream?q=${encodeURIComponent(text)}`)
  }

  const handleSelectEmulator = (id: string) => {
    setIsOpen(false)
    setMobileOpen(false)
    router.push(`/dashboard/instances`)
  }

  const handleSelectPage = (href: string) => {
    setIsOpen(false)
    setMobileOpen(false)
    router.push(href)
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    setIsOpen(false)
    setMobileOpen(false)
    router.push(`/dashboard/stream?q=${encodeURIComponent(query.trim())}`)
  }

  const renderDropdownContent = () => {
    if (!normalized) {
      return (
        <div className="p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1.5">Быстрый переход:</div>
          <div className="grid grid-cols-2 gap-1">
            {PAGES.slice(0, 4).map((page) => {
              const Icon = page.icon
              return (
                <button
                  key={page.href}
                  type="button"
                  onClick={() => handleSelectPage(page.href)}
                  className="flex items-center gap-2 p-1.5 rounded text-left hover:bg-muted/70 transition-colors"
                >
                  <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{page.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (!hasResults) {
      return (
        <div className="py-6 px-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Ничего не найдено по запросу «{query}»
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => handleSearchSubmit()}
          >
            Искать в Мониторинге сообщений
          </Button>
        </div>
      )
    }

    return (
      <ScrollArea className="max-h-80 overflow-y-auto">
        <div className="p-2 space-y-3">
          {/* Сообщения */}
          {matchedMessages.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Сообщения ({matchedMessages.length})
              </div>
              <div className="space-y-0.5">
                {matchedMessages.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => handleSelectMessage(msg.text)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted/70 transition-colors group flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium group-hover:text-primary transition-colors">
                        {msg.author}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {msg.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {msg.text}
                    </p>
                    <span className="text-[10px] text-primary/70">
                      {msg.source}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Инстансы */}
          {matchedEmulators.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Инстансы Viber ({matchedEmulators.length})
              </div>
              <div className="space-y-0.5">
                {matchedEmulators.map((em) => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => handleSelectEmulator(em.id)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted/70 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <SmartphoneIcon className="size-3.5 text-primary shrink-0" />
                      <span className="font-medium">{em.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {em.adbSerial || em.containerName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {em.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Разделы */}
          {matchedPages.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Разделы ({matchedPages.length})
              </div>
              <div className="space-y-0.5">
                {matchedPages.map((page) => {
                  const Icon = page.icon
                  return (
                    <button
                      key={page.href}
                      type="button"
                      onClick={() => handleSelectPage(page.href)}
                      className="w-full text-left p-2 rounded-md hover:bg-muted/70 transition-colors flex items-center gap-2.5 text-xs"
                    >
                      <Icon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{page.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {page.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    )
  }

  return (
    <>
      {/* Десктопный поиск */}
      <div ref={containerRef} className="relative hidden md:block">
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Поиск по сообщениям, инстансам…"
            aria-label="Поиск по сообщениям и разделам"
            className="w-64 pl-9 pr-16 lg:w-80 h-9 text-xs transition-all focus:w-72 lg:focus:w-96"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus()
                }}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                aria-label="Очистить поиск"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            )}
          </div>
        </form>

        {isOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-full min-w-[320px] rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
            {renderDropdownContent()}
            {normalized && (
              <div className="border-t bg-muted/40 p-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Нажмите <strong className="font-semibold text-foreground">Enter</strong> для поиска</span>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="text-primary font-medium hover:underline"
                >
                  Все сообщения &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Мобильная кнопка поиска */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Поиск"
      >
        <SearchIcon className="size-5" />
      </Button>

      {/* Мобильный диалог поиска */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="sm:max-w-md top-20 translate-y-0 p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-semibold">Поиск</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSearchSubmit} className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по сообщениям, разделам…"
              className="pl-9 pr-9 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </form>

          <div className="mt-2 rounded-md border bg-card">
            {renderDropdownContent()}
          </div>

          {normalized && (
            <Button
              className="w-full mt-2"
              onClick={() => handleSearchSubmit()}
            >
              Искать сообщения в Мониторинге &rarr;
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
