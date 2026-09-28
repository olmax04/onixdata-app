"use client"

import * as React from "react"
import Link from "next/link"
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowUpDownIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  HistoryIcon,
  ImageIcon,
  InfoIcon,
  KeyRoundIcon,
  Loader2Icon,
  PhoneIcon,
  PlayIcon,
  RadioIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  DatabaseStatsDto,
  TaskDetailDto,
  TaskStatus,
  TaskSummaryDto,
  ViberDecodeResponse,
  ViberGroup,
  ViberGroupsResponse,
  ViberMember,
  ViberMembersResponse,
  ViberParserStatus,
  UsersSyncResult,
} from "@/lib/viber-parser/types"
import { messageHasMedia, messagePreviewText } from "@/lib/viber-parser/message-display"
import { instanceUnavailableMessage } from "@/lib/viber-parser/public-error"
import {
  applyTaskEvent,
  buildStepTimeline,
  describeTaskCompletion,
  extractStepName,
  isCompletionAnnounceable,
  isTerminalTaskStatus,
  mergeTaskDetail,
  type TaskEventPayload,
} from "@/lib/viber-parser/task-progress"
import {
  deriveConnectionState,
  describeConnection,
  INITIAL_CONNECTION,
  markConnectionFailure,
  markConnectionOk,
  type ConnectionTracker,
} from "@/lib/viber-parser/connection"
import {
  CONNECTION_TICK_MS,
  FINALIZE_ATTEMPTS,
  FINALIZE_RETRY_MS,
  SSE_HEALTHY_MS,
  SSE_MAX_ATTEMPTS,
  SSE_RETRY_BASE_MS,
  SSE_RETRY_MAX_MS,
  STATUS_POLL_MS,
  STATUS_REQUEST_TIMEOUT_MS,
  TASK_DETAIL_REQUEST_TIMEOUT_MS,
} from "@/lib/viber-parser/polling"


/**
 * Список участников бывает на тысячи строк: браузер не должен держать их все
 * в DOM. Фильтры, экспорт и копирование по-прежнему работают над полным списком.
 */
const MEMBERS_PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100, 250] as const
const DEFAULT_MEMBERS_PAGE_SIZE = 50
const MEMBERS_PAGE_SIZE_STORAGE_KEY = "viber-members-page-size"

function readStoredMembersPageSize(): number | null {
  try {
    const raw = window.localStorage.getItem(MEMBERS_PAGE_SIZE_STORAGE_KEY)
    const parsed = Number.parseInt(raw ?? "", 10)
    return MEMBERS_PAGE_SIZE_OPTIONS.some((size) => size === parsed) ? parsed : null
  } catch {
    return null
  }
}

function storeMembersPageSize(size: number) {
  try {
    window.localStorage.setItem(MEMBERS_PAGE_SIZE_STORAGE_KEY, String(size))
  } catch {
    // приватный режим или заблокированное хранилище — размер просто не запомнится
  }
}

/** Ручное обновление обязано обойти серверный кеш. */
function withRefreshFlag(path: string, force?: boolean) {
  if (!force) return path
  return `${path}${path.includes("?") ? "&" : "?"}refresh=1`
}

const STEP_LABELS: Record<string, { title: string; desc: string }> = {
  resolving_group: {
    title: "Проверка группы",
    desc: "Проверка выбранной группы",
  },
  loading_from_db: {
    title: "Загрузка из базы",
    desc: "Подгрузка участников и номеров из базы данных",
  },
  attaching_frida: {
    title: "Подготовка сбора",
    desc: "Настройка процесса обработки",
  },
  navigating_viber: {
    title: "Открытие списка",
    desc: "Подготовка списка участников",
  },
  paging_participants: {
    title: "Получение участников",
    desc: "Добавление найденных участников",
  },
  syncing_live_db: {
    title: "Сохранение данных",
    desc: "Фиксация полученных результатов",
  },
  restarting_viber: {
    title: "Обновление данных",
    desc: "Подготовка актуальной информации",
  },
  waiting_numbers_sync: {
    title: "Проверка контактов",
    desc: "Уточнение доступных номеров",
  },
  deduplicating_and_finalizing: {
    title: "Обработка участников",
    desc: "Обновление имен и удаление повторов",
  },
  fetching_online_activity: {
    title: "Проверка активности",
    desc: "Обновление статусов участников",
  },
  exporting_results: {
    title: "Подготовка результатов",
    desc: "Завершение сбора и формирование отчета",
  },
}

const ALL_STEPS_ORDER = [
  "resolving_group",
  "attaching_frida",
  "navigating_viber",
  "paging_participants",
  "syncing_live_db",
  "restarting_viber",
  "waiting_numbers_sync",
  "deduplicating_and_finalizing",
  "fetching_online_activity",
  "exporting_results",
]

const DB_LOAD_STEPS_ORDER = [
  "resolving_group",
  "loading_from_db",
  "syncing_live_db",
  "restarting_viber",
  "exporting_results",
]

const taskStatusBadge: Record<
  TaskStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  ready: { label: "Завершено", variant: "outline", className: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  running: { label: "В процессе", variant: "default", className: "bg-indigo-600 text-white animate-pulse" },
  initializing: { label: "Подготовка", variant: "secondary" },
  starting: { label: "Запуск", variant: "secondary" },
  stopped: { label: "Остановлено", variant: "secondary", className: "text-amber-600 dark:text-amber-400 border-amber-500/30" },
  error: { label: "Ошибка", variant: "destructive" },
}

class ViberApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ViberApiError"
    this.status = status
  }
}

function isNotFoundError(error: unknown) {
  return error instanceof ViberApiError && error.status === 404
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка"
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Ограничивает запрос по времени, не смешиваясь с внешним AbortSignal:
 * отмена извне даёт AbortError (её игнорируем), а таймаут — TimeoutError
 * (его считаем неудачей опроса).
 */
function withRequestTimeout(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (!timeoutMs) return { signal, cleanup: () => {} }

  const controller = new AbortController()
  const timer = window.setTimeout(() => {
    controller.abort(new DOMException("Превышено время ожидания ответа", "TimeoutError"))
  }, timeoutMs)

  const abortFromOuter = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) abortFromOuter()
    else signal.addEventListener("abort", abortFromOuter, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timer)
      signal?.removeEventListener("abort", abortFromOuter)
    },
  }
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: unknown
    signal?: AbortSignal
    timeoutMs?: number
  } = {}
) {
  const timeout = withRequestTimeout(options.signal, options.timeoutMs)
  let response: Response
  let text: string
  // Таймаут снимаем только после чтения тела: медленный ответ тоже не должен висеть вечно
  try {
    response = await fetch(`/api/viber/${path}`, {
      method: options.method ?? "GET",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      signal: timeout.signal,
    })
    text = await response.text()
  } finally {
    timeout.cleanup()
  }

  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { error: text }
    }
  }

  if (!response.ok) {
    const apiError = payload as { error?: string; message?: string } | null
    throw new ViberApiError(
      apiError?.error || apiError?.message || `Ошибка запроса (${response.status})`,
      response.status
    )
  }

  return payload as T
}

