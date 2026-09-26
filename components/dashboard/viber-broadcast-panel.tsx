"use client"

import * as React from "react"
import {
  Loader2Icon,
  PlayIcon,
  SearchIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import type {
  BroadcastCampaign,
  BroadcastCampaignStatus,
  BroadcastRotation,
  BroadcastSendHistory,
  BroadcastStatusDto,
  ViberGroup,
  ViberGroupsResponse,
} from "@/lib/viber-parser/types"
import { usePollLoop } from "@/lib/viber-parser/use-poll-loop"

const STATUS_POLL_MS = 5000
/** Опрос без активной кампании: реже, но не «никогда» — кампанию могли запустить не отсюда. */
const IDLE_POLL_MS = 15_000

const ROTATION_LABELS: Record<BroadcastRotation, string> = {
  "round-robin": "По кругу",
  random: "Случайно",
  "shuffle-cycle": "Перемешанный цикл",
}

const STATUS_LABELS: Record<BroadcastCampaignStatus, string> = {
  idle: "Черновик",
  running: "Идёт рассылка",
  stopped: "Остановлена",
  error: "Ошибка",
}

class BroadcastApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "BroadcastApiError"
    this.status = status
  }
}

function isUnsupportedError(reason: unknown): boolean {
  return reason instanceof BroadcastApiError && reason.status === 404
}

