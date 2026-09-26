import type {
  TaskDetailDto,
  TaskProgress,
  TaskStepDto,
  TaskSummaryDto,
  ViberDecodeRequest,
  ViberParserState,
  ViberParserStatus,
} from "@/lib/viber-parser/types"

/** Статусы, при которых эмулятор занят задачей. */
const ACTIVE_TASK_STATUSES = new Set(["initializing", "starting", "running"])

export const MAX_STATUS_TASKS = 50

/** Поля, которые принимает CollectParticipantsDto бэкенда. Всё остальное даёт 400. */
export interface CollectRequestBody {
  group: string
  allowPartial?: boolean
  restartApp?: boolean
  idleTimeoutMs?: number
  numbersSyncTimeoutMs?: number
  syncLiveDbAfter?: boolean
  fetchOnlineStatus?: boolean
}

export type SanitizeResult<T> = { ok: true; value: T } | { ok: false; error: string }

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
}

function boolField(source: Record<string, unknown>, key: string): boolean | undefined {
  const value = source[key]
  return typeof value === "boolean" ? value : undefined
}

function numberField(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function assign<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined) {
  if (value !== undefined) target[key] = value
}

export function sanitizeCollectBody(raw: unknown): SanitizeResult<CollectRequestBody> {
  const source = asRecord(raw)
  const rawGroup =
    typeof source.group === "string"
      ? source.group
      : typeof source.groupName === "string"
        ? source.groupName
        : ""
  const group = rawGroup.trim()

  if (!group) {
    return { ok: false, error: "Не указана группа для сбора участников" }
  }

  const value: CollectRequestBody = { group }
  assign(value, "allowPartial", boolField(source, "allowPartial"))
  assign(value, "restartApp", boolField(source, "restartApp"))
  assign(value, "idleTimeoutMs", numberField(source, "idleTimeoutMs"))
  assign(value, "numbersSyncTimeoutMs", numberField(source, "numbersSyncTimeoutMs"))
  assign(value, "syncLiveDbAfter", boolField(source, "syncLiveDbAfter"))
  assign(value, "fetchOnlineStatus", boolField(source, "fetchOnlineStatus"))

  return { ok: true, value }
}

export function sanitizeDecodeBody(raw: unknown): ViberDecodeRequest {
  const source = asRecord(raw)
  const value: ViberDecodeRequest = {
    dryRun: boolField(source, "dryRun") ?? false,
    restartApp: boolField(source, "restartApp") ?? true,
    waitForSyncSeconds: numberField(source, "waitForSyncSeconds") ?? 10,
  }
  assign(value, "limit", numberField(source, "limit"))
  return value
}

function createdAtMs(task: TaskSummaryDto): number {
  const parsed = Date.parse(task.createdAt ?? "")
  return Number.isNaN(parsed) ? 0 : parsed
}

export function sortTasksByCreatedAtDesc(tasks: TaskSummaryDto[]): TaskSummaryDto[] {
  return [...tasks].sort((a, b) => createdAtMs(b) - createdAtMs(a))
}

export function isActiveTaskStatus(status: string | null | undefined): boolean {
  return !!status && ACTIVE_TASK_STATUSES.has(status)
}

export function pickActiveTask(tasks: TaskSummaryDto[]): TaskSummaryDto | null {
  if (!Array.isArray(tasks) || tasks.length === 0) return null
  const sorted = sortTasksByCreatedAtDesc(tasks)
  return sorted.find((task) => isActiveTaskStatus(task.status)) ?? sorted[0] ?? null
}

export function deriveParserState(task: TaskSummaryDto | null): ViberParserState {
  if (!task) return "IDLE"
  if (task.status === "running") return "RUNNING"
  if (task.status === "initializing" || task.status === "starting") return "INITIALIZING"
  if (task.status === "error") return "ERROR"
  return "IDLE"
}

export function stepNameOf(step: TaskStepDto | string | null | undefined): string | null {
  if (!step) return null
  if (typeof step === "string") return step || null
  return typeof step.step === "string" && step.step ? step.step : null
}

export function buildStatusPayload(input: {
  tasks: TaskSummaryDto[]
  detail: TaskDetailDto | null
  fetchedAt: string
  maxTasks?: number
}): ViberParserStatus {
  const tasks = Array.isArray(input.tasks) ? input.tasks : []
  const sorted = sortTasksByCreatedAtDesc(tasks)
  const active = pickActiveTask(sorted)
  const detail = input.detail && active && input.detail.id === active.id ? input.detail : null

  const currentStep =
    stepNameOf(detail?.currentStep ?? null) ?? stepNameOf(active?.currentStep ?? null)

  const progress: TaskProgress | null =
    detail?.progress ?? detail?.currentStep?.progress ?? active?.currentStep?.progress ?? null

  return {
    state: deriveParserState(active),
    isDriverActive: true,
    taskId: active?.id ?? null,
    task: detail,
    tasks: sorted.slice(0, input.maxTasks ?? MAX_STATUS_TASKS),
    currentStep,
    progress,
    groupName: active ? active.groupName || active.groupTarget || null : null,
    fetchedAt: input.fetchedAt,
  }
}

