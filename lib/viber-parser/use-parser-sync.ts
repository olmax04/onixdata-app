"use client"

import * as React from "react"

import { errorMessage, isAbortError, viberRequest } from "@/lib/viber-parser/client"
import {
  initialParserSyncState,
  isTerminalTaskStatus,
  OFFLINE_FAILURE_THRESHOLD,
  parserSyncReducer,
  selectConnectionState,
  selectIsTaskLost,
  selectIsTaskRunning,
  type TerminalTaskInfo,
} from "@/lib/viber-parser/parser-sync"
import type {
  ParserConnectionState,
  TaskDetailDto,
  TaskEvent,
  TaskSummaryDto,
  ViberParserStatus,
} from "@/lib/viber-parser/types"

/** Опрос при активной задаче. */
export const POLL_ACTIVE_MS = 2000
/** Опрос в покое. */
export const POLL_IDLE_MS = 5000
/** Опрос, когда вкладка скрыта. */
export const POLL_HIDDEN_MS = 30_000
/** Плавный backoff, когда связь с бэкендом потеряна. */
export const OFFLINE_BACKOFF_MS = [5000, 10_000, 20_000]
/** Шаг «часов» состояния связи: без него офлайн по молчанию наступал бы только на ре-рендере. */
export const CONNECTION_TICK_MS = 1000

export interface StartCollectPayload {
  group: string
  allowPartial?: boolean
  restartApp?: boolean
  idleTimeoutMs?: number
  numbersSyncTimeoutMs?: number
  syncLiveDbAfter?: boolean
  fetchOnlineStatus?: boolean
}

export interface UseParserSyncOptions {
  onTerminal?: (info: TerminalTaskInfo) => void
  /** Активная задача исчезла из успешного ответа бэкенда (перезапуск процесса). */
  onTaskLost?: (taskId: string) => void
}

export interface ParserSyncApi {
  status: ViberParserStatus | null
  task: TaskDetailDto | null
  tasks: TaskSummaryDto[]
  connection: ParserConnectionState
  isTaskRunning: boolean
  /** Карточка задачи осталась, но бэкенд про неё больше не знает. */
  isTaskLost: boolean
  consecutiveFailures: number
  lastError: string | null
  initialLoadDone: boolean
  refresh: () => Promise<void>
  startCollect: (payload: StartCollectPayload) => Promise<{ taskId: string | null }>
  stopTask: () => Promise<void>
  dismissTask: () => void
}

