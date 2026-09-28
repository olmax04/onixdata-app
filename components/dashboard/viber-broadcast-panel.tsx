"use client"

import * as React from "react"
import {
  Loader2Icon,
  PlayIcon,
  SendIcon,
  SettingsIcon,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BroadcastCampaignDialog } from "@/components/dashboard/broadcast-campaign-dialog"
import {
  BroadcastCampaignForm,
  type BroadcastGroupRow,
} from "@/components/dashboard/broadcast-campaign-form"
import {
  emptyCampaignForm,
  formatBroadcastTime,
  formStateToPayload,
  hoursLabel,
  isNowWithinHours,
  ROTATION_LABELS,
  STATUS_LABELS,
  validateCampaignForm,
  type CampaignFormState,
} from "@/lib/broadcast-form"
import { viberJson } from "@/lib/viber-parser/client"
import type {
  BroadcastCampaign,
  BroadcastSendHistory,
  BroadcastStatusDto,
  ViberGroup,
  ViberGroupsResponse,
} from "@/lib/viber-parser/types"

const STATUS_POLL_MS = 5000

function withDeviceId(path: string, deviceId?: string) {
  if (!deviceId) return path
  const [pathname, query] = path.split("?", 2)
  const params = new URLSearchParams(query)
  params.set("deviceId", deviceId)
  return `${pathname}?${params.toString()}`
}

export interface ViberBroadcastPanelProps {
  deviceId?: string
}

export function ViberBroadcastPanel({ deviceId }: ViberBroadcastPanelProps = {}) {
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [campaigns, setCampaigns] = React.useState<BroadcastCampaign[]>([])
  const [status, setStatus] = React.useState<BroadcastStatusDto | null>(null)
  const [lastSends, setLastSends] = React.useState<BroadcastSendHistory[]>([])
  const [history, setHistory] = React.useState<BroadcastSendHistory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const [form, setForm] = React.useState<CampaignFormState>(() => emptyCampaignForm())

  const broadcastPath = React.useCallback(
    (path: string) => withDeviceId(path, deviceId),
    [deviceId]
  )

  const running = status?.campaign ?? campaigns.find((item) => item.status === "running") ?? null

  const groupRows = React.useMemo<BroadcastGroupRow[]>(
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

  const knownNames = React.useMemo(
    () => new Map(groupRows.map((row) => [row.conversationId, row.name] as const)),
    [groupRows]
  )

  const editing = React.useMemo(
    () => campaigns.find((item) => item.id === editingId) ?? null,
    [campaigns, editingId]
  )

  // Кампанию могли удалить из другой вкладки — закрываем диалог явно, иначе он
  // сам всплывёт, когда запись вернётся в следующем ответе поллинга.
  React.useEffect(() => {
    if (editingId !== null && editing === null) setEditingId(null)
  }, [editingId, editing])

  const refresh = React.useCallback(async () => {
    const [campaignList, broadcastStatus, last, recent] = await Promise.allSettled([
      viberJson<BroadcastCampaign[]>(broadcastPath("broadcast/campaigns")),
      viberJson<BroadcastStatusDto>(broadcastPath("broadcast/status")),
      viberJson<BroadcastSendHistory[]>(broadcastPath("broadcast/history/last")),
      viberJson<BroadcastSendHistory[]>(broadcastPath("broadcast/history?limit=50")),
    ])
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
    }
  }, [broadcastPath])

  const loadInitial = React.useCallback(async () => {
    setLoading(true)
    try {
      // Рассылка идёт в чаты выбранного инстанса, поэтому целями могут быть
      // только группы, открытые на его эмуляторе. Без инстанса список остаётся
      // полным — вместе с записями из базы и архива.
      const groupsPath = deviceId
        ? `groups?deviceId=${encodeURIComponent(deviceId)}&onDevice=true`
        : "groups"
      const [groupsRes, rest] = await Promise.all([
        viberJson<ViberGroupsResponse>(groupsPath).catch(() => null),
        refresh(),
      ])
      if (groupsRes) setGroups(groupsRes.groups)
      if (!rest.campaignsOk && !rest.statusOk) {
        toast.error("Не удалось загрузить рассылку Viber")
      }
    } finally {
      setLoading(false)
    }
  }, [deviceId, refresh])

  React.useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  React.useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      void refresh()
    }, STATUS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [running, refresh])

  const handleCreate = async () => {
    const error = validateCampaignForm(form)
    if (error) {
      toast.error(error)
      return
    }

    setSaving(true)
    try {
      const created = await viberJson<BroadcastCampaign>(broadcastPath("broadcast/campaigns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formStateToPayload(form, knownNames)),
      })
      toast.success(`Кампания «${created.name}» сохранена`)
      setForm((current) => ({ ...current, name: "" }))
      await refresh()
    } catch (err) {
      toast.error("Не удалось сохранить кампанию", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (id: string) => {
    setBusyId(id)
    try {
      await viberJson<BroadcastCampaign>(broadcastPath(`broadcast/campaigns/${id}/start`), {
        method: "POST",
      })
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
      await viberJson<BroadcastCampaign>(broadcastPath(`broadcast/campaigns/${id}/stop`), {
        method: "POST",
      })
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
      await viberJson<void>(broadcastPath(`broadcast/campaigns/${id}`), { method: "DELETE" })
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
            <BroadcastCampaignForm
              idPrefix="broadcast"
              value={form}
              onChange={setForm}
              groupRows={groupRows}
              loadingGroups={loading}
            />

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
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={running ? "default" : "secondary"} className="font-normal">
                      {running ? STATUS_LABELS[running.status] : "Ожидание"}
                    </Badge>
                    {running && !isNowWithinHours(running.activeFrom, running.activeTo) ? (
                      <Badge variant="outline" className="font-normal">
                        Пауза до {running.activeFrom}
                      </Badge>
                    ) : null}
                  </p>
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
                Одновременно может идти только одна рассылка — устройство занято отправкой.
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
                            onClick={() => setEditingId(campaign.id)}
                            aria-label={`Открыть ${campaign.name}`}
                          >
                            <SettingsIcon className="size-3.5" />
                            {isRunning ? "Открыть" : "Изменить"}
                          </Button>
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

      <BroadcastCampaignDialog
        campaign={editing}
        deviceId={deviceId}
        groupRows={groupRows}
        loadingGroups={loading}
        open={editingId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingId(null)
        }}
        onSaved={async () => {
          await refresh()
        }}
      />

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
                        {formatBroadcastTime(entry.sentAt)}
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
                          {formatBroadcastTime(entry.sentAt)}
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