async function viberJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/viber/${path}`, { cache: "no-store", ...init })
  if (res.status === 204) return undefined as T
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
    throw new BroadcastApiError(
      err?.error || err?.message || `Ошибка запроса (${res.status})`,
      res.status
    )
  }
  return payload as T
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseMessages(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
}

function variantCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} вариант`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} варианта`
  return `${count} вариантов`
}

function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60_000)
}

function toClock(value: string): string {
  return value.trim().slice(0, 5)
}

function hoursLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "круглосуточно"
  return `${from}–${to}`
}

function isNowWithinHours(from: string | null | undefined, to: string | null | undefined): boolean {
  if (!from || !to || from === to) return true
  const parse = (value: string): number => {
    const [hours, minutes] = value.split(":").map(Number)
    return (hours ?? 0) * 60 + (minutes ?? 0)
  }
  const start = parse(from)
  const end = parse(to)
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  return start < end ? current >= start && current < end : current >= start || current < end
}

export function ViberBroadcastPanel() {
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [campaigns, setCampaigns] = React.useState<BroadcastCampaign[]>([])
  const [status, setStatus] = React.useState<BroadcastStatusDto | null>(null)
  const [lastSends, setLastSends] = React.useState<BroadcastSendHistory[]>([])
  const [history, setHistory] = React.useState<BroadcastSendHistory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [notSupported, setNotSupported] = React.useState(false)

  const [name, setName] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [groupQuery, setGroupQuery] = React.useState("")
  const [messagesText, setMessagesText] = React.useState("")
  const [intervalMinutes, setIntervalMinutes] = React.useState("2")
  const [cooldownMinutes, setCooldownMinutes] = React.useState("30")
  const [activeFrom, setActiveFrom] = React.useState("09:00")
  const [activeTo, setActiveTo] = React.useState("21:00")
  const [rotation, setRotation] = React.useState<BroadcastRotation>("shuffle-cycle")
  const [loop, setLoop] = React.useState(true)

  const running = status?.campaign ?? campaigns.find((item) => item.status === "running") ?? null
  const runningId = running?.id ?? null

  const groupRows = React.useMemo(
    () =>
      groups
        .filter((group) => group.conversationType !== 0)
        .map((group) => ({
          conversationId: group.conversationId,
          name: group.name || `Группа ${group.conversationId}`,
          memberCount: group.memberCount,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [groups]
  )

  const visibleGroups = React.useMemo(() => {
    const query = groupQuery.trim().toLowerCase()
    if (!query) return groupRows
    return groupRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) || String(row.conversationId).includes(query)
    )
  }, [groupRows, groupQuery])

  const refresh = React.useCallback(async () => {
    const [campaignList, broadcastStatus, last, recent] = await Promise.allSettled([
      viberJson<BroadcastCampaign[]>("broadcast/campaigns"),
      viberJson<BroadcastStatusDto>("broadcast/status"),
      viberJson<BroadcastSendHistory[]>("broadcast/history/last"),
      viberJson<BroadcastSendHistory[]>("broadcast/history?limit=50"),
    ])

    // Старая сборка бэкенда без модуля broadcast отвечает 404 — показываем это один раз блоком.
    const unsupported =
      campaignList.status === "rejected" &&
      broadcastStatus.status === "rejected" &&
      isUnsupportedError(campaignList.reason) &&
      isUnsupportedError(broadcastStatus.reason)
    setNotSupported(unsupported)

    if (campaignList.status === "fulfilled") {
      setCampaigns(Array.isArray(campaignList.value) ? campaignList.value : [])
    }
    if (broadcastStatus.status === "fulfilled") setStatus(broadcastStatus.value)
    if (last.status === "fulfilled") {
      setLastSends(Array.isArray(last.value) ? last.value : [])
    }
    if (recent.status === "fulfilled") {
      setHistory(Array.isArray(recent.value) ? recent.value : [])
    }
    return {
      campaignsOk: campaignList.status === "fulfilled",
      statusOk: broadcastStatus.status === "fulfilled",
      unsupported,
    }
  }, [])

  const loadInitial = React.useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, rest] = await Promise.all([
        viberJson<ViberGroupsResponse>("groups").catch(() => null),
        refresh(),
      ])
      if (groupsRes) setGroups(groupsRes.groups)
      if (!rest.campaignsOk && !rest.statusOk && !rest.unsupported) {
        toast.error("Не удалось загрузить рассылку Viber")
      }
    } finally {
      setLoading(false)
    }
  }, [refresh])

  React.useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  // Отказ фонового опроса цикл ронять не должен: refresh сам разбирает частичные ошибки.
  const pollBroadcast = React.useCallback(async () => {
    try {
      await refresh()
    } catch {
      // единичный сбой опроса ничего не меняет на экране, следующий тик его исправит
    }
  }, [refresh])

  // Интервал по наличию активной кампании, а не по объекту: объект новый после каждого
  // refresh. В покое опрашиваем реже, но опрашиваем: кампанию мог запустить другой клиент.
  usePollLoop({
    enabled: !notSupported,
    intervalMs: runningId ? STATUS_POLL_MS : IDLE_POLL_MS,
    onTick: pollBroadcast,
  })

  const toggleGroup = (conversationId: number, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(conversationId)
      else next.delete(conversationId)
      return next
    })
  }

  const handleCreate = async () => {
    const messages = parseMessages(messagesText)
    const conversationIds = Array.from(selectedIds)
    const intervalMs = minutesToMs(Number(intervalMinutes))
    const minIntervalPerChatMs = minutesToMs(Number(cooldownMinutes))

    if (conversationIds.length === 0) {
      toast.error("Выберите хотя бы одну группу")
      return
    }
    if (messages.length === 0) {
      toast.error("Добавьте хотя бы один текст сообщения — каждый вариант с новой строки")
      return
    }
    if (!Number.isFinite(intervalMs) || intervalMs < 5_000) {
      toast.error("Пауза между отправками должна быть не меньше 1 минуты")
      return
    }
    if (!Number.isFinite(minIntervalPerChatMs) || minIntervalPerChatMs < 5_000) {
      toast.error("Пауза для одного чата должна быть не меньше 1 минуты")
      return
    }

    const from = toClock(activeFrom)
    const to = toClock(activeTo)
    if (!from || !to) {
      toast.error("Укажите рабочие часы с … по …")
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        conversationIds,
        messages,
        intervalMs,
        minIntervalPerChatMs,
        rotation,
        loop,
        activeFrom: from,
        activeTo: to,
      }
      const trimmedName = name.trim()
      if (trimmedName) payload.name = trimmedName

      const created = await viberJson<BroadcastCampaign>("broadcast/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      toast.success(`Кампания «${created.name}» сохранена`)
      setName("")
      await refresh()
    } catch (error) {
      toast.error("Не удалось сохранить кампанию", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (id: string) => {
    setBusyId(id)
    try {
      await viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}/start`, { method: "POST" })
      toast.success("Рассылка запущена")
      await refresh()
    } catch (error) {
      toast.error("Не удалось запустить рассылку", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleStop = async (id: string) => {
    setBusyId(id)
    try {
      await viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}/stop`, { method: "POST" })
      toast.success("Рассылка остановлена")
      await refresh()
    } catch (error) {
      toast.error("Не удалось остановить рассылку", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      await viberJson<void>(`broadcast/campaigns/${id}`, { method: "DELETE" })
      toast.success("Кампания удалена")
      await refresh()
    } catch (error) {
      toast.error("Не удалось удалить кампанию", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  if (notSupported) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Бэкенд не поддерживает рассылку</CardTitle>
          <CardDescription className="text-xs">
            Подключённая сборка Viber Parser отвечает 404 на <code>/api/broadcast/*</code> — в ней
            нет модуля рассылки. Обновите бэкенд до версии с модулем broadcast и перезагрузите
            страницу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => void loadInitial()}>
            Проверить ещё раз
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Новая кампания</CardTitle>
            <CardDescription className="text-xs">
              Выберите группы и напишите несколько формулировок — по одной на строку.
              Рассылка будет брать следующий вариант сама.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-name">Название</Label>
              <Input
                id="broadcast-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Вечерняя рассылка"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-groups-search">Группы</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="broadcast-groups-search"
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Поиск группы…"
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <ScrollArea className="h-52 rounded-lg border">
                {loading && groupRows.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">Загрузка групп…</p>
                ) : visibleGroups.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">Группы не найдены.</p>
                ) : (
                  <ul className="divide-y">
                    {visibleGroups.map((row) => {
                      const checked = selectedIds.has(row.conversationId)
                      return (
                        <li key={row.conversationId}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleGroup(row.conversationId, value === true)
                              }
                              aria-label={row.name}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{row.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                ID {row.conversationId}
                                {typeof row.memberCount === "number"
                                  ? ` · ${row.memberCount.toLocaleString("ru-RU")} уч.`
                                  : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">
                Выбрано: {selectedIds.size} из {groupRows.length}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-messages">Тексты сообщений</Label>
              <Textarea
                id="broadcast-messages"
                value={messagesText}
                onChange={(event) => setMessagesText(event.target.value)}
                placeholder={"Добрый день! Актуальное расписание на сегодня.\nНапоминаем о правилах группы."}
                className="min-h-28 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {variantCountLabel(parseMessages(messagesText).length)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-interval">Пауза, мин</Label>
                <Input
                  id="broadcast-interval"
                  type="number"
                  min={1}
                  step={1}
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-cooldown">На чат, мин</Label>
                <Input
                  id="broadcast-cooldown"
                  type="number"
                  min={1}
                  step={1}
                  value={cooldownMinutes}
                  onChange={(event) => setCooldownMinutes(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-from">Рабочие часы с</Label>
                <Input
                  id="broadcast-from"
                  type="time"
                  value={activeFrom}
                  onChange={(event) => setActiveFrom(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-to">по</Label>
                <Input
                  id="broadcast-to"
                  type="time"
                  value={activeTo}
                  onChange={(event) => setActiveTo(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              По местному времени компьютера. Вне этого окна рассылка ждёт и не пишет в чаты.
            </p>

            <div className="space-y-1.5">
              <Label>Порядок текстов</Label>
              <Select
                value={rotation}
                onValueChange={(value) => setRotation(value as BroadcastRotation)}
              >
                <SelectTrigger className="h-9 text-sm" aria-label="Порядок текстов">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3">
              <div>
                <p className="text-sm font-medium">Повторять по кругу</p>
                <p className="text-[11px] text-muted-foreground">
                  Выкл — по одному сообщению в каждую группу и стоп
                </p>
              </div>
              <Switch checked={loop} onCheckedChange={setLoop} aria-label="Повторять по кругу" />
            </div>

            <Button className="w-full gap-1.5" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              Сохранить кампанию
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <SendIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
                    Текущая рассылка
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {running
                      ? `«${running.name}» — ${running.groups.length} групп, ${running.messages.length} формулировок · ${hoursLabel(running.activeFrom, running.activeTo)}`
                      : "Сейчас ничего не отправляется. Запустите кампанию из списка ниже."}
                  </CardDescription>
                </div>
                {running ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={busyId === running.id}
                    onClick={() => void handleStop(running.id)}
                  >
                    {busyId === running.id ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <SquareIcon className="size-3.5" />
                    )}
                    Остановить
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card/60 p-3.5">
                  <span className="block text-xs font-medium text-muted-foreground">Отправлено</span>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {running?.sentCount ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">
                    Ошибки
                  </span>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {running?.failedCount ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-3.5">
                  <span className="block text-xs font-medium text-muted-foreground">Статус</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={running ? "default" : "secondary"} className="font-normal">
                      {running ? STATUS_LABELS[running.status] : "Ожидание"}
                    </Badge>
                    {running && !isNowWithinHours(running.activeFrom, running.activeTo) ? (
                      <Badge variant="outline" className="font-normal">
                        Пауза до {running.activeFrom}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              {running?.lastError ? (
                <p className="mt-3 text-xs text-destructive">{running.lastError}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Кампании</CardTitle>
              <CardDescription className="text-xs">
                Одновременно может идти только одна рассылка — эмулятор занят отправкой.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Загрузка кампаний…</p>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Пока нет кампаний. Соберите список групп и тексты слева.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {campaigns.map((campaign) => {
                    const isRunning = campaign.status === "running"
                    const busy = busyId === campaign.id
                    return (
                      <li
                        key={campaign.id}
                        className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{campaign.name}</p>
                            <Badge
                              variant={
                                campaign.status === "error"
                                  ? "destructive"
                                  : isRunning
                                    ? "default"
                                    : "secondary"
                              }
                              className="font-normal"
                            >
                              {STATUS_LABELS[campaign.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {campaign.groups.length} групп · {campaign.messages.length} текстов ·{" "}
                            {hoursLabel(campaign.activeFrom, campaign.activeTo)} ·{" "}
                            {ROTATION_LABELS[campaign.rotation]} · пауза{" "}
                            {Math.round(campaign.intervalMs / 60_000)} мин · отправлено{" "}
                            {campaign.sentCount}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isRunning ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1.5 text-xs"
                              disabled={busy}
                              onClick={() => void handleStop(campaign.id)}
                            >
                              {busy ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : (
                                <SquareIcon className="size-3.5" />
                              )}
                              Стоп
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs"
                              disabled={busy || Boolean(running)}
                              onClick={() => void handleStart(campaign.id)}
                            >
                              {busy ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : (
                                <PlayIcon className="size-3.5" />
                              )}
                              Запустить
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={busy || isRunning}
                            onClick={() => void handleDelete(campaign.id)}
                            aria-label={`Удалить ${campaign.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Последняя отправка по чатам</CardTitle>
            <CardDescription className="text-xs">
              Когда и какой текст ушёл в каждую группу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastSends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ещё не было отправок.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Чат</TableHead>
                    <TableHead>Текст</TableHead>
                    <TableHead className="w-28">Когда</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastSends.map((entry) => (
                    <TableRow key={`${entry.conversationId}-${entry.id}`}>
                      <TableCell className="align-top">
                        <span className="block font-medium">
                          {entry.conversationName || `ID ${entry.conversationId}`}
                        </span>
                        <Badge
                          variant={entry.status === "sent" ? "outline" : "destructive"}
                          className="mt-1 font-normal"
                        >
                          {entry.status === "sent" ? "Отправлено" : "Ошибка"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[18rem] align-top text-sm text-muted-foreground">
                        <span className="line-clamp-3">{entry.text || entry.error || "—"}</span>
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatTime(entry.sentAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">История</CardTitle>
            <CardDescription className="text-xs">Последние 50 отправок.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">История пуста.</p>
            ) : (
              <ScrollArea className="h-[min(24rem,50vh)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Когда</TableHead>
                      <TableHead>Чат</TableHead>
                      <TableHead>Текст</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                          {formatTime(entry.sentAt)}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {entry.conversationName || `ID ${entry.conversationId}`}
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          <span className="line-clamp-2">{entry.text || entry.error || "—"}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
