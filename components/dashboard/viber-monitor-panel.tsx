"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  PhoneIcon,
  PlayIcon,
  RadioIcon,
  SearchIcon,
  SquareIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  MessageMonitorStatusDto,
  MonitoredGroupDto,
  MonitoredMessageDto,
  ViberGroup,
  ViberGroupsResponse,
} from "@/lib/viber-parser/types"
import {
  messageHasMedia,
  messagePreviewText,
} from "@/lib/viber-parser/message-display"
import { usePollLoop } from "@/lib/viber-parser/use-poll-loop"

const MAX_ROWS = 200
const PAGE_SIZE = 20
const STATUS_POLL_MS = 5000

function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const starred = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (starred?.[1]) return decodeURIComponent(starred[1])
  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]
  const plain = header.match(/filename=([^;]+)/i)
  return plain?.[1]?.trim() || fallback
}

async function viberJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/viber/${path}`, { cache: "no-store", ...init })
  const text = await res.text()
  let payload: { error?: string; message?: string } | T | null = null
  if (text) {
    try {
      payload = JSON.parse(text) as T
    } catch {
      payload = null
    }
  }
  if (!res.ok) {
    const err = payload as { error?: string; message?: string } | null
    throw new Error(err?.message || err?.error || `Ошибка запроса (${res.status})`)
  }
  return payload as T
}

type GroupRow = {
  conversationId: number
  name: string
  memberCount?: number
  enabled: boolean
}

function buildGroupRows(
  groups: ViberGroup[],
  monitored: MonitoredGroupDto[]
): GroupRow[] {
  const monitoredById = new Map(monitored.map((item) => [item.conversationId, item]))
  const rows: GroupRow[] = groups
    .filter((group) => group.conversationType !== 0)
    .map((group) => ({
      conversationId: group.conversationId,
      name: group.name || `Группа ${group.conversationId}`,
      memberCount: group.memberCount,
      enabled: monitoredById.get(group.conversationId)?.enabled ?? false,
    }))

  const seen = new Set(rows.map((row) => row.conversationId))
  for (const item of monitored) {
    if (seen.has(item.conversationId)) continue
    rows.push({
      conversationId: item.conversationId,
      name: item.name || `Группа ${item.conversationId}`,
      enabled: item.enabled,
    })
  }

  return rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, "ru"))
}

export function ViberMonitorPanel() {
  const [status, setStatus] = React.useState<MessageMonitorStatusDto | null>(null)
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [messages, setMessages] = React.useState<MonitoredMessageDto[]>([])
  const [isLiveConnected, setIsLiveConnected] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [togglingId, setTogglingId] = React.useState<number | null>(null)
  const [pollerBusy, setPollerBusy] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [groupQuery, setGroupQuery] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState("all")
  const [phoneFilter, setPhoneFilter] = React.useState("all")
  const [mediaFilter, setMediaFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(1)

  const statusSeqRef = React.useRef(0)
  const appliedStatusSeqRef = React.useRef(0)

  const refreshStatus = React.useCallback(async () => {
    const seq = ++statusSeqRef.current
    const next = await viberJson<MessageMonitorStatusDto>("messages/monitor/status")
    // Устаревший ответ не должен перетирать более свежий.
    if (seq < appliedStatusSeqRef.current) return next
    appliedStatusSeqRef.current = seq
    setStatus({
      ...next,
      groups: next.groups ?? [],
      liveWatch: next.liveWatch ?? false,
    })
    return next
  }, [])

  const mergeMessages = React.useCallback((incoming: MonitoredMessageDto[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return
    setMessages((prev) => {
      const byId = new Map<number, MonitoredMessageDto>()
      for (const item of [...incoming, ...prev]) {
        if (typeof item?.id !== "number") continue
        if (!byId.has(item.id)) byId.set(item.id, item)
      }
      return Array.from(byId.values())
        .sort((a, b) => b.id - a.id)
        .slice(0, MAX_ROWS)
    })
  }, [])

  /** Добор пропущенного за время обрыва SSE. */
  const catchUpMessages = React.useCallback(async () => {
    try {
      const list = await viberJson<MonitoredMessageDto[]>("messages/monitored?limit=200")
      mergeMessages(list)
    } catch {
      // ошибку добора показывать не нужно: следующий опрос статуса покажет связь
    }
  }, [mergeMessages])

  const loadInitial = React.useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, monitorStatus, list] = await Promise.allSettled([
        viberJson<ViberGroupsResponse>("groups"),
        viberJson<MessageMonitorStatusDto>("messages/monitor/status"),
        viberJson<MonitoredMessageDto[]>("messages/monitored?limit=200"),
      ])
      if (groupsRes.status === "fulfilled") {
        setGroups(groupsRes.value.groups)
      }
      if (monitorStatus.status === "fulfilled") {
        setStatus({
          ...monitorStatus.value,
          groups: monitorStatus.value.groups ?? [],
          liveWatch: monitorStatus.value.liveWatch ?? false,
        })
      }
      if (list.status === "fulfilled") {
        setMessages(Array.isArray(list.value) ? list.value : [])
      }
      if (monitorStatus.status === "rejected" && list.status === "rejected") {
        toast.error("Не удалось загрузить мониторинг Viber")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  // Ошибка опроса цикл ронять не должна: следующий тик покажет актуальный статус.
  const pollStatus = React.useCallback(async () => {
    try {
      await refreshStatus()
    } catch {
      // связь показывает сам статус, отдельный тост тут только мешал бы
    }
  }, [refreshStatus])

  // Следующий запрос стартует только после ответа предыдущего: медленный бэкенд
  // не должен копить параллельные опросы. Скрытая вкладка не опрашивается,
  // возврат к ней даёт немедленный запрос.
  usePollLoop({ enabled: true, intervalMs: STATUS_POLL_MS, onTick: pollStatus })

  React.useEffect(() => {
    const es = new EventSource("/api/viber/messages/events")
    let hadError = false

    es.onopen = () => {
      setIsLiveConnected(true)
      if (hadError) {
        hadError = false
        void catchUpMessages()
      }
    }
    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as MonitoredMessageDto
        if (typeof raw?.id !== "number") return
        setMessages((prev) => [raw, ...prev.filter((item) => item.id !== raw.id)].slice(0, MAX_ROWS))
      } catch {
        // ignore keepalive / unparseable frames
      }
    }
    // Служебные heartbeat-события игнорируем явно.
    const handlePing = () => undefined
    es.addEventListener("ping", handlePing)
    es.onerror = () => {
      hadError = true
      setIsLiveConnected(false)
    }

    return () => {
      es.removeEventListener("ping", handlePing)
      es.close()
    }
  }, [catchUpMessages])

  const groupRows = React.useMemo(
    () => buildGroupRows(groups, status?.groups ?? []),
    [groups, status?.groups]
  )
  const pollStale =
    status?.isRunning === true &&
    (!status.lastPollAt || Date.now() - new Date(status.lastPollAt).getTime() > 20_000)
  const enabledCount = groupRows.filter((row) => row.enabled).length
  const visibleGroups = groupRows.filter((row) => {
    if (!groupQuery.trim()) return true
    return row.name.toLowerCase().includes(groupQuery.trim().toLowerCase())
  })

  const visible = messages.filter((message) => {
    if (sourceFilter !== "all" && String(message.conversationId) !== sourceFilter) return false
    if (phoneFilter === "yes" && !message.attachedPhone) return false
    if (phoneFilter === "no" && message.attachedPhone) return false
    if (mediaFilter === "yes" && !messageHasMedia(message)) return false
    if (mediaFilter === "no" && messageHasMedia(message)) return false
    if (query.trim()) {
      const needle = query.trim().toLowerCase()
      const haystack = `${messagePreviewText(message)} ${message.senderName ?? ""} ${message.attachedPhone ?? ""} ${message.conversationName ?? ""}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE
  const pageRows = visible.slice(pageStart, pageStart + PAGE_SIZE)
  const pageEnd = pageStart + pageRows.length

  React.useEffect(() => {
    setPage(1)
  }, [sourceFilter, phoneFilter, mediaFilter, query])

  const handleToggleGroup = async (conversationId: number, enabled: boolean) => {
    setTogglingId(conversationId)
    try {
      const path = enabled
        ? `messages/monitor/groups/${conversationId}/enable`
        : `messages/monitor/groups/${conversationId}/disable`
      const next = await viberJson<MessageMonitorStatusDto>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: enabled ? JSON.stringify({}) : undefined,
      })
      setStatus({
        ...next,
        groups: next.groups ?? [],
        liveWatch: next.liveWatch ?? false,
      })
      toast.success(enabled ? "Группа включена в мониторинг" : "Группа снята с мониторинга")
    } catch (error) {
      toast.error("Не удалось изменить мониторинг группы", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleTogglePoller = async () => {
    setPollerBusy(true)
    try {
      if (status?.isRunning) {
        const next = await viberJson<MessageMonitorStatusDto>("messages/monitor/stop", { method: "POST" })
        setStatus({ ...next, groups: next.groups ?? [], liveWatch: next.liveWatch ?? false })
        toast.info("Опрос остановлен. Курсоры групп сохранены.")
      } else {
        const next = await viberJson<MessageMonitorStatusDto>("messages/monitor/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        setStatus({ ...next, groups: next.groups ?? [], liveWatch: next.liveWatch ?? false })
        toast.success("Мониторинг запущен")
      }
    } catch (error) {
      toast.error("Не удалось переключить опрос", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setPollerBusy(false)
    }
  }

  const handleExport = async (format: "json" | "jsonl" | "csv") => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format, limit: "0" })
      if (sourceFilter !== "all") params.set("conversationId", sourceFilter)
      if (phoneFilter === "yes") params.set("hasPhone", "true")
      if (phoneFilter === "no") params.set("hasPhone", "false")
      if (mediaFilter === "yes") params.set("hasMedia", "true")
      if (mediaFilter === "no") params.set("hasMedia", "false")

      const res = await fetch(`/api/viber/messages/monitored/export?${params}`, { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filenameFromDisposition(res.headers.get("Content-Disposition"), `viber-messages.${format}`)
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Файл экспорта сохранён")
    } catch (error) {
      toast.error("Не удалось экспортировать сообщения", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Группы на мониторинге</CardTitle>
          <CardDescription className="text-xs">
            Включите группу — новые сообщения ловятся в момент записи в Viber. После рестарта эмулятора догоняем с сохранённого курсора.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
              placeholder="Поиск группы…"
              className="h-9 pl-8 text-xs"
              aria-label="Поиск группы"
            />
          </div>
          <ScrollArea className="h-[min(28rem,60vh)] rounded-lg border">
            {loading && groupRows.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">Загрузка групп…</p>
            ) : visibleGroups.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">Группы не найдены.</p>
            ) : (
              <ul className="divide-y">
                {visibleGroups.map((row) => (
                  <li key={row.conversationId} className="flex min-h-11 items-center gap-3 px-3 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ID {row.conversationId}
                        {typeof row.memberCount === "number"
                          ? ` · ${row.memberCount.toLocaleString("ru-RU")} уч.`
                          : ""}
                      </span>
                    </span>
                    {togglingId === row.conversationId ? (
                      <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : null}
                    <Switch
                      checked={row.enabled}
                      disabled={togglingId === row.conversationId}
                      onCheckedChange={(checked) => void handleToggleGroup(row.conversationId, checked)}
                      aria-label={`${row.enabled ? "Выключить" : "Включить"} мониторинг ${row.name}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <p className="text-[11px] text-muted-foreground">
            Включено: {enabledCount} из {groupRows.length}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <RadioIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
                  Мониторинг Viber
                </CardTitle>
                <CardDescription className="text-xs">
                  Живой поток сообщений выбранных групп с номерами телефонов и медиа.
                </CardDescription>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {status?.liveWatch ? (
                    <Badge className="gap-1.5 bg-emerald-600 font-normal text-white hover:bg-emerald-600">
                      <span className="inline-block size-2 animate-pulse rounded-full bg-white" />
                      Live SQLite
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5 font-normal">
                      <WifiOffIcon className="size-3" />
                      Хук SQLite выключен
                    </Badge>
                  )}
                  {isLiveConnected ? (
                    <Badge variant="outline" className="gap-1.5 font-normal">
                      <WifiIcon className="size-3" />
                      SSE
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                      Ожидание SSE
                    </Badge>
                  )}
                  {status?.isRunning ? (
                    pollStale ? (
                      <Badge variant="destructive" className="font-normal">
                        Нет связи с эмулятором
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Опрос активен
                      </Badge>
                    )
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Опрос остановлен
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={status?.isRunning ? "destructive" : "default"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={pollerBusy}
                  onClick={() => void handleTogglePoller()}
                >
                  {pollerBusy ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : status?.isRunning ? (
                    <SquareIcon className="size-3.5" />
                  ) : (
                    <PlayIcon className="size-3.5" />
                  )}
                  {status?.isRunning ? "Остановить опрос" : "Запустить опрос"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={exporting}>
                      {exporting ? <Loader2Icon className="size-3.5 animate-spin" /> : <DownloadIcon className="size-3.5" />}
                      Экспорт
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void handleExport("csv")}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleExport("json")}>JSON</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleExport("jsonl")}>JSONL</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-card/60 p-3.5">
                <span className="block text-xs font-medium text-muted-foreground">Обработано</span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {status?.processedMessagesCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Номера из текста
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {status?.phonesFromTextCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
                <span className="block text-xs font-medium text-blue-700 dark:text-blue-400">
                  Номера из профиля
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {status?.phonesFromViberCount ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Лента сообщений</CardTitle>
              <p className="text-sm text-muted-foreground">
                {visible.length === 0 ? (
                  "Нет сообщений"
                ) : (
                  <>
                    {pageStart + 1}–{pageEnd} из{" "}
                    <span className="font-medium text-foreground">{visible.length}</span>
                  </>
                )}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="monitor-group-filter">Группа</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger id="monitor-group-filter">
                    <SelectValue placeholder="Все группы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все группы</SelectItem>
                    {groupRows.map((row) => (
                      <SelectItem key={row.conversationId} value={String(row.conversationId)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monitor-phone-filter">Телефон</Label>
                <Select value={phoneFilter} onValueChange={setPhoneFilter}>
                  <SelectTrigger id="monitor-phone-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="yes">С номером</SelectItem>
                    <SelectItem value="no">Без номера</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monitor-media-filter">Медиа</Label>
                <Select value={mediaFilter} onValueChange={setMediaFilter}>
                  <SelectTrigger id="monitor-media-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="yes">С изображением</SelectItem>
                    <SelectItem value="no">Только текст</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monitor-query">Поиск</Label>
                <Input
                  id="monitor-query"
                  type="search"
                  placeholder="Текст, имя, телефон…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Время</TableHead>
                    <TableHead className="min-w-[140px]">Группа</TableHead>
                    <TableHead className="min-w-[120px]">Автор</TableHead>
                    <TableHead className="min-w-[140px]">Телефон</TableHead>
                    <TableHead className="min-w-[280px]">Сообщение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {enabledCount === 0
                          ? "Включите группу слева, чтобы начать мониторинг."
                          : "Пока нет сообщений под выбранные фильтры."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatMsgTime(message.date)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="block max-w-[180px] truncate font-medium" title={message.conversationName ?? undefined}>
                            {message.conversationName || `Чат ${message.conversationId}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {message.senderName || (message.outgoing ? "Бот" : "Участник")}
                        </TableCell>
                        <TableCell>
                          {message.attachedPhone ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1 font-mono text-xs font-semibold">
                                <PhoneIcon className="size-3 text-muted-foreground" />
                                {message.attachedPhone}
                              </span>
                              {message.phoneSource === "message_text" ? (
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Из текста
                                </span>
                              ) : null}
                              {message.phoneSource === "viber_profile" ? (
                                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                  Из профиля
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[450px] text-sm">
                          <span className="flex items-start gap-2">
                            {messageHasMedia(message) ? (
                              <span className="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-muted text-muted-foreground">
                                <ImageIcon className="size-5" />
                                <span className="text-[10px] font-medium leading-none">Фото</span>
                              </span>
                            ) : null}
                            <span className="min-w-0 break-words">
                              {messagePreviewText(message) || (messageHasMedia(message) ? "" : "—")}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {visible.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Страница {currentPage} из {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 gap-1"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 gap-1"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Вперёд
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
