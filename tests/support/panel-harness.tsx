// Тестовая обвязка для панели: управляемый fetch, управляемый EventSource и таймеры.
import { act } from "@testing-library/react"
import { vi } from "vitest"

import type { TaskDetailDto, TaskStatus, ViberMember, ViberParserStatus } from "@/lib/viber-parser/types"

export class FakeEventSource {
  static instances: FakeEventSource[] = []
  /** Открывать соединение автоматически (как настоящий EventSource). */
  static autoOpen = true

  readonly url: string
  readyState = 0
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
    if (FakeEventSource.autoOpen) {
      setTimeout(() => {
        if (this.closed) return
        this.open()
      }, 0)
    }
  }

  close() {
    this.closed = true
    this.readyState = 2
  }

  open() {
    this.readyState = 1
    this.onopen?.(new Event("open"))
  }

  emit(payload: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }))
  }

  fail() {
    this.onerror?.(new Event("error"))
  }

  static reset() {
    FakeEventSource.instances = []
    FakeEventSource.autoOpen = true
  }

  static get last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]
  }

  static get openCount() {
    return FakeEventSource.instances.length
  }
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

/** Любой ответ обязан отклоняться по AbortSignal — иначе отмена не проверяется. */
function withAbort(signal: AbortSignal | null | undefined, pending: Promise<Response>) {
  if (!signal) return pending
  if (signal.aborted) return Promise.reject(abortError())

  return new Promise<Response>((resolve, reject) => {
    // fetch отклоняется именно причиной сигнала: таймаут запроса приходит
    // как TimeoutError, а не как AbortError — от этого зависит учёт неудач
    const onAbort = () => reject(signal.reason ?? abortError())
    signal.addEventListener("abort", onAbort, { once: true })
    pending.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export interface Gate {
  release: (value?: unknown) => void
}

export interface Backend {
  status: ViberParserStatus | (() => ViberParserStatus)
  /** HTTP-код вместо тела статуса (для проверки обрыва связи). */
  statusHttpError: number | null
  /** HTTP-код вместо списка групп (503 = инстанс недоступен). */
  groupsHttpError: number | null
  /** HTTP-код вместо статистики базы (статистика не прочиталась). */
  dbStatsHttpError: number | null
  detail: TaskDetailDto | null
  /** HTTP-код вместо тела деталей (404 = задачи нет). */
  detailHttpError: number | null
  collectTaskId: string
  /** Участники, которые отдаёт ветка groups/:id/members. */
  members: ViberMember[]
  calls: { status: number; detail: number; collect: number; tasks: number }
  /** Пока true — ответы по деталям задачи «висят». */
  holdDetail: boolean
  /** Пока true — ответы по статусу «висят». */
  holdStatus: boolean
  pendingDetail: Array<() => void>
  pendingStatus: Array<(override?: ViberParserStatus | null) => void>
}

export function makeBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    status: idleStatus(),
    statusHttpError: null,
    groupsHttpError: null,
    dbStatsHttpError: null,
    detail: null,
    detailHttpError: null,
    collectTaskId: "task_new",
    members: [],
    calls: { status: 0, detail: 0, collect: 0, tasks: 0 },
    holdDetail: false,
    holdStatus: false,
    pendingDetail: [],
    pendingStatus: [],
    ...overrides,
  }
}

export function installFetch(backend: Backend) {
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.replace(/^\/api\/viber\//, "").split("?")[0]
    const method = (init?.method ?? "GET").toUpperCase()

    if (path === "status") {
      backend.calls.status += 1
      const send = (override?: ViberParserStatus | null) => {
        if (override !== undefined && override !== null) return json(override)
        if (backend.statusHttpError) {
          return json({ error: "Сервис сбора данных не ответил вовремя" }, backend.statusHttpError)
        }
        const value = typeof backend.status === "function" ? backend.status() : backend.status
        return json(value)
      }

      if (backend.holdStatus) {
        return new Promise<Response>((resolve) => {
          backend.pendingStatus.push((override) => resolve(send(override)))
        })
      }
      return send()
    }

    if (path === "groups") {
      if (backend.groupsHttpError) {
        return json(
          { message: "Устройство недоступно: проверьте статус подключения." },
          backend.groupsHttpError
        )
      }
      return json({
        count: 1,
        groups: [
          {
            conversationId: 42,
            groupId: 777,
            name: "Тестовая группа",
            conversationType: 5,
            memberCount: 120,
            messageCount: 10,
          },
        ],
      })
    }

    if (/^groups\/\d+\/members$/.test(path)) {
      return json({ conversationId: 42, count: backend.members.length, members: backend.members })
    }

    if (path === "database/stats") {
      if (backend.dbStatsHttpError) {
        return json({ message: "Статистика недоступна" }, backend.dbStatsHttpError)
      }
      return json({
        conversationsCount: 1,
        messagesCount: 10,
        participantsCount: 120,
        undecodedParticipantsCount: 0,
        isSnapshotCurrent: true,
      })
    }

    if (path === "tasks" && method === "GET") {
      backend.calls.tasks += 1
      return json(backend.detail ? [backend.detail] : [])
    }

    if (path === "messages/monitor/status") {
      return json({
        isRunning: false,
        groups: [],
        liveWatch: false,
        pollIntervalMs: 3000,
        lastProcessedMessageId: 0,
        processedMessagesCount: 0,
        phonesFromTextCount: 0,
        phonesFromViberCount: 0,
      })
    }

    if (path === "messages/monitored") return json([])

    if (path === "participants/collect" && method === "POST") {
      backend.calls.collect += 1
      return json({ taskId: backend.collectTaskId, message: "Сбор участников запущен" })
    }

    if (/^tasks\/[^/]+$/.test(path) && method === "GET") {
      backend.calls.detail += 1
      const send = () => {
        if (backend.detailHttpError) {
          return json({ error: "Задача не найдена" }, backend.detailHttpError)
        }
        return json(backend.detail)
      }
      if (backend.holdDetail) {
        return new Promise<Response>((resolve) => {
          backend.pendingDetail.push(() => resolve(send()))
        })
      }
      return send()
    }

    return json({ error: `unexpected ${method} ${path}` }, 500)
  }

  const spy = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    withAbort(init?.signal, impl(input, init))
  )
  vi.stubGlobal("fetch", spy)
  return spy
}

