import {
  STATUS_POLL_MS,
  STATUS_REQUEST_TIMEOUT_MS,
} from "@/lib/viber-parser/polling"
import type { ViberParserStatus } from "@/lib/viber-parser/types"

/**
 * Состояние связи с сервисом сбора.
 *
 * Важно: «нет связи» (опрос не дошёл / не успел) и «ошибка сервиса»
 * (сервис ответил, но отдаёт ошибки) — это разные вещи.
 * Медленный или оборванный опрос НЕ должен выглядеть как отключённый сервис.
 *
 * Про здоровье устройства этот источник ничего не знает: `isDriverActive:false`
 * означает ровно «`GET /api/tasks` ответил не-2xx», поэтому и подпись говорит
 * про ошибки сервиса, а не про недоступное устройство.
 */
export type ConnectionState = "connecting" | "online" | "service-error" | "no-connection"

export interface ConnectionTracker {
  /** Сколько неудачных опросов подряд. */
  failures: number
  /** Время последнего успешного ответа (мс, Date.now()). */
  lastOkAt: number | null
  /** Текст последней ошибки опроса. */
  lastError: string | null
}

export const INITIAL_CONNECTION: ConnectionTracker = {
  failures: 0,
  lastOkAt: null,
  lastError: null,
}

/** Сколько неудачных опросов подряд терпим, прежде чем сказать «нет связи». */
export const CONNECTION_FAILURE_TOLERANCE = 2

/**
 * Насколько старым может быть последний успешный ответ, прежде чем связь
 * считается потерянной.
 *
 * Считается от реальных таймингов опроса: пока запрос ещё может вернуться,
 * говорить «нет связи» нельзя — иначе живой, но медленный сервис давал бы
 * «нет связи» каждый цикл. Реальный обрыв (connection refused, 502/504)
 * ловится счётчиком неудач за считанные секунды и этого порога не ждёт.
 */
export const CONNECTION_STALE_MS = STATUS_POLL_MS + STATUS_REQUEST_TIMEOUT_MS + 2_500

export function markConnectionOk(at: number): ConnectionTracker {
  return { failures: 0, lastOkAt: at, lastError: null }
}

export function markConnectionFailure(
  tracker: ConnectionTracker,
  error: string | null
): ConnectionTracker {
  return {
    failures: tracker.failures + 1,
    lastOkAt: tracker.lastOkAt,
    lastError: error,
  }
}

export interface ConnectionInput {
  tracker: ConnectionTracker
  /** Последний УСПЕШНО полученный статус (сохраняется при обрыве связи). */
  status: ViberParserStatus | null
  now: number
  tolerance?: number
  staleMs?: number
}

export function deriveConnectionState(input: ConnectionInput): ConnectionState {
  const { tracker, status, now } = input
  const tolerance = input.tolerance ?? CONNECTION_FAILURE_TOLERANCE
  const staleMs = input.staleMs ?? CONNECTION_STALE_MS

  const neverConnected = tracker.lastOkAt === null
  const lostConnection =
    tracker.failures >= tolerance ||
    (neverConnected && tracker.failures > 0) ||
    (!neverConnected && now - (tracker.lastOkAt as number) > staleMs)

  if (lostConnection) return "no-connection"
  if (!status) return "connecting"
  if (!status.isDriverActive) return "service-error"
  return "online"
}

export function formatAgo(ms: number): string {
  const safe = Math.max(0, Math.round(ms / 1000))
  if (safe < 60) return `${safe} сек`
  const minutes = Math.floor(safe / 60)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  return `${hours} ч ${minutes % 60} мин`
}

export interface ConnectionPresentation {
  /** Текст бейджа рядом с названием сервиса. */
  label: string
  /** Цветовая роль бейджа/иконки. */
  tone: "ok" | "warn" | "danger" | "muted"
  /** Подпись под названием сервиса. */
  hint: string
  /** Показывать ли данные как «последние известные», а не актуальные. */
  stale: boolean
}

export function describeConnection(
  state: ConnectionState,
  input: ConnectionInput
): ConnectionPresentation {
  const { tracker, status, now } = input

  if (state === "online") {
    return {
      label: "Онлайн",
      tone: "ok",
      hint: "Автоматическое обновление и обработка данных",
      stale: false,
    }
  }

  if (state === "connecting") {
    return {
      label: "Подключение",
      tone: "muted",
      hint: "Проверяем связь с сервисом сбора данных",
      stale: false,
    }
  }

  if (state === "service-error") {
    return {
      label: "Ошибка сервиса",
      tone: "danger",
      hint: status?.error?.trim() || "Сервис сбора данных отвечает ошибками",
      stale: false,
    }
  }

  const parts: string[] = ["Нет ответа от сервиса"]
  if (tracker.lastOkAt !== null) {
    parts.push(`показаны данные ${formatAgo(now - tracker.lastOkAt)} назад`)
  }
  if (tracker.lastError) {
    parts.push(tracker.lastError)
  }

  return {
    label: "Нет связи",
    tone: "warn",
    hint: `${parts.join(" · ")}. Продолжаем попытки подключения…`,
    stale: tracker.lastOkAt !== null,
  }
}
