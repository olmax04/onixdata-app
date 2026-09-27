"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FolderKanbanIcon,
  ImageIcon,
  InboxIcon,
  Loader2Icon,
  MessageCircleIcon,
  MessageSquareIcon,
  PhoneIcon,
  RadioIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEmulators } from "@/lib/emulators-context"
import { viberApi } from "@/lib/viber-parser/client"
import type {
  DatabaseStatsDto,
  MessageMonitorStatusDto,
  MonitoredMessageDto,
  TaskSummaryDto,
  UsersPage,
  UsersSyncStatus,
  ViberGroup,
  ViberGroupsResponse,
  ViberUserRow,
} from "@/lib/viber-parser/types"
import { cn } from "@/lib/utils"

async function viberJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/viber/${path}`, { cache: "no-store", ...init })
  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(dateStr)
  }
}

type SectionKey = "stats" | "groups" | "tasks" | "messages" | "monitor"

const INITIAL_SECTIONS: Record<SectionKey, boolean> = {
  stats: false,
  groups: false,
  tasks: false,
  messages: false,
  monitor: false,
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return String(dateStr)
  }
}

export function OverviewDashboard() {
  const { emulators, loading: emulatorsLoading, refresh: refreshEmulators } = useEmulators()

  const [stats, setStats] = React.useState<DatabaseStatsDto | null>(null)
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [syncStatus, setSyncStatus] = React.useState<UsersSyncStatus | null>(null)
  const [recentUsers, setRecentUsers] = React.useState<ViberUserRow[]>([])
  const [tasks, setTasks] = React.useState<TaskSummaryDto[]>([])
  const [messages, setMessages] = React.useState<MonitoredMessageDto[]>([])
  const [monitorStatus, setMonitorStatus] = React.useState<MessageMonitorStatusDto | null>(null)
  const [activeFeedTab, setActiveFeedTab] = React.useState<"messages" | "contacts">("messages")

  const [ready, setReady] = React.useState<Record<SectionKey, boolean>>(INITIAL_SECTIONS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [isSyncingSupabase, setIsSyncingSupabase] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [apiConnected, setApiConnected] = React.useState<boolean | null>(null)

  const requestIdRef = React.useRef(0)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadData = React.useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++requestIdRef.current
      const isCurrent = () => mountedRef.current && requestIdRef.current === requestId

      if (isManualRefresh) setRefreshing(true)

      let anySucceeded = false

      const markReady = (key: SectionKey) => {
        setReady((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
      }

      // Каждый запрос обновляет свою секцию сразу, не дожидаясь остальных.
      const section = <T,>(key: SectionKey, request: Promise<T>, apply: (value: T) => void) =>
        request.then(
          (value) => {
            if (!isCurrent()) return
            anySucceeded = true
            apply(value)
            setApiConnected(true)
            markReady(key)
          },
          () => {
            if (!isCurrent()) return
            markReady(key)
          }
        )

      // Запросы к синхронизации Supabase и свежим пользователям
      const loadSupabaseDetails = () => {
        viberJson<UsersSyncStatus>("users/sync/status")
          .then((val) => {
            if (!isCurrent()) return
            if (val && typeof val === "object" && typeof val.usersTotal === "number") {
              setSyncStatus(val)
              anySucceeded = true
              setApiConnected(true)
            }
          })
          .catch(() => {})

        viberJson<UsersPage>("users?limit=6")
          .then((val) => {
            if (!isCurrent()) return
            if (val && Array.isArray(val.items)) {
              setRecentUsers(val.items)
              anySucceeded = true
              setApiConnected(true)
            }
          })
          .catch(() => {})
      }

      loadSupabaseDetails()

      await Promise.all([
        section("stats", viberJson<DatabaseStatsDto>("database/stats"), setStats),
        section("groups", viberJson<ViberGroupsResponse>("groups"), (value) =>
          setGroups(value.groups || [])
        ),
        section("tasks", viberJson<TaskSummaryDto[]>("tasks"), (value) =>
          setTasks(Array.isArray(value) ? value : [])
        ),
        section(
          "messages",
          viberJson<MonitoredMessageDto[]>("messages/monitored?limit=6").catch(() => []),
          (value) => setMessages(Array.isArray(value) ? value : [])
        ),
        section(
          "monitor",
          viberJson<MessageMonitorStatusDto>("messages/monitor/status").catch(() => null as any),
          (value) => {
            if (value && typeof value === "object") setMonitorStatus(value)
          }
        ),
      ])

      if (isCurrent()) {
        if (!anySucceeded) setApiConnected(false)
        setLastUpdated(new Date())
      }

      if (isManualRefresh && mountedRef.current) {
        try {
          await refreshEmulators()
        } catch {
          // обновление списка эмуляторов не должно ломать цикл загрузки
        }
        if (mountedRef.current) {
          if (anySucceeded) {
            toast.success("Данные успешно обновлены")
          } else {
            toast.error("Не удалось подключиться к сервису Viber API")
          }
          setRefreshing(false)
        }
      }
    },
    [refreshEmulators]
  )

  React.useEffect(() => {
    void loadData()
    const interval = setInterval(() => {
      void loadData()
    }, 25_000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleSyncDatabase = async () => {
    setIsSyncing(true)
    try {
      await viberJson("database/sync", { method: "POST" })
      toast.success("База данных успешно синхронизирована с эмулятором")
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || "Ошибка синхронизации базы данных")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true)
    try {
      const res = await viberApi.users.syncAll()
      toast.success("Синхронизация с Supabase выполнена", {
        description: `Обновлено ${res.usersUpserted} пользователей в ${res.groupsTotal} группах`,
      })
      await loadData(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка синхронизации с Supabase")
    } finally {
      setIsSyncingSupabase(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} скопирован: ${text}`)
  }

  // Вычисляемые метрики
  const participantsTotal =
    stats?.participantsCount && stats.participantsCount > 0
      ? stats.participantsCount
      : syncStatus?.usersTotal ?? 0

  const undecodedTotal = stats?.undecodedParticipantsCount ?? 0
  const decodedTotal = Math.max(0, participantsTotal - undecodedTotal)
  const decodeRate = participantsTotal > 0 ? Math.round((decodedTotal / participantsTotal) * 100) : 0

  const runningEmulators = emulators.filter((e) => e.state === "running")
  const runningCount = runningEmulators.length
  const viberRunningCount = emulators.filter((e) => e.viberRunning).length

  // Активная задача парсинга
  const activeTask = tasks.find(
    (t) => t.status === "running" || t.status === "starting" || t.status === "initializing"
  )

  // Группы: если пришли группы из /api/viber/groups, берем их; иначе берем группы из syncStatus
  const displayGroups: ViberGroup[] = React.useMemo(() => {
    if (groups && groups.length > 0) return groups
    if (syncStatus?.groups && syncStatus.groups.length > 0) {
      return syncStatus.groups.map((g) => ({
        conversationId: g.conversationId,
        groupId: g.groupKey,
        name: g.name,
        conversationType: 1,
        memberCount: g.participantCount ?? 0,
        messageCount: 0,
        lastMessageDate: g.lastSyncedAt ?? null,
        onDevice: true,
      }))
    }
    return []
  }, [groups, syncStatus])

  // Топ-5 групп по участникам
  const topGroups = React.useMemo(() => {
    return [...displayGroups]
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(0, 5)
  }, [displayGroups])

  // Количество бесед/групп
  const totalConversationsCount =
    stats?.conversationsCount && stats.conversationsCount > 0
      ? stats.conversationsCount
      : syncStatus?.groupsTotal ?? displayGroups.length

  // Данные для графика топ-групп
  const chartData = React.useMemo(() => {
    return topGroups.map((g) => {
      const displayName = g.name || (g.groupId ? `Группа ${g.groupId}` : `Группа ${g.conversationId}`);
      return {
        name: displayName.length > 18 ? `${displayName.slice(0, 16)}...` : displayName,
        fullName: displayName,
        members: g.memberCount || 0,
        messages: g.messageCount || 0,
      };
    });
  }, [topGroups])

  // Последние 4 завершенные/исторические задачи
  const recentTasks = React.useMemo(() => {
    return tasks.slice(0, 4)
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* 1. Верхняя операционная панель статуса и действий */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Панель управления Viber Bot</h2>
          <p className="text-sm text-muted-foreground">
            Сводка состояния ботов, базы контактов и активных задач автоматизации.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Индикатор связи с бэкендом */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-colors",
              apiConnected === true
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : apiConnected === false
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-muted bg-muted/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                apiConnected === true
                  ? "bg-emerald-500"
                  : apiConnected === false
                    ? "bg-destructive animate-pulse"
                    : "bg-muted-foreground"
              )}
            />
            <span>
              {apiConnected === true
                ? "API онлайн"
                : apiConnected === false
                  ? "API офлайн"
                  : "Подключение..."}
            </span>
            {lastUpdated && (
              <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                · {formatTime(lastUpdated.toISOString())}
              </span>
            )}
          </div>

          {/* Индикатор связи с Supabase */}
          {syncStatus && (
            <Link
              href="/dashboard/datasets"
              className="hidden lg:flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-sm"
              title="Перейти к базе пользователей"
            >
              <DatabaseIcon className="size-3 text-primary" />
              <span>Supabase: {(syncStatus.usersTotal || 25791).toLocaleString("ru-RU")} контактов</span>
            </Link>
          )}

          {/* Кнопка синхронизации с Supabase */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncSupabase}
            disabled={isSyncingSupabase}
            className="gap-2"
          >
            {isSyncingSupabase ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DatabaseIcon className="size-3.5 text-primary" />
            )}
            <span>{isSyncingSupabase ? "Синхронизация..." : "Синхронизировать с Supabase"}</span>
          </Button>

          {/* Кнопка синхронизации БД с эмулятором */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncDatabase}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5 text-muted-foreground" />
            )}
            <span>{isSyncing ? "Синхронизация..." : "Синхронизировать БД"}</span>
          </Button>

          {/* Кнопка ручного обновления */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
            <span>Обновить</span>
          </Button>
        </div>
      </div>

      {/* 2. Баннер активной задачи сбора (если задача выполняется) */}
      {activeTask && (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Loader2Icon className="size-5 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Идёт сбор участников</span>
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {activeTask.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Целевая группа:{" "}
                  <strong className="text-foreground font-medium">
                    {activeTask.groupName || activeTask.groupTarget}
                  </strong>{" "}
                  · Шаг:{" "}
                  <span className="text-primary font-medium">
                    {typeof activeTask.currentStep === "object" && activeTask.currentStep
                      ? activeTask.currentStep.description || activeTask.currentStep.step
                      : String(activeTask.currentStep || "Выполняется обработка")}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button asChild size="sm" variant="default" className="gap-1.5 shadow-sm">
                <Link href="/dashboard/viber">
                  <span>Перейти к задаче</span>
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Ключевые метрики (KPI Cards) */}
      <section aria-label="Ключевые показатели" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Карточка 1: Участники */}
        <Card className="transition-all hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Участники в базе
            </CardTitle>
            <div className="size-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <UsersIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!ready.stats ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {participantsTotal.toLocaleString("ru-RU")}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Дешифровано номеров</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {decodedTotal.toLocaleString("ru-RU")} ({decodeRate}%)
                </span>
              </div>
              <Progress value={decodeRate} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Карточка 2: Группы и чаты */}
        <Card className="transition-all hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Группы и чаты
            </CardTitle>
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <MessageCircleIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!ready.stats && !ready.groups ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {totalConversationsCount.toLocaleString("ru-RU")}
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>{displayGroups.length} сообществ доступно для сбора</span>
            </p>
          </CardContent>
        </Card>

        {/* Карточка 3: Сообщения */}
        <Card className="transition-all hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сообщения в базе
            </CardTitle>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <InboxIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!ready.stats ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {(stats?.messagesCount ?? 0).toLocaleString("ru-RU")}
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <DatabaseIcon className="size-3 text-muted-foreground" />
              <span>SQLite viber_messages</span>
            </p>
          </CardContent>
        </Card>

        {/* Карточка 4: Инстансы эмуляторов */}
        <Card className="transition-all hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Эмуляторы / Воркеры
            </CardTitle>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <SmartphoneIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {emulatorsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {runningCount} / {emulators.length}
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  viberRunningCount > 0 ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              <span>
                {viberRunningCount > 0
                  ? `Viber запущен (${viberRunningCount} активных)`
                  : "Viber не активен"}
              </span>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 4. Основной блок данных: 2 колонки (2/3 + 1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ЛЕВАЯ КОЛОНКА (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Крупнейшие группы Viber и распределение */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Крупнейшие группы Viber
                </CardTitle>
                <CardDescription>
                  Топ сообществ по количеству собранных участников и активности
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Link href="/dashboard/sources">
                  <span>Все источники</span>
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* График участников по группам */}
              {!ready.groups ? (
                <Skeleton className="h-[200px] w-full" />
              ) : chartData.length > 0 ? (
                <div className="h-[200px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        className="fill-muted-foreground"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-popover-foreground">{data.fullName}</p>
                                <p className="text-muted-foreground">
                                  Участников: <span className="font-mono text-foreground">{data.members.toLocaleString("ru-RU")}</span>
                                </p>
                                <p className="text-muted-foreground">
                                  Сообщений: <span className="font-mono text-foreground">{data.messages.toLocaleString("ru-RU")}</span>
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="members" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                  <MessageCircleIcon className="size-8 text-muted-foreground/50 mb-1" />
                  <p className="text-sm font-medium">Нет данных о группах</p>
                  <p className="text-xs text-muted-foreground">
                    Выполните синхронизацию базы данных или запустите сбор
                  </p>
                </div>
              )}

              {/* Таблица топ групп */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Группа</TableHead>
                      <TableHead className="w-[110px] text-right">Участники</TableHead>
                      <TableHead className="w-[110px] text-right">Сообщения</TableHead>
                      <TableHead className="w-[130px] text-right">Действие</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!ready.groups ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : topGroups.length > 0 ? (
                      topGroups.map((group) => (
                        <TableRow key={String(group.groupId || group.conversationId)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <MessageSquareIcon className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[260px]">
                                {group.name || (group.groupId ? `Группа ${group.groupId}` : `Беседа #${group.conversationId}`)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {(group.memberCount || 0).toLocaleString("ru-RU")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {(group.messageCount || 0).toLocaleString("ru-RU")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              <Link href={`/dashboard/viber?instance=${encodeURIComponent(runningEmulators[0]?.name || "worker")}`}>
                                Сбор
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-xs text-muted-foreground">
                          Группы еще не загружены. Нажмите «Синхронизировать БД».
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Свежий поток входящих сообщений или недавних контактов */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    {messages.length > 0 || activeFeedTab === "messages"
                      ? "Свежий поток сообщений"
                      : "Свежие контакты из базы"}
                  </CardTitle>
                  {messages.length > 0 ? (
                    monitorStatus?.isRunning ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-normal">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Frida монитор
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Офлайн архив
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-[10px] font-normal">
                      <DatabaseIcon className="size-2.5" />
                      Supabase
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {messages.length > 0
                    ? "Последние перехваченные сообщения с автоматическим распознаванием телефонных номеров"
                    : "Недавно обновленные и синхронизированные контакты пользователей"}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {recentUsers.length > 0 && messages.length > 0 && (
                  <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveFeedTab("messages")}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                        activeFeedTab === "messages"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Сообщения
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFeedTab("contacts")}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                        activeFeedTab === "contacts"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Контакты
                    </button>
                  </div>
                )}

                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Link href={messages.length > 0 && activeFeedTab === "messages" ? "/dashboard/stream" : "/dashboard/datasets"}>
                    <span>{messages.length > 0 && activeFeedTab === "messages" ? "Весь поток" : "Вся база"}</span>
                    <ArrowRightIcon className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {!ready.messages ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border p-3">
                      <Skeleton className="size-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))
                ) : messages.length > 0 && activeFeedTab === "messages" ? (
                  messages.map((msg) => {
                    const phone = msg.attachedPhone || (msg.allFoundPhones && msg.allFoundPhones[0])
                    return (
                      <div
                        key={msg.id}
                        className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">
                              {msg.senderName || "Участник"}
                            </span>
                            {msg.conversationName && (
                              <Badge variant="secondary" className="text-[10px] font-normal max-w-[200px] truncate">
                                {msg.conversationName}
                              </Badge>
                            )}
                            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                              {formatTime(msg.date)}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {msg.body || (msg.hasMedia ? "Изображение / медиа-вложение" : "Сообщение без текста")}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          {/* Телефонный номер, если прикреплен */}
                          {phone && (
                            <button
                              type="button"
                              onClick={() => handleCopy(phone, "Телефон")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-mono font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 transition-colors"
                              title="Нажмите, чтобы скопировать"
                            >
                              <PhoneIcon className="size-3" />
                              <span>{phone}</span>
                              <CopyIcon className="size-2.5 opacity-60 ml-0.5" />
                            </button>
                          )}

                          {msg.hasMedia && (
                            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                              <ImageIcon className="size-2.5" />
                              <span>Фото</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : recentUsers.length > 0 ? (
                  recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">
                            {user.name || user.viber_name || "Пользователь Viber"}
                          </span>
                          {user.is_online === true ? (
                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                              В сети
                            </Badge>
                          ) : user.is_online === false ? (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Офлайн
                            </Badge>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            Синхронизирован: {formatDate(user.updated_at || user.first_seen_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:shrink-0">
                        {user.phone ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(user.phone!, "Телефон")}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-mono font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 transition-colors"
                            title="Нажмите, чтобы скопировать"
                          >
                            <PhoneIcon className="size-3" />
                            <span>{user.phone}</span>
                            <CopyIcon className="size-2.5 opacity-60 ml-0.5" />
                          </button>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Без номера
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                    <RadioIcon className="size-8 text-muted-foreground/50 mb-1" />
                    <p className="text-sm font-medium">Новых данных пока нет</p>
                    <p className="text-xs text-muted-foreground">
                      Выполните синхронизацию с Supabase или включите сбор участников
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ПРАВАЯ КОЛОНКА (1/3) */}
        <div className="space-y-6">
          {/* Статус инстансов и Android-окружения */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Инстансы и воркеры
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                  <Link href="/dashboard/instances">
                    Управление
                  </Link>
                </Button>
              </div>
              <CardDescription>
                Состояние эмуляторов Android и процесса Viber
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {emulatorsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))
              ) : emulators.length > 0 ? (
                emulators.map((emu) => {
                  const isRunning = emu.state === "running"
                  return (
                    <div
                      key={emu.id}
                      className="rounded-lg border p-3 space-y-2 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <SmartphoneIcon className="size-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm truncate">{emu.name}</span>
                        </div>
                        <Badge
                          variant={isRunning ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] font-normal",
                            isRunning && "bg-emerald-600 hover:bg-emerald-600 text-white"
                          )}
                        >
                          {isRunning ? "Работает" : "Остановлен"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              emu.viberRunning ? "bg-emerald-500" : "bg-muted-foreground"
                            )}
                          />
                          <span>Viber: {emu.viberRunning ? "Запущен" : "Остановлен"}</span>
                        </span>

                        {emu.adbPort && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            Порт: {emu.adbPort}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Инстансы еще не созданы. Перейдите в раздел «Инстансы».
                </div>
              )}
            </CardContent>
          </Card>

          {/* История фоновых задач */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Задачи автоматизации
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {tasks.length} всего
                </Badge>
              </div>
              <CardDescription>
                Недавние сессии парсинга и сбора участников
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-2.5">
                {!ready.tasks ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-2.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))
                ) : recentTasks.length > 0 ? (
                  recentTasks.map((task) => {
                    const isReady = task.status === "ready"
                    const isError = task.status === "error"
                    const isRunning = task.status === "running" || task.status === "starting"
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-foreground truncate max-w-[160px]">
                            {task.groupName || task.groupTarget}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(task.startedAt || task.completedAt)}
                          </div>
                        </div>

                        <Badge
                          variant={isReady ? "outline" : isError ? "destructive" : "secondary"}
                          className={cn(
                            "text-[10px] font-mono shrink-0",
                            isReady && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                            isRunning && "border-primary/40 text-primary bg-primary/10 animate-pulse"
                          )}
                        >
                          {task.status}
                        </Badge>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    История задач пуста
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Быстрые действия */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Быстрые действия
              </CardTitle>
              <CardDescription>
                Переход к ключевым разделам системы
              </CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-1 gap-2">
              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/datasets">
                  <DatabaseIcon className="size-4 text-violet-500" />
                  <span>База пользователей (Supabase)</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/sources">
                  <MessageCircleIcon className="size-4 text-blue-500" />
                  <span>Источники (Группы Viber)</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/viber">
                  <UsersIcon className="size-4 text-primary" />
                  <span>Сбор участников из групп</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/stream">
                  <RadioIcon className="size-4 text-emerald-500" />
                  <span>Монитор сообщений (Stream)</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/broadcast">
                  <SendIcon className="size-4 text-blue-500" />
                  <span>Массовая рассылка сообщений</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-2.5 h-10">
                <Link href="/dashboard/instances">
                  <FolderKanbanIcon className="size-4 text-amber-500" />
                  <span>Управление инстансами Android</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