export const DEFAULT_PARSER_URL = "http://127.0.0.1:3001"

export interface UpstreamConfig {
  /** Адрес бэкенда без завершающего «/»: origin плюс необязательный префикс пути. */
  baseUrl: string
  /** Заголовки, которые уходят с каждым запросом к бэкенду (авторизация). */
  headers: Record<string, string>
}

/**
 * Читает VIBER_PARSER_URL и VIBER_PARSER_TOKEN. Бэкенд может стоять на удалённой
 * машине (VM в GCP) за reverse proxy, поэтому сохраняем префикс пути
 * (`https://api.example.com/viber` → `/viber/api/...`) и поддерживаем авторизацию:
 * логин и пароль из URL уходят как Basic, токен — как Bearer.
 */
export function resolveUpstreamConfig(env: {
  VIBER_PARSER_URL?: string
  VIBER_PARSER_TOKEN?: string
}): UpstreamConfig {
  const url = new URL(env.VIBER_PARSER_URL?.trim() || DEFAULT_PARSER_URL)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VIBER_PARSER_URL must use http or https")
  }

  const token = env.VIBER_PARSER_TOKEN?.trim()
  const hasCredentials = url.username !== "" || url.password !== ""
  if (token && hasCredentials) {
    throw new Error("Use either credentials in VIBER_PARSER_URL or VIBER_PARSER_TOKEN, not both")
  }

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  } else if (hasCredentials) {
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
    headers.Authorization = `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`
  }

  const prefix = url.pathname.replace(/\/+$/, "")
  return { baseUrl: `${url.origin}${prefix}`, headers }
}

export type ProxyMethod = "GET" | "POST" | "PATCH" | "DELETE"

export type ProxyRouteKind =
  | "status"
  | "groups"
  | "group-detail"
  | "group-members"
  | "database-stats"
  | "database-sync"
  | "decode"
  | "tasks"
  | "task-detail"
  | "task-events"
  | "task-participants"
  | "task-stop"
  | "stop"
  | "start"
  | "collect"
  | "messages-events"
  | "messages-monitored"
  | "messages-monitored-export"
  | "monitor-status"
  | "monitor-groups"
  | "monitor-start"
  | "monitor-stop"
  | "monitor-group-toggle"
  | "online-status"
  | "broadcast"

export interface ProxyMatch {
  kind: ProxyRouteKind
  params?: Record<string, string>
  /** Путь на бэкенде для сквозных маршрутов (broadcast). */
  upstreamPath?: string
}

const SAFE_SEGMENT = /^[A-Za-z0-9_.\-@:+]+$/

function isSafeSegment(segment: string): boolean {
  return SAFE_SEGMENT.test(segment) && segment !== "." && segment !== ".."
}

function broadcastMatch(method: ProxyMethod, parts: string[]): ProxyMatch | null {
  const [, ...rest] = parts
  if (rest.length === 0) return null

  const path = `broadcast/${rest.join("/")}`
  const campaignId = rest[1]

  if (method === "GET") {
    // status, history, history/last, campaigns, campaigns/:id
    if (rest[0] === "status" && rest.length === 1) return { kind: "broadcast", upstreamPath: path }
    if (rest[0] === "history" && rest.length <= 2) return { kind: "broadcast", upstreamPath: path }
    if (rest[0] === "campaigns" && rest.length <= 2) return { kind: "broadcast", upstreamPath: path }
    return null
  }

  if (method === "POST") {
    if (rest[0] === "campaigns" && rest.length === 1) return { kind: "broadcast", upstreamPath: path }
    if (
      rest[0] === "campaigns" &&
      rest.length === 3 &&
      (rest[2] === "start" || rest[2] === "stop")
    ) {
      return { kind: "broadcast", upstreamPath: path }
    }
    return null
  }

  if ((method === "PATCH" || method === "DELETE") && rest[0] === "campaigns" && rest.length === 2 && campaignId) {
    return { kind: "broadcast", upstreamPath: path }
  }

  return null
}

