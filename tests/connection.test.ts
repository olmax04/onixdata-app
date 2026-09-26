import { describe, expect, it } from "vitest"

import {
  CONNECTION_FAILURE_TOLERANCE,
  CONNECTION_STALE_MS,
  INITIAL_CONNECTION,
  deriveConnectionState,
  describeConnection,
  formatAgo,
  markConnectionFailure,
  markConnectionOk,
} from "@/lib/viber-parser/connection"
import { STATUS_POLL_MS, STATUS_REQUEST_TIMEOUT_MS } from "@/lib/viber-parser/polling"
import type { ViberParserStatus } from "@/lib/viber-parser/types"

const NOW = 1_700_000_000_000

const running: ViberParserStatus = {
  state: "RUNNING",
  isDriverActive: true,
  taskId: "task_a",
  latestTaskStatus: "running",
}

const serviceError: ViberParserStatus = {
  state: "ERROR",
  isDriverActive: false,
  taskId: null,
  error: "Сервис сбора данных ответил ошибкой (503)",
}

describe("deriveConnectionState", () => {
  it("до первого ответа — подключение", () => {
    expect(deriveConnectionState({ tracker: INITIAL_CONNECTION, status: null, now: NOW })).toBe(
      "connecting"
    )
  })

  it("если ни разу не подключались, первая же неудача — нет связи", () => {
    const tracker = markConnectionFailure(INITIAL_CONNECTION, "net")
    expect(deriveConnectionState({ tracker, status: null, now: NOW })).toBe("no-connection")
  })

  it("успешный ответ — онлайн", () => {
    expect(
      deriveConnectionState({ tracker: markConnectionOk(NOW), status: running, now: NOW })
    ).toBe("online")
  })

  it("одна неудача при свежем ответе не роняет связь", () => {
    const tracker = markConnectionFailure(markConnectionOk(NOW), "timeout")
    expect(deriveConnectionState({ tracker, status: running, now: NOW + 2_500 })).toBe("online")
    expect(tracker.failures).toBeLessThan(CONNECTION_FAILURE_TOLERANCE)
  })

  it("порог по числу неудач подряд", () => {
    let tracker = markConnectionOk(NOW)
    for (let i = 0; i < CONNECTION_FAILURE_TOLERANCE; i += 1) {
      tracker = markConnectionFailure(tracker, "timeout")
    }
    expect(deriveConnectionState({ tracker, status: running, now: NOW + 1_000 })).toBe(
      "no-connection"
    )
  })

  it("порог по устареванию последнего успеха", () => {
    const tracker = markConnectionOk(NOW)
    expect(
      deriveConnectionState({ tracker, status: running, now: NOW + CONNECTION_STALE_MS - 1 })
    ).toBe("online")
    expect(
      deriveConnectionState({ tracker, status: running, now: NOW + CONNECTION_STALE_MS + 1 })
    ).toBe("no-connection")
  })

  it("порог устаревания больше, чем цикл опроса плюс клиентский таймаут", () => {
    // соотношение должно держаться, даже если тайминги опроса поменяют
    expect(CONNECTION_STALE_MS).toBeGreaterThan(STATUS_POLL_MS + STATUS_REQUEST_TIMEOUT_MS)
  })

  it("сервис ответил с ошибкой — это не «нет связи»", () => {
    expect(
      deriveConnectionState({ tracker: markConnectionOk(NOW), status: serviceError, now: NOW })
    ).toBe("service-error")
  })

  it("обрыв важнее ошибки сервиса: показываем последнее известное состояние", () => {
    let tracker = markConnectionOk(NOW)
    tracker = markConnectionFailure(tracker, "timeout")
    tracker = markConnectionFailure(tracker, "timeout")
    expect(deriveConnectionState({ tracker, status: serviceError, now: NOW + 1_000 })).toBe(
      "no-connection"
    )
  })

  it("восстановление автоматическое после первого успешного ответа", () => {
    let tracker = markConnectionOk(NOW)
    tracker = markConnectionFailure(tracker, "timeout")
    tracker = markConnectionFailure(tracker, "timeout")
    expect(deriveConnectionState({ tracker, status: running, now: NOW + 5_000 })).toBe(
      "no-connection"
    )

    const recovered = markConnectionOk(NOW + 6_000)
    expect(recovered.failures).toBe(0)
    expect(recovered.lastError).toBeNull()
    expect(deriveConnectionState({ tracker: recovered, status: running, now: NOW + 6_000 })).toBe(
      "online"
    )
  })
})

describe("describeConnection", () => {
  it("онлайн", () => {
    const view = describeConnection("online", {
      tracker: markConnectionOk(NOW),
      status: running,
      now: NOW,
    })
    expect(view).toMatchObject({ label: "Онлайн", tone: "ok", stale: false })
  })

  it("нет связи: показывает возраст данных и причину", () => {
    const tracker = markConnectionFailure(
      markConnectionFailure(markConnectionOk(NOW), "timeout"),
      "Сервис сбора данных не ответил вовремя"
    )
    const view = describeConnection("no-connection", {
      tracker,
      status: running,
      now: NOW + 9_000,
    })

    expect(view.label).toBe("Нет связи")
    expect(view.tone).toBe("warn")
    expect(view.stale).toBe(true)
    expect(view.hint).toContain("9 сек назад")
    expect(view.hint).toContain("не ответил вовремя")
  })

  it("нет связи без единого успешного ответа не врёт про «последние данные»", () => {
    const view = describeConnection("no-connection", {
      tracker: markConnectionFailure(INITIAL_CONNECTION, "net"),
      status: null,
      now: NOW,
    })
    expect(view.stale).toBe(false)
    expect(view.hint).not.toContain("назад")
  })

  it("ошибка сервиса подписана честно — про ошибки, а не про устройство", () => {
    const view = describeConnection("service-error", {
      tracker: markConnectionOk(NOW),
      status: serviceError,
      now: NOW,
    })
    expect(view.label).toBe("Ошибка сервиса")
    expect(view.tone).toBe("danger")
    expect(view.hint).toContain("503")

    const fallback = describeConnection("service-error", {
      tracker: markConnectionOk(NOW),
      status: { ...serviceError, error: null },
      now: NOW,
    })
    expect(fallback.hint).toBe("Сервис сбора данных отвечает ошибками")
  })

  it("подключение", () => {
    const view = describeConnection("connecting", {
      tracker: INITIAL_CONNECTION,
      status: null,
      now: NOW,
    })
    expect(view).toMatchObject({ label: "Подключение", tone: "muted" })
  })
})

describe("formatAgo", () => {
  it("секунды, минуты, часы", () => {
    expect(formatAgo(0)).toBe("0 сек")
    expect(formatAgo(9_400)).toBe("9 сек")
    expect(formatAgo(65_000)).toBe("1 мин")
    expect(formatAgo(3_600_000 + 120_000)).toBe("1 ч 2 мин")
  })
})
