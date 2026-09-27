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

const MAX_ROWS = 2000
const PAGE_SIZE = 20
const STATUS_POLL_MS = 5000
/** Инстанс по умолчанию — тот, на который смотрит ADB_HOST/ADB_PORT. */
const DEFAULT_DEVICE_ID = "default"

function isDefaultInstance(id?: string | null): boolean {
  if (!id) return true
  const n = id.trim().toLowerCase()
  return (
    n === "default" ||
    n === "worker" ||
    n === "worker-1" ||
    n === "android-emulator" ||
    n === "emulator-5554" ||
    n === "main" ||
    n === "emulator"
  )
}

function normalizeInstance(id?: string | null): string {
  return isDefaultInstance(id) ? DEFAULT_DEVICE_ID : id!.trim()
}

function instancesMatch(a?: string | null, b?: string | null): boolean {
  if (isDefaultInstance(a) && isDefaultInstance(b)) return true
  return normalizeInstance(a) === normalizeInstance(b)
}

function instanceOf(item: { deviceId?: string | null }): string {
  return normalizeInstance(item.deviceId)
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function messageKey(message: MonitoredMessageDto): string {
  // Row id сообщения локален для инстанса, поэтому ключ — пара инстанс + id.
  return `${instanceOf(message)}:${message.id}`
}

function mergeMessages(
  current: MonitoredMessageDto[],
  incoming: MonitoredMessageDto[]
): MonitoredMessageDto[] {
  const byId = new Map(current.map((message) => [messageKey(message), message]))
  for (const message of incoming) {
    byId.set(messageKey(message), message)
  }
  return Array.from(byId.values())
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0
      const timeB = new Date(b.date).getTime() || 0
      if (timeB !== timeA) return timeB - timeA
      return b.id - a.id
    })
    .slice(0, MAX_ROWS)
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
  const signal = init?.signal ?? AbortSignal.timeout(15000)
  const res = await fetch(`/api/viber/${path}`, { cache: "no-store", ...init, signal })
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
  groupKey: string | null
  name: string
  memberCount?: number
  enabled: boolean
  /** Строка добралась из реестра мониторинга — на инстансе такой группы нет. */
  missingOnDevice: boolean
}

/** Подпись строки, которую нельзя включить обратно. */
const MISSING_ON_DEVICE_HINT = "Нет на инстансе — можно только снять с мониторинга"

function groupKeyOf(group: ViberGroup): string | null {
  if (group.groupId === null || group.groupId === undefined) return null
  const value = String(group.groupId).trim()
  return value ? value : null
}

/**
 * Список групп приходит из разных источников (устройство + Supabase), поэтому
 * его conversationId может принадлежать чужому аккаунту. Совпадение с
 * мониторингом ищется в пределах одного инстанса: сначала по глобальному
 * groupKey, потом по локальному ID.
 */
function buildGroupRows(
  groups: ViberGroup[],
  monitored: MonitoredGroupDto[],
  deviceId?: string
): GroupRow[] {
  const onInstance = monitored.filter((item) => instancesMatch(item.deviceId, deviceId))
  const monitoredById = new Map(onInstance.map((item) => [item.conversationId, item]))
  const monitoredByKey = new Map(
    onInstance
      .filter((item) => Boolean(item.groupKey))
      .map((item) => [String(item.groupKey), item])
  )
  const rows: GroupRow[] = groups
    .filter((group) => group.conversationType !== 0)
    .map((group) => {
      const key = groupKeyOf(group)
      const match =
        (key ? monitoredByKey.get(key) : undefined) ?? monitoredById.get(group.conversationId)
      return {
        conversationId: match?.conversationId ?? group.conversationId,
        groupKey: key ?? match?.groupKey ?? null,
        name: group.name || `Группа ${group.conversationId}`,
        memberCount: group.memberCount,
        enabled: match?.enabled ?? false,
        missingOnDevice: false,
      }
    })

  const seenIds = new Set(rows.map((row) => row.conversationId))
  const seenNames = new Set(rows.map((row) => (row.name || '').trim().toLowerCase()))
  for (const item of onInstance) {
    if (seenIds.has(item.conversationId)) continue
    if (item.name && seenNames.has(item.name.trim().toLowerCase())) continue
    // Группу удалили или аккаунт переустановили: включить такую запись заново
    // нельзя — сервер ответит 404. Выключенную прячем, включённую показываем,
    // чтобы её было чем снять с мониторинга.
    if (!item.enabled) continue
    rows.push({
      conversationId: item.conversationId,
      groupKey: item.groupKey ?? null,
      name: item.name || `Группа ${item.conversationId}`,
      enabled: item.enabled,
      missingOnDevice: true,
    })
  }

  return rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, "ru"))
}