/** Уникальные участники: дедупликация панели не должна их схлопывать. */
export function makeMembers(count: number): ViberMember[] {
  return Array.from({ length: count }, (_, index) => {
    const phone = `+37529${1_000_000 + index}`
    return {
      participantId: index + 1,
      memberId: `mid-${index + 1}`,
      encryptedMemberId: null,
      phoneNumber: phone,
      rawNumber: phone,
      name: `Участник ${index + 1}`,
      isDecoded: true,
      roleLabel: "member",
      isSelf: false,
    }
  })
}

export function releaseDetail(backend: Backend) {
  const pending = backend.pendingDetail.splice(0)
  for (const resolve of pending) resolve()
}

export function releaseStatus(backend: Backend, override?: ViberParserStatus | null) {
  const pending = backend.pendingStatus.splice(0)
  for (const resolve of pending) resolve(override)
}

export async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

export async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

export function connectionBadgeText() {
  const node = document.querySelector('[data-testid="service-connection"]')
  return node?.textContent ?? ""
}

export function idleStatus(): ViberParserStatus {
  return {
    state: "IDLE",
    isDriverActive: true,
    taskId: null,
    latestTaskStatus: null,
    currentStep: null,
    progress: null,
    groupName: null,
  }
}

export function runningStatus(taskId: string, currentStep = "paging_participants"): ViberParserStatus {
  return {
    state: "RUNNING",
    isDriverActive: true,
    taskId,
    latestTaskStatus: "running",
    currentStep,
    progress: null,
    groupName: "Тестовая группа",
  }
}

export function finishedStatus(taskId: string, latest: TaskStatus = "ready"): ViberParserStatus {
  return {
    state: latest === "error" ? "ERROR" : "IDLE",
    isDriverActive: true,
    taskId,
    latestTaskStatus: latest,
    currentStep: null,
    progress: null,
    groupName: "Тестовая группа",
  }
}

const STEP_NAMES = [
  "initializing",
  "resolving_group",
  "attaching_frida",
  "navigating_viber",
  "paging_participants",
  "syncing_live_db",
  "restarting_viber",
  "waiting_numbers_sync",
  "deduplicating_and_finalizing",
  "exporting_results",
  "fetching_online_activity",
  "exporting_results",
]

export function taskDetail(
  id: string,
  status: TaskStatus,
  options: { steps?: number; withResult?: boolean } = {}
): TaskDetailDto {
  const steps = options.steps ?? (status === "ready" ? STEP_NAMES.length : 4)
  const history = STEP_NAMES.slice(0, steps).map((step, index) => ({
    step,
    description: `Шаг ${step}`,
    startedAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    durationMs: 1500,
  }))

  return {
    id,
    groupTarget: "Тестовая группа",
    groupName: "Тестовая группа",
    conversationId: 42,
    status,
    startedAt: history[0]?.startedAt ?? new Date(1_700_000_000_000).toISOString(),
    completedAt: status === "ready" ? new Date(1_700_000_020_000).toISOString() : null,
    stepHistory: history,
    currentStep:
      status === "ready"
        ? null
        : {
            step: STEP_NAMES[steps] ?? "paging_participants",
            description: "Текущий шаг",
            startedAt: new Date(1_700_000_000_000 + steps * 1000).toISOString(),
          },
    progress: null,
    error: null,
    result:
      options.withResult ?? status === "ready"
        ? {
            group: "Тестовая группа",
            conversationId: 42,
            pagesCount: 3,
            participantsCount: 120,
            participantsWithPhone: 87,
            savedJsonPath: "a.json",
            savedTxtPath: "a.txt",
          }
        : null,
  }
}

/** jsdom не реализует API, которые дёргает Radix при рендере. */
export function installBrowserStubs() {
  if (!("ResizeObserver" in globalThis)) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!("matchMedia" in window)) {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }
}