export function matchProxyRoute(method: ProxyMethod, pathParts: string[]): ProxyMatch | null {
  const parts = (pathParts ?? []).filter((part) => part.length > 0)
  if (parts.length === 0) return null
  if (!parts.every(isSafeSegment)) return null

  const route = parts.join("/")

  if (parts[0] === "broadcast") {
    return broadcastMatch(method, parts)
  }

  if (method === "GET") {
    if (route === "status") return { kind: "status" }
    if (route === "groups") return { kind: "groups" }
    if (route === "database/stats") return { kind: "database-stats" }
    if (route === "tasks") return { kind: "tasks" }
    if (route === "messages/events" || route === "messages/monitor/events") {
      return { kind: "messages-events" }
    }
    if (route === "messages/monitored") return { kind: "messages-monitored" }
    if (route === "messages/monitored/export") return { kind: "messages-monitored-export" }
    if (route === "messages/monitor/status") return { kind: "monitor-status" }
    if (route === "messages/monitor/groups") return { kind: "monitor-groups" }

    if (parts[0] === "groups" && parts.length === 2 && parts[1]) {
      return { kind: "group-detail", params: { id: parts[1] } }
    }
    if (
      parts[0] === "groups" &&
      parts.length === 3 &&
      parts[1] &&
      (parts[2] === "members" || parts[2] === "participants")
    ) {
      return { kind: "group-members", params: { id: parts[1] } }
    }
    if (parts[0] === "tasks" && parts.length === 2 && parts[1]) {
      return { kind: "task-detail", params: { id: parts[1] } }
    }
    if (parts[0] === "tasks" && parts.length === 3 && parts[1] && parts[2] === "events") {
      return { kind: "task-events", params: { id: parts[1] } }
    }
    if (parts[0] === "tasks" && parts.length === 3 && parts[1] && parts[2] === "participants") {
      return { kind: "task-participants", params: { id: parts[1] } }
    }
    return null
  }

  if (method === "POST") {
    if (route === "start") return { kind: "start" }
    if (route === "stop") return { kind: "stop" }
    if (route === "participants/collect" || route === "collect") return { kind: "collect" }
    if (route === "participants/online-status") return { kind: "online-status" }
    if (route === "database/decode" || route === "participants/decode") return { kind: "decode" }
    if (route === "database/sync") return { kind: "database-sync" }
    if (route === "messages/monitor/start") return { kind: "monitor-start" }
    if (route === "messages/monitor/stop") return { kind: "monitor-stop" }

    if (parts[0] === "tasks" && parts.length === 3 && parts[1] && parts[2] === "stop") {
      return { kind: "task-stop", params: { id: parts[1] } }
    }
    if (
      parts.length === 5 &&
      parts[0] === "messages" &&
      parts[1] === "monitor" &&
      parts[2] === "groups" &&
      parts[3] &&
      (parts[4] === "enable" || parts[4] === "disable")
    ) {
      return { kind: "monitor-group-toggle", params: { id: parts[3], action: parts[4] } }
    }
    return null
  }

  return null
}

/**
 * SSE-поток задач у бэкенда не шлёт heartbeat: на шагах restarting_viber (до 60 с)
 * и waiting_numbers_sync (до 45 с) в потоке тишина, и промежуточные прокси рвут соединение.
 * Оборачиваем тело в трансформ, который каждые intervalMs вставляет комментарий ": ping".
 *
 * Ping вставляется ТОЛЬКО на границе кадра (пустая строка после события): иначе
 * комментарий попадает внутрь `data:` и ломает и JSON.parse, и многобайтовые символы UTF-8.
 * Если тик пришёлся на середину кадра, ping откладывается до ближайшей границы.
 */
export function createSseHeartbeatStream(intervalMs = 15_000): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder()
  const LF = 0x0a
  const CR = 0x0d

  let timer: ReturnType<typeof setInterval> | null = null
  /** До первого байта поток пуст — это тоже граница кадра. */
  let atBoundary = true
  let pendingPing = false
  /** Хвост последних байтов: разделитель кадров может быть разрезан между чанками. */
  let tail: number[] = []

  const clear = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const updateBoundary = (chunk: Uint8Array) => {
    if (chunk.length === 0) return
    const lastBytes = chunk.subarray(Math.max(0, chunk.length - 4))
    tail = [...tail, ...Array.from(lastBytes)].slice(-4)

    const size = tail.length
    atBoundary =
      (size >= 2 && tail[size - 1] === LF && tail[size - 2] === LF) ||
      (size >= 4 &&
        tail[size - 1] === LF &&
        tail[size - 2] === CR &&
        tail[size - 3] === LF &&
        tail[size - 4] === CR)
  }

  const transformer: Transformer<Uint8Array, Uint8Array> = {
    start(controller) {
      timer = setInterval(() => {
        if (!atBoundary) {
          pendingPing = true
          return
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"))
        } catch {
          clear()
        }
      }, intervalMs)
    },
    transform(chunk, controller) {
      controller.enqueue(chunk)
      updateBoundary(chunk)
      if (atBoundary && pendingPing) {
        pendingPing = false
        controller.enqueue(encoder.encode(": ping\n\n"))
      }
    },
    flush() {
      clear()
    },
  }

  // cancel() есть в рантайме (Node 18.17+), но ещё не описан в lib.dom.d.ts этой версии TS
  ;(transformer as { cancel?: () => void }).cancel = clear

  return new TransformStream<Uint8Array, Uint8Array>(transformer)
}

/**
 * `AbortSignal.any` появился только в Node 20.3 — на более старых рантаймах
 * склеиваем сигналы вручную, чтобы прокси не падал на старте запроса.
 */
export function composeAbortSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal {
  const list = signals.filter((signal): signal is AbortSignal => !!signal)
  if (list.length === 0) return new AbortController().signal

  const already = list.find((signal) => signal.aborted)
  if (already) return already
  if (list.length === 1) return list[0]!

  const anyOf = (AbortSignal as unknown as { any?: (input: AbortSignal[]) => AbortSignal }).any
  if (typeof anyOf === "function") return anyOf.call(AbortSignal, list)

  const controller = new AbortController()
  for (const signal of list) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}