export interface ViberMonitorPanelProps {
  deviceId?: string
  initialQuery?: string
}

export function ViberMonitorPanel({ deviceId, initialQuery = "" }: ViberMonitorPanelProps = {}) {
  const [status, setStatus] = React.useState<MessageMonitorStatusDto | null>(null)
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [messages, setMessages] = React.useState<MonitoredMessageDto[]>([])
  const [isLiveConnected, setIsLiveConnected] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [groupsError, setGroupsError] = React.useState<string | null>(null)
  const [togglingId, setTogglingId] = React.useState<number | null>(null)
  const [pollerBusy, setPollerBusy] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [groupQuery, setGroupQuery] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState("all")
  const [phoneFilter, setPhoneFilter] = React.useState("all")
  const [mediaFilter, setMediaFilter] = React.useState("all")
  const [query, setQuery] = React.useState(initialQuery)
  const [page, setPage] = React.useState(1)

  // Без выбранного инстанса панель всё равно смотрит на один — тот, что по
  // умолчанию. Иначе группы приходили бы с него, а лента — со всех сразу.
  const instance = deviceId?.trim() || DEFAULT_DEVICE_ID
  const withDevice = React.useCallback(
    (path: string) => {
      const separator = path.includes("?") ? "&" : "?"
      return `${path}${separator}deviceId=${encodeURIComponent(instance)}`
    },
    [instance]
  )

  React.useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
    }
  }, [initialQuery])

  const refreshStatus = React.useCallback(async () => {
    const next = await viberJson<MessageMonitorStatusDto>(withDevice("messages/monitor/status"))
    setStatus({
      ...next,
      groups: next.groups ?? [],
      liveWatch: next.liveWatch ?? false,
    })
    return next
  }, [withDevice])

  const loadInitial = React.useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, monitorStatus, list] = await Promise.allSettled([
        // Мониторинг можно включить только для группы, открытой на инстансе:
        // записи из Supabase и архива ростеров в этом списке не нужны.
        viberJson<ViberGroupsResponse>(withDevice("groups?onDevice=true")),
        viberJson<MessageMonitorStatusDto>(withDevice("messages/monitor/status")),
        viberJson<MonitoredMessageDto[]>(withDevice(`messages/monitored?limit=${MAX_ROWS}`)),
      ])
      if (groupsRes.status === "fulfilled") {
        setGroups(groupsRes.value.groups)
        setGroupsError(null)
      } else {
        // Пустой список и недоступный инстанс — разные вещи: без причины
        // панель выглядит так, будто на эмуляторе просто нет групп. Список
        // чужого инстанса при этом обязан уйти с экрана.
        setGroups([])
        setGroupsError(
          groupsRes.reason instanceof Error
            ? groupsRes.reason.message
            : "не удалось загрузить группы"
        )
      }
      if (monitorStatus.status === "fulfilled") {
        setStatus({
          ...monitorStatus.value,
          groups: monitorStatus.value.groups ?? [],
          liveWatch: monitorStatus.value.liveWatch ?? false,
        })
      }
      if (list.status === "fulfilled") {
        setMessages((current) =>
          mergeMessages(current, Array.isArray(list.value) ? list.value : [])
        )
      }
      if (monitorStatus.status === "rejected" && list.status === "rejected") {
        toast.error("Не удалось загрузить мониторинг Viber")
      }
    } finally {
      setLoading(false)
    }
  }, [withDevice])

  const refreshMessages = React.useCallback(async () => {
    try {
      const list = await viberJson<MonitoredMessageDto[]>(
        withDevice(`messages/monitored?limit=${MAX_ROWS}`)
      )
      if (Array.isArray(list)) {
        setMessages((current) => mergeMessages(current, list))
      }
    } catch {
      // ignore transient fetch errors
    }
  }, [withDevice])

  React.useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void refreshStatus().catch(() => undefined)
      void refreshMessages().catch(() => undefined)
    }, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshStatus, refreshMessages])

  React.useEffect(() => {
    let active = true
    const es = new EventSource("/api/viber/messages/events")
    es.onopen = () => {
      setIsLiveConnected(true)
      void refreshMessages()
    }
    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as MonitoredMessageDto
        if (typeof raw?.id !== "number") return
        // Поток общий для всех инстансов, панель показывает только свой (с учётом алиасов worker/default)
        if (!instancesMatch(raw.deviceId, instance)) return
        setMessages((current) => mergeMessages(current, [raw]))
      } catch {
        // ignore keepalive / unparseable frames
      }
    }
    es.onerror = () => setIsLiveConnected(false)
    return () => {
      active = false
      es.close()
    }
  }, [instance, refreshMessages])

  const groupRows = React.useMemo(
    () => buildGroupRows(groups, status?.groups ?? [], instance),
    [groups, status?.groups, instance]
  )

  const groupOptions = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groupRows) {
      map.set(String(g.conversationId), g.name)
    }
    for (const m of messages) {
      const id = String(m.conversationId)
      if (!map.has(id)) {
        map.set(id, m.conversationName || `Чат ${m.conversationId}`)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [groupRows, messages])

  const pollStale =
    status?.isRunning === true &&
    (!status.lastPollAt || Date.now() - new Date(status.lastPollAt).getTime() > 20_000)
  const enabledCount = groupRows.filter((row) => row.enabled).length
  const visibleGroups = groupRows.filter((row) => {
    if (!groupQuery.trim()) return true
    return row.name.toLowerCase().includes(groupQuery.trim().toLowerCase())
  })

  const visible = messages.filter((message) => {
    if (sourceFilter !== "all") {
      const selectedGroup = groupOptions.find((g) => g.id === sourceFilter)
      const matchesId = String(message.conversationId) === sourceFilter
      const matchesName =
        selectedGroup &&
        message.conversationName &&
        selectedGroup.name.trim().toLowerCase() === message.conversationName.trim().toLowerCase()
      if (!matchesId && !matchesName) return false
    }
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
  }).sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0
    const timeB = new Date(b.date).getTime() || 0
    if (timeB !== timeA) return timeB - timeA
    return b.id - a.id
  })

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE
  const pageRows = visible.slice(pageStart, pageStart + PAGE_SIZE)
  const pageEnd = pageStart + pageRows.length

  React.useEffect(() => {
    setPage(1)
  }, [sourceFilter, phoneFilter, mediaFilter, query])

  const handleToggleGroup = async (
    conversationId: number,
    enabled: boolean,
    groupKey: string | null = null
  ) => {
    setTogglingId(conversationId)
    // Оптимистичное обновление UI: сразу переключаем тумблер в интерфейсе
    const prevStatus = status
    setStatus((current) => {
      if (!current) return current
      const existingIdx = (current.groups ?? []).findIndex(
        (g) => g.conversationId === conversationId
      )
      let nextGroups: MonitoredGroupDto[]
      if (existingIdx >= 0) {
        nextGroups = (current.groups ?? []).map((g, idx) =>
          idx === existingIdx ? { ...g, enabled } : g
        )
      } else {
        const matchingGroup = groups.find((g) => g.id === conversationId)
        nextGroups = [
          ...(current.groups ?? []),
          {
            conversationId,
            name: matchingGroup?.name ?? null,
            enabled,
            lastMessageId: 0,
            groupKey: groupKey ?? (matchingGroup?.groupId ? String(matchingGroup.groupId) : null),
            deviceId: instance,
          },
        ]
      }
      return {
        ...current,
        isRunning: enabled ? true : current.isRunning,
        groups: nextGroups,
      }
    })

    try {
      // На enable инстанс и глобальный ключ идут телом: сервер сам подменит
      // чужой локальный ID на тот, что реально есть на этом эмуляторе.
      const path = enabled
        ? `messages/monitor/groups/${conversationId}/enable`
        : withDevice(`messages/monitor/groups/${conversationId}/disable`)
      const next = await viberJson<MessageMonitorStatusDto>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: enabled
          ? JSON.stringify({ deviceId: instance, ...(groupKey ? { groupKey } : {}) })
          : undefined,
      })
      setStatus({
        ...next,
        groups: next.groups ?? [],
        liveWatch: next.liveWatch ?? false,
      })
      toast.success(enabled ? "Группа включена в мониторинг" : "Группа снята с мониторинга")
    } catch (error) {
      if (prevStatus) setStatus(prevStatus)
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
        const next = await viberJson<MessageMonitorStatusDto>(withDevice("messages/monitor/stop"), { method: "POST" })
        setStatus({ ...next, groups: next.groups ?? [], liveWatch: next.liveWatch ?? false })
        toast.info("Опрос остановлен. Курсоры групп сохранены.")
      } else {
        const next = await viberJson<MessageMonitorStatusDto>("messages/monitor/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: instance }),
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
      params.set("deviceId", instance)
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
            Включите группу — новые сообщения фиксируются в момент поступления. После перезапуска сервиса чтение продолжается с сохранённого курсора.
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
          {groupsError ? (
            <p className="text-[11px] text-destructive">Инстанс недоступен: {groupsError}</p>
          ) : null}
          <ScrollArea className="h-[min(28rem,60vh)] rounded-lg border">
            {loading && groupRows.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">Загрузка групп…</p>
            ) : groupRows.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">На инстансе нет групп.</p>
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
                      {row.missingOnDevice ? (
                        <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                          {MISSING_ON_DEVICE_HINT}
                        </span>
                      ) : null}
                    </span>
                    {togglingId === row.conversationId ? (
                      <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : null}
                    <Switch
                      checked={row.enabled}
                      disabled={
                        togglingId === row.conversationId || (row.missingOnDevice && !row.enabled)
                      }
                      onCheckedChange={(checked) =>
                        void handleToggleGroup(row.conversationId, checked, row.groupKey)
                      }
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
                      Live поток
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5 font-normal">
                      <WifiOffIcon className="size-3" />
                      Периодический опрос
                    </Badge>
                  )}
                  {isLiveConnected ? (
                    <Badge variant="outline" className="gap-1.5 font-normal">
                      <WifiIcon className="size-3" />
                      Онлайн поток
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                      Подключение...
                    </Badge>
                  )}
                  {status?.isRunning ? (
                    pollStale ? (
                      <Badge variant="destructive" className="font-normal">
                        Нет связи с устройством
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
                  {Math.max(status?.processedMessagesCount ?? 0, messages.length)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Номера из текста
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {Math.max(
                    status?.phonesFromTextCount ?? 0,
                    messages.filter((m) => m.phoneSource === "message_text").length
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
                <span className="block text-xs font-medium text-blue-700 dark:text-blue-400">
                  Номера из профиля
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {Math.max(
                    status?.phonesFromViberCount ?? 0,
                    messages.filter((m) => m.phoneSource === "viber_profile").length
                  )}
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
                    {groupOptions.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
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
                    <TableHead className="w-[160px]">Дата и время</TableHead>
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
                        {loading && messages.length === 0
                          ? "Загрузка сообщений из базы данных…"
                          : messages.length === 0
                          ? enabledCount === 0
                            ? "В базе данных пока нет сообщений для этого инстанса. Включите группу слева, чтобы начать мониторинг."
                            : "В базе данных пока нет сохранённых сообщений для этого инстанса."
                          : "Пока нет сообщений под выбранные фильтры."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((message) => (
                      <TableRow key={messageKey(message)}>
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
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
                              {messagePreviewText(message) || (messageHasMedia(message) ? "" : (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-muted/40 px-2 py-1 text-xs italic text-muted-foreground">
                                  <span className="inline-block size-1.5 rounded-full bg-amber-500/70" />
                                  Без текста (стикер / системное)
                                </span>
                              ))}
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