export function useViberParserSync(options: UseParserSyncOptions = {}): ParserSyncApi {
  const [state, dispatch] = React.useReducer(parserSyncReducer, initialParserSyncState)
  const [pollTick, setPollTick] = React.useState(0)

  const stateRef = React.useRef(state)
  stateRef.current = state

  const onTerminalRef = React.useRef(options.onTerminal)
  onTerminalRef.current = options.onTerminal

  const onTaskLostRef = React.useRef(options.onTaskLost)
  onTaskLostRef.current = options.onTaskLost

  const seqRef = React.useRef(0)
  const runIdRef = React.useRef(0)
  const inFlightRef = React.useRef<AbortController | null>(null)
  const cancelledRef = React.useRef(false)

  const runPoll = React.useCallback(async () => {
    if (cancelledRef.current) return

    const myRun = ++runIdRef.current
    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller
    const seq = ++seqRef.current

    try {
      const payload = await viberRequest<ViberParserStatus>("status", {
        signal: controller.signal,
      })
      if (!cancelledRef.current && myRun === runIdRef.current) {
        dispatch({ type: "poll_success", payload, seq, now: Date.now() })
      }
    } catch (error) {
      if (!cancelledRef.current && myRun === runIdRef.current && !isAbortError(error)) {
        // Ошибка опроса ничего не сбрасывает: последнее известное состояние остаётся на экране.
        dispatch({ type: "poll_failure", error: errorMessage(error), seq, now: Date.now() })
      }
    } finally {
      if (inFlightRef.current === controller) inFlightRef.current = null
    }

    if (!cancelledRef.current && myRun === runIdRef.current) {
      setPollTick((value) => value + 1)
    }
  }, [])

  const runPollRef = React.useRef(runPoll)
  runPollRef.current = runPoll

  const isTaskRunning = selectIsTaskRunning(state)
  const isTaskLost = selectIsTaskLost(state)

  // «Часы» состояния связи: пока копятся ошибки, тикаем раз в секунду, чтобы переход
  // в офлайн по молчанию бэкенда случался сам, а не на случайном ре-рендере.
  const [connectionNow, setConnectionNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (state.consecutiveFailures === 0) return
    setConnectionNow(Date.now())
    const timer = window.setInterval(() => setConnectionNow(Date.now()), CONNECTION_TICK_MS)
    return () => window.clearInterval(timer)
  }, [state.consecutiveFailures])

  const connection = selectConnectionState(state, connectionNow)

  const nextDelayMs = state.hidden
    ? POLL_HIDDEN_MS
    : connection === "offline"
      ? OFFLINE_BACKOFF_MS[
          Math.min(
            Math.max(state.consecutiveFailures - OFFLINE_FAILURE_THRESHOLD, 0),
            OFFLINE_BACKOFF_MS.length - 1
          )
        ] ?? POLL_IDLE_MS
      : isTaskRunning
        ? POLL_ACTIVE_MS
        : POLL_IDLE_MS

  // Первый опрос сразу при монтировании.
  React.useEffect(() => {
    cancelledRef.current = false
    void runPollRef.current()
    return () => {
      cancelledRef.current = true
      inFlightRef.current?.abort()
    }
  }, [])

  // Единственный цикл: следующий тик планируется только после ответа предыдущего.
  React.useEffect(() => {
    if (pollTick === 0) return
    const timer = window.setTimeout(() => {
      void runPollRef.current()
    }, nextDelayMs)
    return () => window.clearTimeout(timer)
  }, [pollTick, nextDelayMs])

  // Скрытая вкладка опрашивается редко; возврат к вкладке и появление сети — сразу.
  React.useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.hidden
      dispatch({ type: "visibility", hidden })
      if (!hidden) void runPollRef.current()
    }
    const handleOnline = () => {
      void runPollRef.current()
    }

    dispatch({ type: "visibility", hidden: document.hidden })
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("online", handleOnline)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  const activeTaskId = isTaskRunning ? state.task?.id ?? state.status?.taskId ?? null : null

  // Поток событий активной задачи. onerror поток НЕ закрывает: браузер переподключится сам.
  React.useEffect(() => {
    if (!activeTaskId) return
    if (typeof EventSource === "undefined") return

    const source = new EventSource(`/api/viber/tasks/${activeTaskId}/events`)
    let hadError = false

    source.onopen = () => {
      dispatch({ type: "sse_open" })
      if (hadError) {
        hadError = false
        // Добираем то, что пропустили за время обрыва.
        void runPollRef.current()
      }
    }

    source.onmessage = (event: MessageEvent<string>) => {
      const raw = typeof event.data === "string" ? event.data.trim() : ""
      if (!raw || raw.startsWith(":")) return

      let parsed: TaskEvent | null = null
      try {
        parsed = JSON.parse(raw) as TaskEvent
      } catch {
        return
      }
      if (!parsed || typeof parsed.taskId !== "string") return

      // seq из общего счётчика двигает lastEventSeq: ответ поллинга, стартовавший
      // до события, донесёт историю и связь, но шаг и прогресс не откатит.
      dispatch({ type: "sse_event", event: parsed, seq: ++seqRef.current, now: Date.now() })

      if (isTerminalTaskStatus(parsed.status)) {
        source.close()
        void runPollRef.current()
      }
    }

    source.onerror = () => {
      hadError = true
      dispatch({ type: "sse_error" })
      if (isTerminalTaskStatus(stateRef.current.task?.status)) {
        source.close()
      }
    }

    return () => {
      source.close()
    }
  }, [activeTaskId])

  // Побочные эффекты завершения задачи — ровно один раз на задачу.
  React.useEffect(() => {
    const pending = state.pendingTerminal
    if (!pending) return
    onTerminalRef.current?.(pending)
    dispatch({ type: "terminal_handled", taskId: pending.taskId })
  }, [state.pendingTerminal])

  // Предупреждение о потере задачи — тоже ровно один раз.
  React.useEffect(() => {
    const lostTaskId = state.pendingLostTaskId
    if (!lostTaskId) return
    onTaskLostRef.current?.(lostTaskId)
    dispatch({ type: "lost_task_handled", taskId: lostTaskId })
  }, [state.pendingLostTaskId])

  const refresh = React.useCallback(() => runPollRef.current(), [])

  const startCollect = React.useCallback(async (payload: StartCollectPayload) => {
    const response = await viberRequest<{ taskId: string | null; message?: string }>(
      "participants/collect",
      { method: "POST", body: payload }
    )

    // Если поллинг уже показал эту задачу, оптимистичный сброс только откатил бы прогресс.
    if (response?.taskId && stateRef.current.task?.id !== response.taskId) {
      dispatch({
        type: "task_started",
        taskId: response.taskId,
        group: payload.group,
        seq: ++seqRef.current,
        now: Date.now(),
      })
    }
    void runPollRef.current()
    return { taskId: response?.taskId ?? null }
  }, [])

  const stopTask = React.useCallback(async () => {
    const taskId = stateRef.current.task?.id ?? stateRef.current.status?.taskId ?? null
    if (taskId) {
      await viberRequest(`tasks/${taskId}/stop`, { method: "POST" })
    } else {
      await viberRequest("stop", { method: "POST" })
    }
    void runPollRef.current()
  }, [])

  const dismissTask = React.useCallback(() => {
    dispatch({ type: "reset_view" })
  }, [])

  return {
    status: state.status,
    task: state.task,
    tasks: state.tasks,
    connection,
    isTaskRunning,
    isTaskLost,
    consecutiveFailures: state.consecutiveFailures,
    lastError: state.lastError,
    initialLoadDone: pollTick > 0,
    refresh,
    startCollect,
    stopTask,
    dismissTask,
  }
}