function groupName(group: ViberGroup) {
  return group.name || group.groupName || `Чат ${group.conversationId}`
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours} ч ${minutes} мин ${seconds} сек`
  if (minutes > 0) return `${minutes} мин ${seconds} сек`
  return `${seconds} сек`
}

function formatDigitalTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

function formatLastSeen(lastSeen?: string | null): string {
  if (!lastSeen) return "—"
  try {
    const d = new Date(lastSeen)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export interface ViberParserPanelProps {
  deviceId?: string
}

export function ViberParserPanel({ deviceId }: ViberParserPanelProps = {}) {
  const [activeTab, setActiveTab] = React.useState<"collect" | "database" | "history">("collect")

  const withDevice = React.useCallback(
    (path: string) => {
      if (!deviceId) return path
      const separator = path.includes("?") ? "&" : "?"
      return `${path}${separator}deviceId=${encodeURIComponent(deviceId)}`
    },
    [deviceId]
  )

  // Состояние парсера и активной задачи
  const [status, setStatus] = React.useState<ViberParserStatus | null>(null)
  const [statusLoading, setStatusLoading] = React.useState(true)
  const [activeTaskDetail, setActiveTaskDetail] = React.useState<TaskDetailDto | null>(null)

  // Связь с сервисом: обрыв опроса не равен ошибке сервиса
  const [connection, setConnection] = React.useState<ConnectionTracker>(INITIAL_CONNECTION)
  const [connectionNow, setConnectionNow] = React.useState(() => Date.now())
  /** Растёт, когда финальные детали задачи получены запросом (а не выведены из SSE). */
  const [finalFetchTick, setFinalFetchTick] = React.useState(0)

  // Параметры сбора
  const [groups, setGroups] = React.useState<ViberGroup[]>([])
  const [groupsLoading, setGroupsLoading] = React.useState(true)
  const [groupsError, setGroupsError] = React.useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)
  const [restartAppAfterCollect, setRestartAppAfterCollect] = React.useState(true)
  const [twoPassCollect, setTwoPassCollect] = React.useState(true)
  const [isStartingCollect, setIsStartingCollect] = React.useState(false)
  const [isFastLoading, setIsFastLoading] = React.useState(false)
  const [isStoppingTask, setIsStoppingTask] = React.useState(false)
  const [syncingGroupId, setSyncingGroupId] = React.useState<string | null>(null)

  // Участники
  const [members, setMembers] = React.useState<ViberMembersResponse | null>(null)
  const [membersLoading, setMembersLoading] = React.useState(false)
  const [membersError, setMembersError] = React.useState<string | null>(null)
  const [membersSource, setMembersSource] = React.useState<"supabase" | "emulator">("supabase")
  const [memberSearchQuery, setMemberSearchQuery] = React.useState("")
  const [memberRoleFilter, setMemberRoleFilter] = React.useState<
    "all" | "decoded" | "undecoded" | "online" | "recent_24h" | "recent_7d" | "admins"
  >("all")
  const [memberSort, setMemberSort] = React.useState<
    "activity" | "phone" | "name" | "role" | "default"
  >("activity")
  const [hideDuplicates, setHideDuplicates] = React.useState(true)
  const [membersPage, setMembersPage] = React.useState(1)
  const [membersPageSize, setMembersPageSize] = React.useState(DEFAULT_MEMBERS_PAGE_SIZE)

  // База данных
  const [dbStats, setDbStats] = React.useState<DatabaseStatsDto | null>(null)
  const [dbStatsLoading, setDbStatsLoading] = React.useState(false)
  const [isSyncingDb, setIsSyncingDb] = React.useState(false)
  const [isDecodingDb, setIsDecodingDb] = React.useState(false)
  const [lastDecodeResult, setLastDecodeResult] = React.useState<ViberDecodeResponse | null>(null)

  // История задач
  const [tasks, setTasks] = React.useState<TaskSummaryDto[]>([])
  const [tasksLoading, setTasksLoading] = React.useState(false)
  const [selectedHistoryTask, setSelectedHistoryTask] = React.useState<TaskDetailDto | null>(null)
  const [historyTaskModalOpen, setHistoryTaskModalOpen] = React.useState(false)

  // Идентификатор отслеживаемой задачи держим в ref, чтобы цикл опроса
  // не перезапускался на каждое обновление деталей.
  const trackedTaskIdRef = React.useRef<string | null>(null)
  /** Задача, которая актуальна прямо сейчас: снимки других задач игнорируем. */
  const desiredTaskIdRef = React.useRef<string | null>(null)
  const loadedDetailIdRef = React.useRef<string | null>(null)
  /** Задача, карточку которой пользователь скрыл кнопкой «Скрыть». */
  const hiddenTaskIdRef = React.useRef<string | null>(null)
  const selectedGroupIdRef = React.useRef<string | null>(null)
  const detailTaskIdRef = React.useRef<string | null>(null)
  const detailAbortRef = React.useRef<AbortController | null>(null)
  /** Задачи, для которых финальные детали уже получены ЗАПРОСОМ (не выведены из SSE). */
  const finalizedTasksRef = React.useRef<Set<string>>(new Set())
  const finalizingTasksRef = React.useRef<Set<string>>(new Set())
  const seenRunningTasksRef = React.useRef<Set<string>>(new Set())
  const reactedTasksRef = React.useRef<Set<string>>(new Set())
  const mountedRef = React.useRef(true)
  /**
   * Отмена дотягивания финальных деталей живёт на уровне компонента.
   * К жизненному циклу SSE-эффекта её привязывать нельзя: этот эффект
   * демонтируется ровно в тот момент, когда дотягивание и запускается
   * (задача стала терминальной), и цикл повторов умирал, не начавшись.
   */
  const finalizeAbortRef = React.useRef<AbortController | null>(null)

  const finalizeSignal = React.useCallback(() => {
    if (!finalizeAbortRef.current) finalizeAbortRef.current = new AbortController()
    return finalizeAbortRef.current.signal
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      detailAbortRef.current?.abort()
      finalizeAbortRef.current?.abort()
    }
  }, [])

  /** Задачи на бэкенде больше нет (рестарт сервиса, реестр в памяти). */
  const clearTrackedTask = React.useCallback(() => {
    trackedTaskIdRef.current = null
    desiredTaskIdRef.current = null
    loadedDetailIdRef.current = null
    hiddenTaskIdRef.current = null
    setActiveTaskDetail(null)
  }, [])

  const applyDetail = React.useCallback((detail: TaskDetailDto) => {
    if (!mountedRef.current) return
    // Поздний ответ по уже неактуальной задаче не должен подменять текущую
    if (desiredTaskIdRef.current && desiredTaskIdRef.current !== detail.id) return

    // Учёт ведём всегда, даже для скрытой карточки: иначе задача никогда не
    // будет считаться дотянутой и фоновый опрос продолжит дёргать её вечно.
    trackedTaskIdRef.current = detail.id
    loadedDetailIdRef.current = detail.id
    if (isTerminalTaskStatus(detail.status)) {
      finalizedTasksRef.current.add(detail.id)
      setFinalFetchTick((tick) => tick + 1)
    } else {
      seenRunningTasksRef.current.add(detail.id)
    }

    // На экран скрытую пользователем задачу не возвращаем
    if (hiddenTaskIdRef.current === detail.id) return
    setActiveTaskDetail((prev) => mergeTaskDetail(prev, detail, desiredTaskIdRef.current))
  }, [])

  // 1a. Детали задачи: единственный источник полной истории шагов
  const fetchTaskDetail = React.useCallback(
    async (taskId: string, signal?: AbortSignal) => {
      const detail = await request<TaskDetailDto>(withDevice(`tasks/${taskId}`), {
        signal,
        timeoutMs: TASK_DETAIL_REQUEST_TIMEOUT_MS,
      })
      applyDetail(detail)
      return detail
    },
    [applyDetail, withDevice]
  )

  const refreshTaskDetailQuiet = React.useCallback(
    async (taskId: string) => {
      if (detailTaskIdRef.current) {
        // По той же задаче запрос уже летит — второй не нужен;
        // по другой — старый ответ уже неинтересен, отменяем его.
        if (detailTaskIdRef.current === taskId) return
        detailAbortRef.current?.abort()
      }

      const controller = new AbortController()
      detailAbortRef.current = controller
      detailTaskIdRef.current = taskId
      try {
        await fetchTaskDetail(taskId, controller.signal)
      } catch (error) {
        if (isNotFoundError(error) && trackedTaskIdRef.current === taskId) {
          // Задача исчезла (рестарт сервиса) — перестаём её опрашивать
          clearTrackedTask()
        }
        // Иначе детали дотянем следующим опросом, последнее состояние сохраняем
      } finally {
        if (detailAbortRef.current === controller) {
          detailAbortRef.current = null
          detailTaskIdRef.current = null
        }
      }
    },
    [clearTrackedTask, fetchTaskDetail]
  )

  // 1. Опрос статуса сессии
  const refreshStatus = React.useCallback(
    async (background = false, signal?: AbortSignal) => {
      if (!background) setStatusLoading(true)
      // Снимок отслеживаемой задачи до запроса: пока ответ идёт, пользователь
      // мог запустить сбор, и устаревший ответ не должен его стереть.
      const desiredBefore = desiredTaskIdRef.current
      let nextStatus: ViberParserStatus | null = null
      try {
        const received = await request<ViberParserStatus>(withDevice("status"), {
          signal,
          timeoutMs: STATUS_REQUEST_TIMEOUT_MS,
        })
        setConnection(markConnectionOk(Date.now()))
        setConnectionNow(Date.now())

        if (desiredTaskIdRef.current !== desiredBefore) {
          // Ответ относится к состоянию «до» смены задачи. Учёт задачи не трогаем,
          // но здоровье сервиса в нём актуально — иначе панель ещё цикл показывает
          // «выполняется» для задачи, которой уже нет на экране.
          nextStatus = null
          setStatus((prev) =>
            prev
              ? {
                  ...prev,
                  state: received.state,
                  isDriverActive: received.isDriverActive,
                  error: received.error ?? null,
                }
              : prev
          )
        } else {
          nextStatus = received
          setStatus(received)
          if (received.taskId) {
            trackedTaskIdRef.current = received.taskId
            desiredTaskIdRef.current = received.taskId
            if (!isTerminalTaskStatus(received.latestTaskStatus ?? null)) {
              seenRunningTasksRef.current.add(received.taskId)
            }
          } else if (trackedTaskIdRef.current) {
            // Сервис отвечает, но задач у него нет — реестр обнулился (рестарт API)
            clearTrackedTask()
          }
        }
      } catch (error) {
        // Обрыв или таймаут: статус не трогаем, отмечаем потерю связи
        if (!isAbortError(error)) {
          const message = errorMessage(error)
          setConnection((prev) => markConnectionFailure(prev, message))
          setConnectionNow(Date.now())
        }
      } finally {
        if (!background && !signal?.aborted) setStatusLoading(false)
      }

      // Детали обновляем даже если статус не пришёл — иначе прогресс
      // этапов замирает навсегда после первой же неудачи опроса.
      const targetTaskId = nextStatus?.taskId || trackedTaskIdRef.current
      if (!targetTaskId) return

      // Завершённую и уже дотянутую задачу нет смысла перезапрашивать
      const backendTerminal = isTerminalTaskStatus(nextStatus?.latestTaskStatus ?? null)
      const alreadyFinalized = finalizedTasksRef.current.has(targetTaskId)
      if (background && alreadyFinalized && (backendTerminal || nextStatus === null)) return

      if (background) {
        void refreshTaskDetailQuiet(targetTaskId)
      } else {
        await refreshTaskDetailQuiet(targetTaskId)
      }
    },
    [clearTrackedTask, refreshTaskDetailQuiet, withDevice]
  )

  // 2. Загрузка групп
  const refreshGroups = React.useCallback(async (signal?: AbortSignal, options: { force?: boolean } = {}) => {
    setGroupsLoading(true)
    try {
      // Инстанс работает только с группами, открытыми на его эмуляторе: собрать
      // участников или включить мониторинг для архивной записи нельзя. Общая
      // страница без инстанса по-прежнему показывает полный список с архивом.
      const path = deviceId ? "groups?onDevice=true" : "groups"
      const response = await request<ViberGroupsResponse>(
        withDevice(withRefreshFlag(path, options.force)),
        { signal }
      )
      setGroups(response.groups)
      setGroupsError(null)
      setSelectedGroupId((current) => {
        if (current && response.groups.some((group) => String(group.conversationId) === current)) {
          return current
        }
        return response.groups[0] ? String(response.groups[0].conversationId) : null
      })
    } catch (error) {
      if (!isAbortError(error)) {
        const publicMessage = instanceUnavailableMessage()
        setGroups([])
        setGroupsError(publicMessage)
        toast.error("Не удалось загрузить группы", {
          description: publicMessage,
        })
      }
    } finally {
      if (!signal?.aborted) setGroupsLoading(false)
    }
  }, [deviceId, withDevice])

  // 3. Загрузка участников группы
  const refreshMembers = React.useCallback(async (
    groupId: string,
    signal?: AbortSignal,
    options: { force?: boolean; source?: "supabase" | "emulator" } = {}
  ) => {
    setMembersLoading(true)
    setMembersError(null)
    const effectiveSource = options.source ?? membersSource
    try {
      const qParams = new URLSearchParams()
      if (options.force) qParams.set("refresh", "1")
      if (effectiveSource) qParams.set("source", effectiveSource)
      const q = qParams.toString() ? `?${qParams.toString()}` : ""
      const response = await request<ViberMembersResponse>(
        withDevice(`groups/${groupId}/members${q}`),
        { signal }
      )
      setMembers(response)
    } catch (error) {
      if (!isAbortError(error)) {
        setMembers(null)
        setMembersError(errorMessage(error))
      }
    } finally {
      if (!signal?.aborted) setMembersLoading(false)
    }
  }, [withDevice, membersSource])

  // 4. Загрузка статистики базы данных
  const refreshDbStats = React.useCallback(async (signal?: AbortSignal, options: { force?: boolean } = {}) => {
    setDbStatsLoading(true)
    try {
      const stats = await request<DatabaseStatsDto>(
        withDevice(withRefreshFlag("database/stats", options.force)),
        { signal }
      )
      setDbStats(stats)
    } catch {
      // ignore
    } finally {
      if (!signal?.aborted) setDbStatsLoading(false)
    }
  }, [withDevice])

  // 5. Загрузка истории задач
  const refreshTasks = React.useCallback(async (signal?: AbortSignal) => {
    setTasksLoading(true)
    try {
      const list = await request<TaskSummaryDto[]>(withDevice("tasks"), { signal })
      setTasks(list)
    } catch {
      // ignore
    } finally {
      if (!signal?.aborted) setTasksLoading(false)
    }
  }, [withDevice])



  // 7. Дотягивание финального состояния задачи.
  // Как только задача перешла в терминальный статус, повторяем запрос деталей,
  // пока не получим её финальный stepHistory — иначе на экране остаются
  // только первые шаги.
  const ensureFinalDetail = React.useCallback(
    async (taskId: string, signal?: AbortSignal) => {
      if (finalizedTasksRef.current.has(taskId)) return
      if (finalizingTasksRef.current.has(taskId)) return
      finalizingTasksRef.current.add(taskId)
      try {
        for (let attempt = 0; attempt < FINALIZE_ATTEMPTS; attempt += 1) {
          if (signal?.aborted || !mountedRef.current) return
          try {
            const detail = await fetchTaskDetail(taskId, signal)
            if (isTerminalTaskStatus(detail.status)) return
          } catch (error) {
            if (isAbortError(error)) return
            if (isNotFoundError(error)) {
              if (trackedTaskIdRef.current === taskId) clearTrackedTask()
              return
            }
          }
          await delay(FINALIZE_RETRY_MS * (attempt + 1))
        }
      } finally {
        finalizingTasksRef.current.delete(taskId)
      }
    },
    [clearTrackedTask, fetchTaskDetail]
  )

  // Периодический опрос: цикл не должен умирать ни при какой ошибке
  React.useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined
    const poll = async () => {
      try {
        await refreshStatus(true)
      } catch {
        // refreshStatus и так не бросает, но цикл опроса обрывать нельзя
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, STATUS_POLL_MS)
      }
    }
    void refreshStatus(false)
    timeoutId = window.setTimeout(poll, STATUS_POLL_MS)
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [refreshStatus])

  // Пересчёт «свежести» связи между опросами
  React.useEffect(() => {
    const intervalId = window.setInterval(() => setConnectionNow(Date.now()), CONNECTION_TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [])

  // Инициализация при монтировании
  React.useEffect(() => {
    void refreshGroups()
    void refreshDbStats()
    void refreshTasks()
  }, [refreshGroups, refreshDbStats, refreshTasks])

  // Загрузка участников при выборе группы
  React.useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId
    if (!selectedGroupId) return
    void refreshMembers(selectedGroupId, undefined, { source: membersSource })
  }, [selectedGroupId, membersSource, refreshMembers])

  const trackedTaskId = status?.taskId ?? activeTaskDetail?.id ?? null
  const trackedTaskTerminal =
    !!trackedTaskId &&
    ((activeTaskDetail?.id === trackedTaskId && isTerminalTaskStatus(activeTaskDetail?.status)) ||
      (status?.taskId === trackedTaskId && isTerminalTaskStatus(status?.latestTaskStatus ?? null)))

  // SSE стриминг для активной задачи: обрыв потока не должен «замораживать»
  // прогресс — переподключаемся с backoff и перезапрашиваем детали.
  React.useEffect(() => {
    if (!trackedTaskId || trackedTaskTerminal) return

    let stopped = false
    let attempts = 0
    // 0 = соединение так и не открылось; проставляется только в onopen
    let openedAt = 0
    let retryTimer: number | undefined
    let source: EventSource | null = null

    const connect = () => {
      if (stopped) return
      const eventSource = new EventSource(`/api/viber/${withDevice(`tasks/${trackedTaskId}/events`)}`)
      source = eventSource
      openedAt = 0

      eventSource.onopen = () => {
        openedAt = Date.now()
      }

      eventSource.onmessage = (event) => {
        // Успешным считаем поток, который реально что-то прислал: открыться и
        // тут же закрыться (например, задачи уже нет) — это не успех.
        attempts = 0
        try {
          const payload = JSON.parse(event.data) as TaskEventPayload
          if (loadedDetailIdRef.current === trackedTaskId) {
            setActiveTaskDetail((prev) => applyTaskEvent(prev, payload))
          } else {
            // Событие пришло раньше, чем детали задачи — забираем их запросом
            void refreshTaskDetailQuiet(trackedTaskId)
          }
          if (payload.status && !isTerminalTaskStatus(payload.status)) {
            seenRunningTasksRef.current.add(trackedTaskId)
          }
          if (isTerminalTaskStatus(payload.status ?? null)) {
            void ensureFinalDetail(trackedTaskId, finalizeSignal())
          }
        } catch {
          // некорректный JSON игнорируем
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        if (stopped) return
        // Долгий шаг (например, ожидание сетевой синхронизации) не присылает
        // событий минутами: прожившее достаточно соединение считаем рабочим,
        // иначе idle-таймаут тихо съест все попытки.
        if (openedAt > 0 && Date.now() - openedAt >= SSE_HEALTHY_MS) attempts = 0
        // Поток мог оборваться, а мог закончиться вместе с задачей —
        // в обоих случаях сначала перезапрашиваем актуальные детали.
        void refreshTaskDetailQuiet(trackedTaskId)
        attempts += 1
        if (attempts > SSE_MAX_ATTEMPTS) return
        const backoff = Math.min(SSE_RETRY_BASE_MS * 2 ** (attempts - 1), SSE_RETRY_MAX_MS)
        retryTimer = window.setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      stopped = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      source?.close()
    }
  }, [trackedTaskId, trackedTaskTerminal, refreshTaskDetailQuiet, ensureFinalDetail, finalizeSignal, withDevice])

  // Задача завершилась — обязательно дотягиваем финальный stepHistory
  React.useEffect(() => {
    if (!trackedTaskId || !trackedTaskTerminal) return
    void ensureFinalDetail(trackedTaskId, finalizeSignal())
  }, [trackedTaskId, trackedTaskTerminal, ensureFinalDetail, finalizeSignal])

  // Реакция на завершение задачи — ровно один раз и только по снимку,
  // в котором уже есть итог: у снимка, собранного из событий SSE, result пустой.
  React.useEffect(() => {
    const detail = activeTaskDetail
    if (!detail) return
    if (reactedTasksRef.current.has(detail.id)) return
    if (!isCompletionAnnounceable(detail, finalizedTasksRef.current.has(detail.id))) return
    reactedTasksRef.current.add(detail.id)

    const wasRunning = Boolean(seenRunningTasksRef.current.delete(detail.id))
    if (wasRunning) {
      const notice = describeTaskCompletion(detail)
      if (notice) {
        const options = notice.description ? { description: notice.description } : undefined
        if (notice.kind === "success") toast.success(notice.title, options)
        else if (notice.kind === "info") toast.info(notice.title, options)
        else toast.error(notice.title, options)
      }
    }

    // Автоматическая выгрузка в Supabase при успешном завершении задачи сбора (только если задача реально выполнялась в этой сессии)
    if (wasRunning && detail.status === "ready") {
      const syncTaskToSupabase = async () => {
        try {
          const syncRes = await request<UsersSyncResult>(withDevice(`users/sync/task/${detail.id}`), {
            method: "POST",
          })
          if (syncRes.success) {
            toast.success("Участники выгружены в базу данных (Supabase)", {
              description: `Синхронизировано ${syncRes.usersUpserted} уч. для группы «${syncRes.group || detail.result?.group || ""}»`,
            })
          }
        } catch (err: unknown) {
          console.warn("Auto-sync to Supabase warning:", err)
        } finally {
          void refreshTasks()
          void refreshGroups(undefined, { force: true })
          if (selectedGroupIdRef.current) {
            void refreshMembers(selectedGroupIdRef.current, undefined, { force: true })
          }
          void refreshDbStats(undefined, { force: true })
        }
      }
      void syncTaskToSupabase()
    } else if (wasRunning) {
      // Данные только что изменились — читаем мимо серверного кеша
      void refreshTasks()
      void refreshGroups(undefined, { force: true })
      if (selectedGroupIdRef.current) {
        void refreshMembers(selectedGroupIdRef.current, undefined, { force: true })
      }
    }
  }, [activeTaskDetail, finalFetchTick, refreshDbStats, refreshGroups, refreshMembers, refreshTasks, request, withDevice])

  const handleManualSyncToDb = React.useCallback(
    async (conversationId: number, groupTitle?: string | null) => {
      setSyncingGroupId(String(conversationId))
      try {
        const res = await request<UsersSyncResult>(withDevice(`users/sync/group/${conversationId}`), {
          method: "POST",
        })
        if (res.success) {
          toast.success(`Группа «${groupTitle || res.group || conversationId}» выгружена в базу данных`, {
            description: `Записано/обновлено ${res.usersUpserted} участников в Supabase`,
          })
        }
        await refreshGroups(undefined, { force: true })
        await refreshDbStats(undefined, { force: true })
        if (selectedGroupIdRef.current) {
          await refreshMembers(selectedGroupIdRef.current, undefined, { force: true })
        }
      } catch (err: unknown) {
        toast.error(`Ошибка выгрузки в базу данных: ${errorMessage(err)}`)
      } finally {
        setSyncingGroupId(null)
      }
    },
    [refreshDbStats, refreshGroups, refreshMembers, request, withDevice]
  )

  const selectedGroup = React.useMemo(
    () => groups.find((g) => String(g.conversationId) === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  )

  // Запуск сбора участников
  const handleStartCollect = async () => {
    if (!selectedGroup) {
      toast.error("Выберите группу для сбора участников")
      return
    }

    setIsStartingCollect(true)
    try {
      const target = selectedGroup.name || String(selectedGroup.conversationId)

      const result = await request<{ taskId: string; message: string }>("participants/collect", {
        method: "POST",
        body: {
          group: target,
          restartApp: restartAppAfterCollect,
          twoPass: twoPassCollect,
          passesCount: twoPassCollect ? 5 : 1,
          allowPartial: true,
          deviceId: deviceId || undefined,
        },
      })

      if (result.taskId) {
        // С этого момента актуальна новая задача: поздние ответы по старой игнорируем
        desiredTaskIdRef.current = result.taskId
        trackedTaskIdRef.current = result.taskId
        loadedDetailIdRef.current = null
        hiddenTaskIdRef.current = null
        seenRunningTasksRef.current.add(result.taskId)
        setActiveTaskDetail(null)
      }

      toast.success("Сбор запущен", {
        description: `Задача ${result.taskId} зарегистрирована. Наблюдайте прогресс на шагах ниже.`,
      })

      await refreshStatus(true)
      await refreshTasks()
    } catch (err) {
      toast.error("Не удалось запустить сбор", { description: errorMessage(err) })
    } finally {
      setIsStartingCollect(false)
    }
  }

  // Быстрая подгрузка участников из базы данных
  const handleFastLoadFromDb = async () => {
    if (!selectedGroup) {
      toast.error("Выберите группу для загрузки участников")
      return
    }

    setIsFastLoading(true)
    try {
      const target = selectedGroup.name || String(selectedGroup.conversationId)

      const result = await request<{ taskId: string; message: string }>("participants/load-from-db", {
        method: "POST",
        body: {
          group: target,
          restartApp: restartAppAfterCollect,
          allowPartial: true,
          fromDatabaseOnly: true,
          deviceId: deviceId || undefined,
        },
      })

      if (result.taskId) {
        desiredTaskIdRef.current = result.taskId
        trackedTaskIdRef.current = result.taskId
        loadedDetailIdRef.current = null
        hiddenTaskIdRef.current = null
        seenRunningTasksRef.current.add(result.taskId)
        setActiveTaskDetail(null)
      }

      toast.success("Загрузка из базы запущена", {
        description: `Задача ${result.taskId} зарегистрирована. Подгрузка данных займет несколько секунд.`,
      })

      await refreshStatus(true)
      await refreshTasks()
    } catch (err) {
      toast.error("Не удалось загрузить участников из базы", { description: errorMessage(err) })
    } finally {
      setIsFastLoading(false)
    }
  }

  // Остановка задачи
  const handleStopTask = async () => {
    setIsStoppingTask(true)
    try {
      if (status?.taskId) {
        await request(withDevice(`tasks/${status.taskId}/stop`), { method: "POST" })
      } else {
        await request(withDevice("stop"), { method: "POST" })
      }
      toast.info("Сигнал остановки отправлен")
      await refreshStatus(true)
      await refreshTasks()
    } catch (err) {
      toast.error("Не удалось остановить задачу", { description: errorMessage(err) })
    } finally {
      setIsStoppingTask(false)
    }
  }

  // Синхронизация БД
  const handleSyncDatabase = async () => {
    setIsSyncingDb(true)
    try {
      await request<{ message: string; conversationsCount?: number }>("database/sync", {
        method: "POST",
        body: { deviceId: deviceId || undefined },
      })
      toast.success("Данные успешно обновлены")
      await refreshDbStats(undefined, { force: true })
      await refreshGroups(undefined, { force: true })
      if (selectedGroupId) await refreshMembers(selectedGroupId, undefined, { force: true })
    } catch {
      toast.error("Не удалось обновить данные")
    } finally {
      setIsSyncingDb(false)
    }
  }

  // Дешифровка БД
  const handleDecodeDatabase = async (limit?: number) => {
    setIsDecodingDb(true)
    try {
      const res = await request<ViberDecodeResponse>("database/decode", {
        method: "POST",
        body: {
          limit,
          restartApp: true,
          waitForSyncSeconds: 10,
          deviceId: deviceId || undefined,
        },
      })
      setLastDecodeResult(res)
      toast.success("Синхронизация телефонов завершена", {
        description: `Синхронизировано: ${res.decodedCount}. Всего обработано: ${res.read}.`,
      })
      await refreshDbStats(undefined, { force: true })
      await refreshGroups(undefined, { force: true })
      if (selectedGroupId) await refreshMembers(selectedGroupId, undefined, { force: true })
    } catch {
      toast.error("Не удалось синхронизировать телефоны")
    } finally {
      setIsDecodingDb(false)
    }
  }



  // Экспорт участников
  const handleExportJson = () => {
    if (!filteredMembers.length) return
    const exportData = filteredMembers.map((m, idx) => ({
      "№": idx + 1,
      "Имя": m.name ?? "",
      "Номер телефона": m.phoneNumber ?? m.rawNumber ?? "",
      "Роль": m.roleLabel ?? "",
      "Дата последнего визита": m.isOnline ? "В сети" : m.lastSeen ? formatLastSeen(m.lastSeen) : "",
    }))
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `participants-${selectedGroupId ?? "group"}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Файл JSON сохранен (${filteredMembers.length} записей)`)
  }

  const handleExportTxt = () => {
    if (!filteredMembers.length) return
    const lines = filteredMembers.map((m, idx) => {
      const num = `${idx + 1}.`
      const name = m.name ?? "—"
      const phone = m.phoneNumber || m.rawNumber || "Без номера"
      const role = m.roleLabel ?? "—"
      const lastVisit = m.isOnline ? "В сети" : m.lastSeen ? formatLastSeen(m.lastSeen) : "—"
      return `${num.padEnd(5)} ${name.padEnd(25)} ${phone.padEnd(18)} ${role.padEnd(14)} ${lastVisit}`
    })
    const header = `${"№".padEnd(5)} ${"Имя".padEnd(25)} ${"Номер телефона".padEnd(18)} ${"Роль".padEnd(14)} Дата последнего визита`
    const separator = "─".repeat(header.length)
    const content = [header, separator, ...lines].join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `participants-${selectedGroupId ?? "group"}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Файл TXT сохранен (${filteredMembers.length} записей)`)
  }

  const handleExportCsv = () => {
    if (!filteredMembers.length) return
    const escapeCell = (val: unknown) => {
      const str = val === null || val === undefined ? "" : String(val)
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r") || str.includes(";")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const headers = [
      "№",
      "Имя",
      "Номер телефона",
      "Роль",
      "Дата последнего визита",
    ]

    const rows = filteredMembers.map((m, idx) => {
      const lastVisit = m.isOnline ? "В сети" : m.lastSeen ? formatLastSeen(m.lastSeen) : ""
      return [
        idx + 1,
        m.name ?? "",
        m.phoneNumber ?? m.rawNumber ?? "",
        m.roleLabel ?? "",
        lastVisit,
      ]
        .map(escapeCell)
        .join(",")
    })

    const csvContent = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `participants-${selectedGroupId ?? "group"}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Файл CSV сохранен (${filteredMembers.length} записей)`)
  }

  const handleCopyPhones = () => {
    if (!filteredMembers.length) return
    const uniquePhones = Array.from(
      new Set(
        filteredMembers
          .map((m) => m.phoneNumber)
          .filter((p) => p && !p.toLowerCase().startsWith("em") && p !== "Ожидает дешифровки")
      )
    )
    if (!uniquePhones.length) {
      toast.warning("Нет открытых номеров для копирования")
      return
    }
    navigator.clipboard.writeText(uniquePhones.join("\n"))
    toast.success(`Скопировано ${uniquePhones.length} уникальных номеров в буфер обмена`)
  }

  const handleMembersSourceChange = (newSource: "supabase" | "emulator") => {
    setMembersSource(newSource)
    if (selectedGroupId) {
      void refreshMembers(selectedGroupId, undefined, { source: newSource })
    }
  }

  // Сводные метрики участников группы
  const totalMembersCount = members?.count ?? members?.members.length ?? 0
  const decodedMembersCount = React.useMemo(() => {
    return (members?.members ?? []).filter(
      (m) =>
        m.isDecoded ??
        (!m.phoneNumber.toLowerCase().startsWith("em") && m.phoneNumber !== "Ожидает дешифровки")
    ).length
  }, [members])
  const decodedPercent =
    totalMembersCount > 0 ? ((decodedMembersCount / totalMembersCount) * 100).toFixed(1) : "0"
  const onlineMembersCount = React.useMemo(() => {
    return (members?.members ?? []).filter((m) => m.isOnline).length
  }, [members])
  const adminsCount = React.useMemo(() => {
    return (members?.members ?? []).filter(
      (m) => m.roleLabel === "admin" || m.roleLabel === "superadmin"
    ).length
  }, [members])

  // Фильтрация, сортировка и дедупликация участников
  const filteredMembers = React.useMemo(() => {
    const list = members?.members ?? []
    const q = memberSearchQuery.trim().toLowerCase()

    const filtered = list.filter((m) => {
      // Role / decoded / online filter
      const isDecoded =
        m.isDecoded ??
        (!m.phoneNumber.toLowerCase().startsWith("em") &&
          m.phoneNumber !== "Ожидает дешифровки")

      if (memberRoleFilter === "decoded" && !isDecoded) return false
      if (memberRoleFilter === "undecoded" && isDecoded) return false
      if (memberRoleFilter === "admins" && m.roleLabel !== "admin" && m.roleLabel !== "superadmin")
        return false
      if (memberRoleFilter === "online" && !m.isOnline) return false

      if (memberRoleFilter === "recent_24h") {
        if (m.isOnline) {
          // Онлайн считается активным
        } else if (m.lastSeen) {
          const t = Date.parse(m.lastSeen)
          if (isNaN(t) || Date.now() - t > 24 * 3600 * 1000) return false
        } else {
          return false
        }
      }

      if (memberRoleFilter === "recent_7d") {
        if (m.isOnline) {
          // Онлайн считается активным
        } else if (m.lastSeen) {
          const t = Date.parse(m.lastSeen)
          if (isNaN(t) || Date.now() - t > 7 * 24 * 3600 * 1000) return false
        } else {
          return false
        }
      }

      if (!q) return true
      const phoneMatch = m.phoneNumber.toLowerCase().includes(q)
      const nameMatch = m.name ? m.name.toLowerCase().includes(q) : false
      const rawMatch = m.rawNumber ? m.rawNumber.toLowerCase().includes(q) : false
      const idMatch = m.memberId ? m.memberId.toLowerCase().includes(q) : false
      return phoneMatch || nameMatch || rawMatch || idMatch
    })

    // Дедупликация
    let workingList = filtered
    if (hideDuplicates) {
      const seenPhones = new Set<string>()
      const seenMemberIds = new Set<string>()
      const result: typeof filtered = []

      for (const m of filtered) {
        let normPhone: string | null = null
        const rawP = m.phoneNumber || m.rawNumber
        if (rawP && !rawP.toLowerCase().startsWith("em") && rawP !== "Ожидает дешифровки") {
          const digits = rawP.replace(/[^\d+]/g, "")
          if (digits) {
            normPhone = digits.startsWith("+") ? digits : `+${digits}`
          }
        }

        const memId = m.memberId?.trim() && !m.memberId.startsWith("em:") ? m.memberId.trim() : null

        if (normPhone && seenPhones.has(normPhone)) {
          continue
        }
        if (memId && seenMemberIds.has(memId)) {
          continue
        }

        if (normPhone) seenPhones.add(normPhone)
        if (memId) seenMemberIds.add(memId)
        result.push(m)
      }
      workingList = result
    }

    // Сортировка
    return [...workingList].sort((a, b) => {
      if (memberSort === "activity") {
        if (a.isOnline && !b.isOnline) return -1
        if (!a.isOnline && b.isOnline) return 1
        const aTime = a.lastSeen ? Date.parse(a.lastSeen) : 0
        const bTime = b.lastSeen ? Date.parse(b.lastSeen) : 0
        return bTime - aTime
      }
      if (memberSort === "phone") {
        const aDecoded =
          a.isDecoded ??
          (!a.phoneNumber.toLowerCase().startsWith("em") && a.phoneNumber !== "Ожидает дешифровки")
        const bDecoded =
          b.isDecoded ??
          (!b.phoneNumber.toLowerCase().startsWith("em") && b.phoneNumber !== "Ожидает дешифровки")
        if (aDecoded && !bDecoded) return -1
        if (!aDecoded && bDecoded) return 1
        return (a.phoneNumber || "").localeCompare(b.phoneNumber || "")
      }
      if (memberSort === "name") {
        const aName = a.name?.trim() || ""
        const bName = b.name?.trim() || ""
        if (aName && !bName) return -1
        if (!aName && bName) return 1
        return aName.localeCompare(bName, "ru", { sensitivity: "base" })
      }
      if (memberSort === "role") {
        const roleRank = (role?: string) => (role === "superadmin" ? 1 : role === "admin" ? 2 : 3)
        return roleRank(a.roleLabel) - roleRank(b.roleLabel)
      }
      return 0
    })
  }, [members, memberSearchQuery, memberRoleFilter, memberSort, hideDuplicates])

  // Размер страницы читаем уже на клиенте: на сервере хранилища нет,
  // а расхождение разметки при гидратации нам не нужно.
  React.useEffect(() => {
    const stored = readStoredMembersPageSize()
    if (stored !== null) setMembersPageSize(stored)
  }, [])

  // Новый набор строк всегда показываем с первой страницы
  React.useEffect(() => {
    setMembersPage(1)
  }, [members, memberSearchQuery, memberRoleFilter, memberSort, hideDuplicates, selectedGroupId])

  const membersTotalPages = Math.max(1, Math.ceil(filteredMembers.length / membersPageSize))
  // Список мог сократиться под текущей страницей — подрезаем её при рендере,
  // не дожидаясь эффекта, иначе один кадр таблица будет пустой.
  const membersCurrentPage = Math.min(membersPage, membersTotalPages)
  const membersOffset = (membersCurrentPage - 1) * membersPageSize
  const membersRangeStart = filteredMembers.length === 0 ? 0 : membersOffset + 1
  const membersRangeEnd = Math.min(membersOffset + membersPageSize, filteredMembers.length)

  const [jumpPageInput, setJumpPageInput] = React.useState(String(membersCurrentPage))
  React.useEffect(() => {
    setJumpPageInput(String(membersCurrentPage))
  }, [membersCurrentPage])

  const pagedMembers = React.useMemo(
    () => filteredMembers.slice(membersOffset, membersOffset + membersPageSize),
    [filteredMembers, membersOffset, membersPageSize]
  )

  React.useEffect(() => {
    setMembersPage((current) => (current > membersTotalPages ? membersTotalPages : current))
  }, [membersTotalPages])

  const handleMembersPageSizeChange = (value: string) => {
    const size = Number.parseInt(value, 10)
    if (!MEMBERS_PAGE_SIZE_OPTIONS.some((option) => option === size)) return
    setMembersPageSize(size)
    setMembersPage(1)
    storeMembersPageSize(size)
  }

  const isTaskRunning =
    (status?.state === "RUNNING" || status?.state === "INITIALIZING") &&
    activeTaskDetail?.status !== "ready" &&
    activeTaskDetail?.status !== "stopped" &&
    activeTaskDetail?.status !== "error"

  const connectionState = deriveConnectionState({
    tracker: connection,
    status,
    now: connectionNow,
  })
  const connectionView = describeConnection(connectionState, {
    tracker: connection,
    status,
    now: connectionNow,
  })



  const stepTimeline = React.useMemo(
    () => buildStepTimeline(activeTaskDetail, extractStepName(status?.currentStep)),
    [activeTaskDetail, status?.currentStep]
  )

  const isFastDbTask = React.useMemo(() => {
    return (
      stepTimeline.visitedSteps.includes("loading_from_db") ||
      stepTimeline.currentStep === "loading_from_db"
    )
  }, [stepTimeline])

  const activeStepsList = isFastDbTask ? DB_LOAD_STEPS_ORDER : ALL_STEPS_ORDER

  const completedStepsCount = activeStepsList.filter(
    (step) => stepTimeline.byStep[step]?.state === "completed"
  ).length

  const currentStepKey = isTaskRunning ? (stepTimeline.currentStep ?? "") : ""

  const currentStepLabel =
    STEP_LABELS[currentStepKey]?.title || (currentStepKey ? "Выполнение этапа" : "Выполняется")

  return (
    <div className="space-y-6">
      {/* Верхний статус-бар Device & Mutex */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  connectionView.tone === "ok"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : connectionView.tone === "warn"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : connectionView.tone === "danger"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                <RadioIcon className="size-5" />
              </div>
              <div role="status" data-testid="service-connection">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Сервис сбора данных</h3>
                  {connectionView.tone === "ok" ? (
                    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {connectionView.label}
                    </Badge>
                  ) : connectionView.tone === "warn" ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs"
                      title={connectionView.hint}
                    >
                      <Loader2Icon className="size-3 animate-spin" />
                      {connectionView.label}
                    </Badge>
                  ) : connectionView.tone === "danger" ? (
                    <Badge variant="destructive" className="text-xs" title={connectionView.hint}>
                      {connectionView.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Loader2Icon className="size-3 animate-spin" />
                      {connectionView.label}
                    </Badge>
                  )}
                </div>
                <p
                  className={`text-xs mt-0.5 ${
                    connectionView.tone === "warn"
                      ? "text-amber-600 dark:text-amber-400"
                      : connectionView.tone === "danger"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {connectionView.hint}
                </p>

              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isTaskRunning ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 font-medium animate-pulse bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                    <Loader2Icon className="size-3 animate-spin text-indigo-600" />
                    <span>{currentStepLabel}</span>
                  </Badge>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 gap-1 text-xs"
                    onClick={handleStopTask}
                    disabled={isStoppingTask}
                  >
                    <SquareIcon className="size-3" />
                    Остановить
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="text-xs font-normal">
                  Сервис свободен
                </Badge>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => {
                  void refreshStatus()
                  void refreshGroups(undefined, { force: true })
                  void refreshDbStats(undefined, { force: true })
                  void refreshTasks()
                }}
                disabled={statusLoading}
                title="Обновить данные"
              >
                <RefreshCwIcon className={`size-4 ${statusLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Навигационные вкладки */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/60">
          <TabsTrigger value="collect" className="gap-2 py-2 text-xs sm:text-sm font-medium">
            <UsersIcon className="size-4" />
            <span>Сбор участников</span>
            {isTaskRunning && <span className="size-2 rounded-full bg-indigo-500 animate-ping" />}
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2 py-2 text-xs sm:text-sm font-medium">
            <DatabaseIcon className="size-4" />
            <span>Данные</span>
            {dbStats && dbStats.undecodedParticipantsCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {dbStats.undecodedParticipantsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 py-2 text-xs sm:text-sm font-medium">
            <HistoryIcon className="size-4" />
            <span>История задач</span>
            {tasks.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ----------------- ВКЛАДКА 1: СБОР УЧАСТНИКОВ ----------------- */}
        <TabsContent value="collect" className="space-y-4">
          {/* Панель запуска сбора */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Сбор участников</CardTitle>
                  <CardDescription className="text-xs">
                    Выберите группу для сбора участников
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Выбор группы */}
                <div className="space-y-1.5">
                  <Label htmlFor="select-group" className="text-xs">Группа / Сообщество</Label>
                  <Select
                    value={selectedGroupId ?? undefined}
                    onValueChange={setSelectedGroupId}
                    disabled={groupsLoading || groups.length === 0 || isTaskRunning}
                  >
                    <SelectTrigger id="select-group" className="text-xs">
                      <SelectValue placeholder="Выберите группу" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => {
                        const emuCount = g.emulatorParticipantCount ?? g.memberCount ?? 0
                        const dbCount = g.dbParticipantCount ?? g.storedParticipantCount ?? 0
                        return (
                          <SelectItem key={g.conversationId} value={String(g.conversationId)}>
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="font-medium truncate max-w-[200px]">{groupName(g)}</span>
                              <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                                📱 {emuCount.toLocaleString("ru-RU")} уч.
                                <span className="mx-1">•</span>
                                <span className={dbCount > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                                  💾 {dbCount.toLocaleString("ru-RU")} в базе
                                </span>
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {groupsError ? (
                    <p className="text-[11px] text-destructive">{groupsError}</p>
                  ) : null}
                </div>

                {/* Дополнительные параметры */}
                <div className="flex flex-col justify-end gap-2 py-1">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="triple-pass"
                      checked={twoPassCollect}
                      onCheckedChange={setTwoPassCollect}
                      disabled={isTaskRunning}
                    />
                    <Label htmlFor="triple-pass" className="text-xs cursor-pointer flex items-center gap-1.5">
                      <span>Глубокий сбор (5 циклов с дедупликацией)</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        x5
                      </Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="restart-app"
                      checked={restartAppAfterCollect}
                      onCheckedChange={setRestartAppAfterCollect}
                      disabled={isTaskRunning}
                    />
                    <Label htmlFor="restart-app" className="text-xs cursor-pointer">
                      Синхронизация телефонов
                    </Label>
                  </div>
                </div>
              </div>

              {/* Информация об участниках выбранной группы: в эмуляторе и в базе данных */}
              {selectedGroup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-md border bg-card/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <SmartphoneIcon className="size-4" />
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground font-medium">В базе эмулятора</div>
                        <div className="text-sm font-bold font-mono text-foreground">
                          {(selectedGroup.emulatorParticipantCount ?? selectedGroup.memberCount ?? 0).toLocaleString("ru-RU")}{" "}
                          <span className="text-xs font-normal text-muted-foreground">участников</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/10">
                      Viber SQLite
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md border bg-card/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <DatabaseIcon className="size-4" />
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground font-medium">В базе данных</div>
                        <div className="text-sm font-bold font-mono text-foreground">
                          {(selectedGroup.dbParticipantCount ?? selectedGroup.storedParticipantCount ?? 0).toLocaleString("ru-RU")}{" "}
                          <span className="text-xs font-normal text-muted-foreground">участников</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {(selectedGroup.dbParticipantCount ?? selectedGroup.storedParticipantCount ?? 0) > 0 ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                            {selectedGroup.lastSyncedAt ? "Синхронизировано" : "В базе"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Не выгружено
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncingGroupId === String(selectedGroup.conversationId)}
                          onClick={() => handleManualSyncToDb(selectedGroup.conversationId, selectedGroup.name)}
                          className="h-6 text-[10px] px-2 gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-300"
                          title="Выгрузить участников группы в Supabase"
                        >
                          {syncingGroupId === String(selectedGroup.conversationId) ? (
                            <Loader2Icon className="size-3 animate-spin" />
                          ) : (
                            <RefreshCwIcon className="size-3" />
                          )}
                          Выгрузить в БД
                        </Button>
                      </div>
                      {selectedGroup.lastSyncedAt && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(selectedGroup.lastSyncedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Баннер о наличии сохраненных данных в базе */}
              {selectedGroup && (selectedGroup.dbParticipantCount ?? selectedGroup.storedParticipantCount ?? 0) > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <DatabaseIcon className="size-4 shrink-0 mt-0.5 sm:mt-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span>
                        В базе уже есть сохранённые данные:{" "}
                        <strong className="font-semibold text-foreground">
                          {(selectedGroup.dbParticipantCount ?? selectedGroup.storedParticipantCount ?? 0).toLocaleString("ru-RU")}
                        </strong>{" "}
                        уч.
                        {selectedGroup.storedPhoneCount ? (
                          <>
                            {" "}
                            (
                            <strong className="font-semibold text-foreground">
                              {selectedGroup.storedPhoneCount.toLocaleString("ru-RU")}
                            </strong>{" "}
                            с номерами телефонов)
                          </>
                        ) : null}
                        . Можно подгрузить мгновенно без повторного скрапинга эмулятором.
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFastLoadFromDb}
                    disabled={isTaskRunning || isStartingCollect || isFastLoading}
                    className="shrink-0 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs h-8"
                  >
                    {isFastLoading ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    Подгрузить из базы
                  </Button>
                </div>
              )}

              {/* Кнопки запуска и остановки */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStartCollect}
                    disabled={!selectedGroup || isTaskRunning || isStartingCollect}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs text-xs sm:text-sm"
                  >
                    {isStartingCollect ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SparklesIcon className="size-4" />
                    )}
                    {isStartingCollect ? "Инициализация…" : "Запустить сбор участников"}
                  </Button>

                  {isTaskRunning && (
                    <Button
                      variant="destructive"
                      onClick={handleStopTask}
                      disabled={isStoppingTask}
                      className="gap-1.5 text-xs sm:text-sm"
                    >
                      <SquareIcon className="size-4" />
                      Остановить сбор
                    </Button>
                  )}
                </div>

                {selectedGroup && (
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                    <span>
                      Выбрано: <span className="font-semibold text-foreground">{groupName(selectedGroup)}</span> (ID {selectedGroup.conversationId})
                    </span>
                    <span>•</span>
                    <span>
                      Эмулятор:{" "}
                      <strong className="text-foreground">
                        {(selectedGroup.emulatorParticipantCount ?? selectedGroup.memberCount ?? 0).toLocaleString("ru-RU")}
                      </strong>{" "}
                      уч.
                    </span>
                    <span>•</span>
                    <span>
                      В базе:{" "}
                      <strong className="text-foreground">
                        {(selectedGroup.dbParticipantCount ?? selectedGroup.storedParticipantCount ?? 0).toLocaleString("ru-RU")}
                      </strong>{" "}
                      уч.
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Этапы сбора участников */}
          {(isTaskRunning || activeTaskDetail) && (
            <Card
              className={`border-border/60 ${
                isTaskRunning
                  ? "border-indigo-500/30 bg-indigo-500/[0.02]"
                  : activeTaskDetail?.status === "ready"
                    ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                    : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isTaskRunning ? (
                      <div className="size-2 rounded-full bg-indigo-600 animate-ping" />
                    ) : activeTaskDetail?.status === "ready" ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <div className="size-2 rounded-full bg-muted-foreground" />
                    )}
                    <CardTitle className="text-sm font-semibold">
                      {isTaskRunning
                        ? "Этапы сбора участников"
                        : activeTaskDetail?.status === "ready"
                          ? `Сбор участников завершен: ${activeTaskDetail.groupName || activeTaskDetail.groupTarget}`
                          : "Итоги задачи сбора"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTaskDetail?.id && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {activeTaskDetail.id}
                      </Badge>
                    )}
                    {!isTaskRunning && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          // Скрытую задачу не возвращаем ни фоновым опросом, ни кнопкой «Обновить»
                          if (activeTaskDetail?.id) hiddenTaskIdRef.current = activeTaskDetail.id
                          loadedDetailIdRef.current = null
                          setActiveTaskDetail(null)
                        }}
                      >
                        Скрыть
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {isTaskRunning
                    ? "Последовательное выполнение этапов сбора"
                    : activeTaskDetail?.status === "ready"
                      ? `Все этапы сбора успешно пройдены (${completedStepsCount} из ${activeStepsList.length}). Результаты готовы к экспорту.`
                      : "Выполнение задачи завершено."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Сетка шагов */}
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {activeStepsList.map((stepKey, idx) => {
                    const stepMeta = STEP_LABELS[stepKey] ?? { title: "Выполнение этапа", desc: "Обработка данных" }
                    const stepView = stepTimeline.byStep[stepKey]
                    // Спиннер только пока задача действительно идёт: иначе шапка
                    // говорит «сервис свободен», а карточка крутит загрузку.
                    const isCurrent = isTaskRunning && stepView?.state === "current"
                    const isCompleted = stepView?.state === "completed"
                    const isError = stepView?.state === "error"
                    const isStopped =
                      stepView?.state === "stopped" || (!isTaskRunning && stepView?.state === "current")

                    return (
                      <div
                        key={stepKey}
                        data-step={stepKey}
                        data-step-state={
                          isCurrent
                            ? "current"
                            : isCompleted
                              ? "completed"
                              : isError
                                ? "error"
                                : isStopped
                                  ? "stopped"
                                  : "pending"
                        }
                        className={`relative flex flex-col p-2.5 rounded-lg border text-xs transition-all ${
                          isCurrent
                            ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/30"
                            : isCompleted
                              ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                              : isError
                                ? "border-destructive/40 bg-destructive/10"
                                : isStopped
                                  ? "border-amber-500/40 bg-amber-500/10"
                                  : "border-border/40 bg-card/40 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          {isCurrent ? (
                            <Loader2Icon className="size-3.5 animate-spin text-indigo-600" />
                          ) : isCompleted ? (
                            <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : isError ? (
                            <AlertCircleIcon className="size-3.5 text-destructive" />
                          ) : isStopped ? (
                            <SquareIcon className="size-3 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <span className="size-2 rounded-full bg-border" />
                          )}
                        </div>

                        <span className="font-semibold text-foreground text-[11px] leading-tight">
                          {stepMeta.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {stepMeta.desc}
                        </span>

                        {stepView?.durationMs !== undefined && stepView?.durationMs !== null && (
                          <div className="mt-1.5 pt-1 border-t border-border/30 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                            <span>{stepView.occurrences > 1 ? `Время (×${stepView.occurrences}):` : "Время:"}</span>
                            <span className="font-semibold">
                              {(stepView.durationMs / 1000).toFixed(1)}с
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Прогресс сбора и проверки активности */}
                {activeTaskDetail?.progress && (activeTaskDetail.progress.pagesCount !== undefined || activeTaskDetail.progress.onlineTotal !== undefined) && (
                  <div className="rounded-lg border bg-card/80 p-3 text-xs space-y-2">
                    {activeTaskDetail.progress.pagesCount !== undefined && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">Прогресс сбора:</span>
                          <div className="flex items-center gap-3 font-mono font-semibold">
                            <span>Обработано: {activeTaskDetail.progress.currentOffset ?? 0}</span>
                            {activeTaskDetail.progress.headerTotal ? (
                              <span>Всего: {activeTaskDetail.progress.headerTotal}</span>
                            ) : null}
                          </div>
                        </div>
                        {typeof activeTaskDetail.progress.headerTotal === "number" &&
                          activeTaskDetail.progress.headerTotal > 0 && (
                            <Progress
                              value={Math.min(
                                100,
                                Math.round(
                                  ((activeTaskDetail.progress.currentOffset ?? 0) /
                                    activeTaskDetail.progress.headerTotal) *
                                    100
                                )
                              )}
                              className="h-1.5"
                            />
                          )}
                      </>
                    )}

                    {typeof activeTaskDetail.progress.onlineTotal === "number" && activeTaskDetail.progress.onlineTotal > 0 && (
                      <>
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-medium text-foreground">Проверка статуса онлайн / активности:</span>
                          <div className="flex items-center gap-3 font-mono font-semibold">
                            <span>Проверено: {activeTaskDetail.progress.onlineChecked ?? 0} / {activeTaskDetail.progress.onlineTotal}</span>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(
                            100,
                            Math.round(
                              ((activeTaskDetail.progress.onlineChecked ?? 0) /
                                activeTaskDetail.progress.onlineTotal) *
                                100
                            )
                          )}
                          className="h-1.5"
                        />
                      </>
                    )}
                  </div>
                )}

                {/* Итоговый результат задачи */}
                {activeTaskDetail?.result && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-5 text-emerald-600" />
                      <div>
                        <span className="font-semibold text-foreground">Сбор успешно завершен!</span>
                        <p className="text-muted-foreground text-[11px]">
                          Собрано {activeTaskDetail.result.participantsCount} участников (с номерами: {activeTaskDetail.result.participantsWithPhone}).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExportTxt}>
                        <DownloadIcon className="size-3" />
                        TXT
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExportCsv}>
                        <DownloadIcon className="size-3" />
                        CSV
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExportJson}>
                        <DownloadIcon className="size-3" />
                        JSON
                      </Button>
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCopyPhones}>
                        <CopyIcon className="size-3" />
                        Копировать телефоны
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Информационные карточки участников */}
          {selectedGroup && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border bg-card p-3.5 shadow-xs transition-colors">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Всего участников</span>
                  <UsersIcon className="size-4 text-muted-foreground/70" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {membersLoading ? "…" : totalMembersCount.toLocaleString("ru-RU")}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">В текущей группе</p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-xs transition-colors">
                <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
                  <span>С номерами телефонов</span>
                  <PhoneIcon className="size-4" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {membersLoading ? "…" : decodedMembersCount.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80 tabular-nums">
                    ({decodedPercent}%)
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Доступны для связи</p>
              </div>

              <div className="rounded-xl border bg-card p-3.5 shadow-xs transition-colors">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    В сети сейчас
                  </span>
                  <ActivityIcon className="size-4 text-emerald-600" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {membersLoading ? "…" : onlineMembersCount.toLocaleString("ru-RU")}
                  </span>
                  {totalMembersCount > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ({((onlineMembersCount / totalMembersCount) * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Активны в Viber</p>
              </div>

              <div className="rounded-xl border bg-card p-3.5 shadow-xs transition-colors">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Администраторы</span>
                  <ShieldCheckIcon className="size-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {membersLoading ? "…" : adminsCount.toLocaleString("ru-RU")}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Суперадмины и админы</p>
              </div>
            </div>
          )}

          {/* Таблица участников выбранной группы */}
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Участники группы</CardTitle>
                    {members?.source && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-2 py-0.5 font-normal",
                          members.source === "supabase"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                        )}
                      >
                        {members.source === "supabase" ? "Supabase Cloud" : "Эмулятор SQLite"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    {selectedGroup ? (
                      <>
                        Всего участников: {(members?.count ?? 0).toLocaleString("ru-RU")}
                        {filteredMembers.length !== (members?.members.length ?? 0) && (
                          <span className="ml-1.5 text-primary font-medium">
                            (отобрано: {filteredMembers.length.toLocaleString("ru-RU")})
                          </span>
                        )}
                      </>
                    ) : (
                      "Выберите группу для просмотра"
                    )}
                  </CardDescription>
                </div>

                {/* Переключатель источника данных: Supabase vs Эмулятор */}
                <div className="flex items-center rounded-lg border bg-muted/60 p-0.5 text-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleMembersSourceChange("supabase")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all text-xs",
                      membersSource === "supabase"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <DatabaseIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span>База данных (Supabase)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMembersSourceChange("emulator")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all text-xs",
                      membersSource === "emulator"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <SmartphoneIcon className="size-3 text-blue-600 dark:text-blue-400" />
                    <span>Эмулятор (Viber SQLite)</span>
                  </button>
                </div>
              </div>

              {/* Уведомление о фоллбэке на эмулятор */}
              {members?.source === "emulator" && membersSource === "supabase" && (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <InfoIcon className="size-3.5 shrink-0" />
                  <span>
                    Показаны данные из эмулятора: в базе Supabase для этой группы пока нет записей. Вы можете нажать «Выгрузить в БД» выше.
                  </span>
                </div>
              )}

              {/* Панель фильтров, поиска, сортировки и экспорта */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-44 sm:w-56">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по имени/номеру…"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {/* Фильтр статуса/роли */}
                  <Select
                    value={memberRoleFilter}
                    onValueChange={(v) => setMemberRoleFilter(v as typeof memberRoleFilter)}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все ({members?.count ?? 0})</SelectItem>
                      <SelectItem value="decoded">С телефоном ({decodedMembersCount})</SelectItem>
                      <SelectItem value="undecoded">Ожидают синхронизации</SelectItem>
                      <SelectItem value="online">В сети сейчас ({onlineMembersCount})</SelectItem>
                      <SelectItem value="recent_24h">Активны за 24 часа</SelectItem>
                      <SelectItem value="recent_7d">Активны за 7 дней</SelectItem>
                      <SelectItem value="admins">Администраторы ({adminsCount})</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Сортировка */}
                  <Select
                    value={memberSort}
                    onValueChange={(v) => setMemberSort(v as typeof memberSort)}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs gap-1.5">
                      <ArrowUpDownIcon className="size-3 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activity">По активности (онлайн)</SelectItem>
                      <SelectItem value="phone">С номерами первыми</SelectItem>
                      <SelectItem value="name">По имени (А–Я)</SelectItem>
                      <SelectItem value="role">По роли (админы)</SelectItem>
                      <SelectItem value="default">По порядку</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/40 text-xs h-8">
                    <Switch
                      id="hide-duplicates"
                      checked={hideDuplicates}
                      onCheckedChange={setHideDuplicates}
                      className="scale-75 data-[state=checked]:bg-emerald-600"
                    />
                    <Label htmlFor="hide-duplicates" className="text-xs cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
                      Без дубликатов
                    </Label>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleExportTxt}
                    disabled={!members?.members.length}
                  >
                    <DownloadIcon className="size-3" />
                    TXT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleExportCsv}
                    disabled={!members?.members.length}
                  >
                    <DownloadIcon className="size-3" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleExportJson}
                    disabled={!members?.members.length}
                  >
                    <DownloadIcon className="size-3" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleCopyPhones}
                    disabled={!members?.members.length}
                  >
                    <CopyIcon className="size-3" />
                    Копировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      selectedGroupId && void refreshMembers(selectedGroupId, undefined, { force: true })
                    }
                    disabled={membersLoading}
                    title="Обновить участников"
                  >
                    <RefreshCwIcon className={`size-3.5 ${membersLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading && !members ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {members?.members.length === 0
                    ? "Участники для этой группы пока не собраны. Нажмите «Запустить сбор участников» выше."
                    : "Ничего не найдено по выбранным фильтрам."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">№</TableHead>
                        <TableHead className="w-[180px]">Телефон / Номер</TableHead>
                        <TableHead className="w-[120px]">Статус</TableHead>
                        <TableHead className="w-[140px]">Активность</TableHead>
                        <TableHead>Имя контакта</TableHead>
                        <TableHead className="w-[120px]">Роль в группе</TableHead>
                        <TableHead className="w-[80px] text-right">Тип</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedMembers.map((member, idx) => {
                        const isDecoded =
                          member.isDecoded ??
                          (!member.phoneNumber.toLowerCase().startsWith("em") &&
                            member.phoneNumber !== "Ожидает дешифровки")
                        const position = membersOffset + idx + 1

                        return (
                          <TableRow
                            key={member.participantId ?? `m-${position}`}
                            data-testid="members-row"
                          >
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                              {position}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums">
                              {isDecoded ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {member.phoneNumber}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <ClockIcon className="size-3" />
                                  Ожидает синхронизации
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isDecoded ? (
                                <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                                  Доступен
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-normal border-amber-500/30 text-amber-600 bg-amber-500/5">
                                  Ожидает синхронизации
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {member.isOnline ? (
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 hover:bg-emerald-500/20 font-normal">
                                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  В сети
                                </Badge>
                              ) : member.lastSeen ? (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {formatLastSeen(member.lastSeen)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {member.name ? (
                                <span className="font-medium text-foreground">{member.name}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {member.roleLabel === "superadmin" ? (
                                <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                                  Суперадмин
                                </Badge>
                              ) : member.roleLabel === "admin" ? (
                                <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                                  Админ
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Участник
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {member.isSelf ? (
                                <Badge className="text-[10px] bg-emerald-600 text-white gap-1">
                                  <ShieldIcon className="size-2.5" />
                                  Бот
                                </Badge>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Показано {membersRangeStart}–{membersRangeEnd} из{" "}
                        {filteredMembers.length.toLocaleString("ru-RU")}
                      </span>
                      <Select
                        value={String(membersPageSize)}
                        onValueChange={handleMembersPageSizeChange}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs" aria-label="Размер страницы">
                          <SelectValue />
                        </SelectTrigger>
                        {/* Раскрытие поверх триггера: список коротких опций
                            не нуждается в поппере и открывается у нижнего края */}
                        <SelectContent position="item-aligned">
                          {MEMBERS_PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              По {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setMembersPage(1)}
                        disabled={membersCurrentPage <= 1}
                        title="Первая страница"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs px-2.5"
                        onClick={() => setMembersPage(Math.max(1, membersCurrentPage - 1))}
                        disabled={membersCurrentPage <= 1}
                      >
                        <ChevronLeftIcon className="size-3.5" />
                        Назад
                      </Button>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground px-1">
                        <span>стр.</span>
                        <Input
                          type="number"
                          min={1}
                          max={membersTotalPages}
                          value={jumpPageInput}
                          onChange={(e) => setJumpPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const p = parseInt(jumpPageInput, 10)
                              if (!isNaN(p)) {
                                setMembersPage(Math.min(membersTotalPages, Math.max(1, p)))
                              }
                            }
                          }}
                          onBlur={() => {
                            const p = parseInt(jumpPageInput, 10)
                            if (!isNaN(p)) {
                              setMembersPage(Math.min(membersTotalPages, Math.max(1, p)))
                            } else {
                              setJumpPageInput(String(membersCurrentPage))
                            }
                          }}
                          className="h-8 w-14 text-center text-xs font-semibold tabular-nums px-1 bg-background"
                          aria-label="Номер страницы"
                        />
                        <span>из {membersTotalPages}</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs px-2.5"
                        onClick={() =>
                          setMembersPage(Math.min(membersTotalPages, membersCurrentPage + 1))
                        }
                        disabled={membersCurrentPage >= membersTotalPages}
                      >
                        Вперёд
                        <ChevronRightIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setMembersPage(membersTotalPages)}
                        disabled={membersCurrentPage >= membersTotalPages}
                        title="Последняя страница"
                      >
                        »
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- ВКЛАДКА 2: БАЗА ДАННЫХ SQLITE ----------------- */}
        <TabsContent value="database" className="space-y-4">
          {/* Карточки статистики */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Чаты и диалоги</p>
              <p className="text-2xl font-bold tabular-nums">
                {/* Список групп на странице инстанса отфильтрован по устройству,
                    поэтому его длина занизила бы счётчик чатов в базе. */}
                {dbStatsLoading ? "…" : dbStats?.conversationsCount ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">Доступно для обработки</p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Всего сообщений</p>
              <p className="text-2xl font-bold tabular-nums">
                {dbStatsLoading ? "…" : (dbStats?.messagesCount ?? 0).toLocaleString("ru-RU")}
              </p>
              <p className="text-[11px] text-muted-foreground">Сохранено в системе</p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Карточек участников</p>
              <p className="text-2xl font-bold tabular-nums">
                {dbStatsLoading ? "…" : (dbStats?.participantsCount ?? 0).toLocaleString("ru-RU")}
              </p>
              <p className="text-[11px] text-muted-foreground">Доступно в системе</p>
            </Card>

            <Card className="p-4 space-y-1 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Ожидают синхронизации</p>
                {dbStats && dbStats.undecodedParticipantsCount > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                    Требуется обновление
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {dbStatsLoading ? "…" : (dbStats?.undecodedParticipantsCount ?? 0).toLocaleString("ru-RU")}
              </p>
              <p className="text-[11px] text-muted-foreground">Телефоны требуют синхронизации</p>
            </Card>
          </div>

          {/* Инструменты работы с базой */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Синхронизация снимка базы */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DatabaseIcon className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Обновление данных</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Обновляет информацию для отображения актуальных данных.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Актуальность данных:</span>
                    <span className="font-semibold text-foreground">
                      {dbStats?.isSnapshotCurrent ? "Актуален" : "Требуется обновление"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Доступность данных:</span>
                    <span className="font-semibold text-foreground">Доступны</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSyncDatabase}
                  disabled={isSyncingDb || isTaskRunning}
                  className="w-full gap-2 text-xs sm:text-sm"
                  variant="outline"
                >
                  {isSyncingDb ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                  {isSyncingDb ? "Обновление данных…" : "Обновить данные"}
                </Button>
              </CardFooter>
            </Card>

            {/* Дешифровка базы данных */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRoundIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base font-semibold">Синхронизация телефонов</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Обновляет телефоны участников и приводит сведения к актуальному состоянию.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Защита системного профиля:</span>
                    <span className="font-semibold text-emerald-600">Включена</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Режим обновления:</span>
                    <span className="font-semibold">Автоматический</span>
                  </div>
                </div>

                {lastDecodeResult && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Результат последней синхронизации:
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Синхронизировано: <span className="font-semibold text-foreground">{lastDecodeResult.decodedCount}</span> ·
                      Обработано: <span className="font-semibold text-foreground">{lastDecodeResult.read}</span> ·
                      Изменено: <span className="font-semibold text-foreground">{lastDecodeResult.changedRows ?? 0}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  onClick={() => handleDecodeDatabase()}
                  disabled={isDecodingDb || isTaskRunning}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm"
                >
                  {isDecodingDb ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <KeyRoundIcon className="size-4" />
                  )}
                  {isDecodingDb ? "Выполняется синхронизация…" : "Синхронизировать телефоны"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* ----------------- ВКЛАДКА 3: ИСТОРИЯ ЗАДАЧ ----------------- */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">История задач сбора</CardTitle>
                  <CardDescription className="text-xs">
                    Реестр запущенных задач, их статусы, длительность и собранные участники
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => void refreshTasks()}
                  disabled={tasksLoading}
                >
                  <RefreshCwIcon className={`size-3.5 ${tasksLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading && tasks.length === 0 ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Задачи еще не запускались в этой сессии.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">ID задачи</TableHead>
                        <TableHead>Целевая группа</TableHead>
                        <TableHead className="w-[110px]">Статус</TableHead>
                        <TableHead className="w-[130px]">Запущена</TableHead>
                        <TableHead className="w-[110px] text-right">Участников</TableHead>
                        <TableHead className="w-[90px] text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((t) => {
                        const badgeInfo = taskStatusBadge[t.status] ?? {
                          label: t.status,
                          variant: "secondary" as const,
                        }

                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs">
                              <span className="font-medium text-foreground">{t.id}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-medium">{t.groupName || t.groupTarget}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={badgeInfo.variant}
                                className={`text-[10px] font-normal ${badgeInfo.className ?? ""}`}
                              >
                                {badgeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {new Date(t.startedAt).toLocaleTimeString("ru-RU")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {t.participantsCollected !== null && t.participantsCollected !== undefined
                                ? t.participantsCollected.toLocaleString("ru-RU")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-primary"
                                onClick={async () => {
                                  try {
                                    const detail = await request<TaskDetailDto>(withDevice(`tasks/${t.id}`))
                                    setSelectedHistoryTask(detail)
                                    setHistoryTaskModalOpen(true)
                                  } catch {
                                    toast.error("Не удалось загрузить детали задачи")
                                  }
                                }}
                              >
                                Детали
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Модальное окно деталей задачи из истории */}
      <Dialog open={historyTaskModalOpen} onOpenChange={setHistoryTaskModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span>Задача {selectedHistoryTask?.id}</span>
              {selectedHistoryTask && (
                <Badge
                  variant={taskStatusBadge[selectedHistoryTask.status]?.variant ?? "secondary"}
                  className="text-xs"
                >
                  {taskStatusBadge[selectedHistoryTask.status]?.label ?? selectedHistoryTask.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Цель: {selectedHistoryTask?.groupName || selectedHistoryTask?.groupTarget} (ID {selectedHistoryTask?.conversationId})
            </DialogDescription>
          </DialogHeader>

          {selectedHistoryTask && (
            <div className="space-y-4 text-xs">
              {/* История шагов */}
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground">Пройденные шаги:</span>
                <div className="space-y-1.5 max-h-64 overflow-y-auto border rounded-lg p-2.5">
                  {selectedHistoryTask.stepHistory.map((s, i) => {
                    const stepKey = extractStepName(s.step || s)
                    const stepTitle = STEP_LABELS[stepKey]?.title || `Этап ${i + 1}`
                    return (
                      <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                          <span className="font-medium text-foreground">
                            {stepTitle}
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground">
                          {s.durationMs ? `${(s.durationMs / 1000).toFixed(1)} сек` : "—"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedHistoryTask.result && (
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
                  <div className="font-semibold text-foreground">Итоговый отчет:</div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
                    <div>Всего участников: <span className="font-bold text-foreground">{selectedHistoryTask.result.participantsCount}</span></div>
                    <div>С номерами телефонов: <span className="font-bold text-foreground">{selectedHistoryTask.result.participantsWithPhone}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
