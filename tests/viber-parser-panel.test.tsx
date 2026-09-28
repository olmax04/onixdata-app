// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock("sonner", () => ({ toast: toastMock }))

import { ViberParserPanel } from "@/components/dashboard/viber-parser-panel"
import {
  advance,
  Backend,
  connectionBadgeText,
  FakeEventSource,
  finishedStatus,
  idleStatus,
  installBrowserStubs,
  installFetch,
  makeBackend,
  releaseDetail,
  releaseStatus,
  runningStatus,
  settle,
  taskDetail,
} from "./support/panel-harness"

import { CONNECTION_STALE_MS } from "@/lib/viber-parser/connection"
import { STATUS_POLL_MS, STATUS_REQUEST_TIMEOUT_MS } from "@/lib/viber-parser/polling"

const POLL_MS = STATUS_POLL_MS

let backend: Backend
let fetchSpy: ReturnType<typeof installFetch>

beforeEach(() => {
  vi.useFakeTimers()
  installBrowserStubs()
  FakeEventSource.reset()
  vi.stubGlobal("EventSource", FakeEventSource)
  toastMock.success.mockClear()
  toastMock.error.mockClear()
  toastMock.info.mockClear()
  backend = makeBackend()
  fetchSpy = installFetch(backend)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function mountPanel() {
  render(<ViberParserPanel />)
  await settle()
  await advance(0)
}

function badgeText() {
  return connectionBadgeText()
}

describe("бейдж состояния связи", () => {
  it("сервис отвечает — «Онлайн»", async () => {
    backend.status = idleStatus()
    await mountPanel()
    expect(badgeText()).toContain("Онлайн")
  })

  it("до первого ответа — «Подключение»", async () => {
    backend.holdStatus = true
    render(<ViberParserPanel />)
    await settle()
    expect(badgeText()).toContain("Подключение")
  })

  it("таймаут прокси не превращается в «Офлайн» — показываем «Нет связи»", async () => {
    backend.status = idleStatus()
    await mountPanel()
    expect(badgeText()).toContain("Онлайн")

    backend.statusHttpError = 504
    await advance(POLL_MS * 3)

    const text = badgeText()
    expect(text).toContain("Нет связи")
    expect(text).not.toContain("Офлайн")
  })

  it("после восстановления связи бейдж возвращается сам", async () => {
    backend.status = idleStatus()
    await mountPanel()
    backend.statusHttpError = 504
    await advance(POLL_MS * 3)
    expect(badgeText()).toContain("Нет связи")

    backend.statusHttpError = null
    await advance(POLL_MS * 2)
    expect(badgeText()).toContain("Онлайн")
  })

  it("сервис ответил ошибкой — «Ошибка сервиса», а не «Нет связи»", async () => {
    backend.status = {
      state: "ERROR",
      isDriverActive: false,
      taskId: null,
      error: "Сервис сбора данных ответил ошибкой (503)",
    }
    await mountPanel()

    const text = badgeText()
    expect(text).toContain("Ошибка сервиса")
    expect(text).toContain("503")
  })
})

describe("прогресс этапов", () => {
  it("завершённая задача показывает все пройденные этапы, а не первые два", async () => {
    backend.status = finishedStatus("task_a")
    backend.detail = taskDetail("task_a", "ready")
    await mountPanel()

    expect(screen.getByText(/Все этапы сбора успешно пройдены/)).toBeTruthy()
    expect(screen.getByText("Проверка активности")).toBeTruthy()
    // 10 карточек этапов, у каждой блок со временем
    expect(screen.getAllByText(/^Время/)).toHaveLength(10)
  })

  it("событие SSE двигает текущий этап без ожидания опроса", async () => {
    backend.status = runningStatus("task_a", "attaching_frida")
    backend.detail = taskDetail("task_a", "running", { steps: 3 })
    await mountPanel()

    const source = FakeEventSource.last
    expect(source).toBeTruthy()

    await advance(0)
    const before = backend.calls.detail
    const timingsBefore = screen.getAllByText(/^Время/).length

    await emitEvent(source, {
      taskId: "task_a",
      status: "running",
      step: {
        step: "paging_participants",
        description: "Сбор страниц",
        startedAt: new Date(1_700_000_010_000).toISOString(),
      },
      timestamp: new Date(1_700_000_010_000).toISOString(),
    })

    // событие применено локально, без дополнительного запроса деталей
    expect(backend.calls.detail).toBe(before)
    // предыдущий шаг ушёл в историю и получил длительность
    expect(screen.getAllByText(/^Время/).length).toBe(timingsBefore + 1)
  })
})

async function emitEvent(source: FakeEventSource, payload: unknown) {
  await advanceWith(() => source.emit(payload))
}

async function advanceWith(action: () => void) {
  await reactAct(async () => {
    action()
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe("уведомление о завершении", () => {
  it("не объявляет о завершении по снимку из SSE — там нет итогов", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    await mountPanel()

    backend.holdDetail = true
    const source = FakeEventSource.last
    await emitEvent(source, { taskId: "task_a", status: "ready", timestamp: new Date().toISOString() })

    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it("показывает реальные числа, когда финальные детали дотянуты", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    render(<ViberParserPanel deviceId="worker-03" />)
    await settle()
    await advance(0)

    backend.holdDetail = true
    const source = FakeEventSource.last
    await emitEvent(source, { taskId: "task_a", status: "ready", timestamp: new Date().toISOString() })
    expect(toastMock.success).not.toHaveBeenCalled()

    backend.detail = taskDetail("task_a", "ready")
    backend.status = finishedStatus("task_a")
    backend.holdDetail = false
    releaseDetail(backend)
    await advance(POLL_MS)

    expect(toastMock.success).toHaveBeenCalledTimes(1)
    expect(toastMock.success.mock.calls[0][1]).toMatchObject({
      description: "Собрано: 120, с номерами: 87",
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/viber/users/sync/task/task_a?deviceId=worker-03",
      expect.objectContaining({ method: "POST" })
    )
  })
})

describe("скрытие карточки задачи", () => {
  it("скрытая завершённая задача перестаёт опрашиваться (N1)", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    await mountPanel()

    // Задача завершилась по SSE, а запрос финальных деталей «висит» на медленном бэкенде
    backend.holdDetail = true
    const source = FakeEventSource.last
    await emitEvent(source, { taskId: "task_a", status: "ready", timestamp: new Date().toISOString() })

    fireEvent.click(screen.getByRole("button", { name: "Скрыть" }))
    await settle()
    expect(screen.queryByText("task_a")).toBeNull()

    // Бэкенд ожил и отдал полный снимок уже скрытой задачи
    backend.detail = taskDetail("task_a", "ready")
    backend.status = finishedStatus("task_a")
    backend.holdDetail = false
    releaseDetail(backend)
    await advance(POLL_MS)

    const baseline = backend.calls.detail
    await advance(POLL_MS * 4)

    expect(backend.calls.detail).toBe(baseline)
    expect(screen.queryByText("task_a")).toBeNull()
  })

  it("новая задача после скрытия отображается", async () => {
    backend.status = finishedStatus("task_a")
    backend.detail = taskDetail("task_a", "ready")
    await mountPanel()

    fireEvent.click(screen.getByRole("button", { name: "Скрыть" }))
    await settle()
    expect(screen.queryByText("task_a")).toBeNull()

    backend.detail = taskDetail("task_b", "running")
    backend.status = runningStatus("task_b")
    await advance(POLL_MS * 2)

    expect(screen.getByText("task_b")).toBeTruthy()
  })
})

describe("смена задачи и отставшие ответы", () => {
  it("отставший ответ статуса не стирает только что запущенную задачу (N5)", async () => {
    backend.status = idleStatus()
    await mountPanel()

    // Опрос статуса ушёл и завис
    backend.holdStatus = true
    await advance(POLL_MS)
    expect(backend.pendingStatus.length).toBe(1)

    // Пользователь запускает сбор: POST возвращает новую задачу
    backend.holdStatus = false
    backend.collectTaskId = "task_new"
    backend.detail = taskDetail("task_new", "running")
    backend.status = runningStatus("task_new")

    fireEvent.click(screen.getByRole("button", { name: /Запустить сбор участников/ }))
    await advance(50)
    await advance(50)
    expect(screen.queryByText("task_new"), "новая задача должна появиться сразу").toBeTruthy()

    // Приходит ответ на запрос, отправленный ДО запуска: задач тогда не было
    releaseStatus(backend, idleStatus())
    await advance(50)

    expect(
      screen.queryByText("task_new"),
      "устаревший ответ статуса не должен стирать новую задачу"
    ).toBeTruthy()
  })

  it("поздние детали старой задачи не подменяют новую", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running", { steps: 3 })
    await mountPanel()
    expect(screen.getByText("task_a")).toBeTruthy()

    // Запрос деталей по task_a завис на медленном бэкенде
    backend.holdDetail = true
    await advance(POLL_MS)
    expect(backend.pendingDetail.length).toBe(1)

    // Пока он висел, началась новая задача
    backend.holdDetail = false
    backend.detail = taskDetail("task_b", "running", { steps: 2 })
    backend.status = runningStatus("task_b")
    await advance(POLL_MS)
    expect(screen.getByText("task_b")).toBeTruthy()

    // Отвечает старый висевший запрос — снимком уже неактуальной задачи
    const staleDetail = taskDetail("task_a", "running", { steps: 6 })
    backend.detail = staleDetail
    releaseDetail(backend)
    await advance(50)
    backend.detail = taskDetail("task_b", "running", { steps: 2 })

    expect(screen.getByText("task_b")).toBeTruthy()
    expect(screen.queryByText("task_a")).toBeNull()
  })
})

describe("управление задачей", () => {
  it("все операции активной задачи остаются на выбранном инстансе", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    render(<ViberParserPanel deviceId="worker-03" />)
    await settle()
    await advance(0)

    const urls = fetchSpy.mock.calls.map(([input]) => String(input))
    expect(urls).toContain("/api/viber/tasks/task_a?deviceId=worker-03")
    expect((FakeEventSource.last as unknown as { url: string }).url).toBe(
      "/api/viber/tasks/task_a/events?deviceId=worker-03"
    )

    const posts: string[] = []
    const original = global.fetch as typeof fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if ((init?.method ?? "GET").toUpperCase() === "POST") posts.push(url)
      return original(input as RequestInfo, init)
    })

    fireEvent.click(screen.getByRole("button", { name: "Остановить сбор" }))
    await advance(50)

    expect(posts).toContain("/api/viber/tasks/task_a/stop?deviceId=worker-03")
  })

  it("детали задачи из истории запрашиваются с выбранного инстанса", async () => {
    backend.status = finishedStatus("task_a")
    backend.detail = taskDetail("task_a", "ready")
    render(<ViberParserPanel deviceId="worker-03" />)
    await settle()
    await advance(0)

    await reactAct(async () => {
      const tab = screen.getByRole("tab", { name: /История/ })
      fireEvent.mouseDown(tab)
      fireEvent.click(tab)
      await vi.advanceTimersByTimeAsync(0)
    })

    fetchSpy.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Детали" }))
    await advance(0)

    expect(fetchSpy.mock.calls.map(([input]) => String(input))).toContain(
      "/api/viber/tasks/task_a?deviceId=worker-03"
    )
  })

  it("кнопка «Остановить сбор» шлёт сигнал остановки текущей задаче", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    await mountPanel()

    const calls: string[] = []
    const original = global.fetch as typeof fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if ((init?.method ?? "GET").toUpperCase() === "POST") calls.push(url)
      return original(input as RequestInfo, init)
    })

    fireEvent.click(screen.getByRole("button", { name: "Остановить сбор" }))
    await advance(50)

    expect(calls).toContain("/api/viber/tasks/task_a/stop")
  })

  it("занятый эмулятор (409) не запускает сбор и показывает ошибку", async () => {
    backend.status = idleStatus()
    await mountPanel()

    const original = global.fetch as typeof fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.endsWith("participants/collect")) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "Эмулятор занят другой задачей" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          })
        )
      }
      return original(input as RequestInfo, init)
    })

    fireEvent.click(screen.getByRole("button", { name: /Запустить сбор участников/ }))
    await advance(50)

    expect(toastMock.error).toHaveBeenCalled()
    expect(toastMock.error.mock.calls[0][1]).toMatchObject({
      description: "Эмулятор занят другой задачей",
    })
    expect(screen.queryByText("task_new")).toBeNull()
  })

  it("остановленная задача показывает прерванный шаг, а не спиннер", async () => {
    backend.status = finishedStatus("task_a", "stopped")
    backend.detail = {
      ...taskDetail("task_a", "stopped", { steps: 5 }),
      status: "stopped",
    }
    await mountPanel()

    // 5 шагов в истории, прерван был следующий — syncing_live_db
    expect(
      document.querySelector('[data-step="syncing_live_db"]')?.getAttribute("data-step-state")
    ).toBe("stopped")
    expect(
      document.querySelector('[data-step="paging_participants"]')?.getAttribute("data-step-state")
    ).toBe("completed")
    expect(document.querySelector('[data-step-state="current"]')).toBeNull()
  })
})

describe("устойчивость опроса", () => {
  it("зависший запрос статуса обрывается по клиентскому таймауту", async () => {
    backend.status = idleStatus()
    await mountPanel()
    expect(badgeText()).toContain("Онлайн")

    // Ответ не придёт никогда — спасает только таймаут запроса
    backend.holdStatus = true
    await advance(POLL_MS)
    expect(backend.pendingStatus.length).toBe(1)

    // таймаут запроса + порог устаревания последнего успешного ответа
    await advance(STATUS_REQUEST_TIMEOUT_MS + CONNECTION_STALE_MS)
    expect(badgeText()).toContain("Нет связи")

    // Цикл жив: как только зависший запрос отвалится по таймауту,
    // следующий успешный ответ возвращает «Онлайн»
    backend.holdStatus = false
    await advance(STATUS_REQUEST_TIMEOUT_MS + POLL_MS * 2)
    expect(badgeText()).toContain("Онлайн")
  })

  it("сетевой сбой не убивает цикл опроса — связь восстанавливается сама", async () => {
    backend.status = idleStatus()
    await mountPanel()

    const original = global.fetch as typeof fetch
    let failing = true
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (failing && url.endsWith("/api/viber/status")) {
        return Promise.reject(new TypeError("Failed to fetch"))
      }
      return original(input as RequestInfo, init)
    })

    await advance(POLL_MS * 3)
    expect(badgeText()).toContain("Нет связи")

    failing = false
    await advance(POLL_MS * 2)
    expect(badgeText()).toContain("Онлайн")
  })
})

describe("дотягивание финальных деталей", () => {
  it("цикл повторных попыток переживает перезапуск SSE-эффекта (D1)", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    await mountPanel()

    // Фоновый опрос уводим в подвес: единственным источником запросов деталей
    // остаётся дотягивание финального состояния.
    backend.holdStatus = true
    await advance(POLL_MS)
    expect(backend.pendingStatus.length).toBe(1)

    // Детали временно отдают ошибку — дотягивание обязано повторять попытки
    backend.detailHttpError = 500
    const baseline = backend.calls.detail

    const source = FakeEventSource.last
    await emitEvent(source, {
      taskId: "task_a",
      status: "ready",
      timestamp: new Date().toISOString(),
    })

    // Терминальный статус демонтирует SSE-эффект — цикл не должен умереть вместе с ним
    await advance(20_000)

    expect(backend.calls.detail - baseline).toBeGreaterThanOrEqual(3)
  })

  it("дотягивание прекращается при размонтировании панели", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    const view = render(<ViberParserPanel />)
    await settle()
    await advance(0)

    backend.holdStatus = true
    await advance(POLL_MS)
    backend.detailHttpError = 500

    const source = FakeEventSource.last
    await emitEvent(source, {
      taskId: "task_a",
      status: "ready",
      timestamp: new Date().toISOString(),
    })

    view.unmount()
    const afterUnmount = backend.calls.detail
    await advance(20_000)

    expect(backend.calls.detail).toBe(afterUnmount)
  })
})

describe("устойчивость потока событий", () => {
  it("долгий шаг без событий не съедает попытки переподключения", async () => {
    backend.status = runningStatus("task_a", "waiting_numbers_sync")
    backend.detail = taskDetail("task_a", "running", { steps: 7 })
    await mountPanel()
    expect(FakeEventSource.openCount).toBe(1)

    // Десять обрывов по idle-таймауту у соединений, которые жили долго
    for (let i = 0; i < 10; i += 1) {
      const source = FakeEventSource.last
      await advance(45_000)
      await advanceWith(() => source.fail())
      await advance(5_000)
    }

    // Поток продолжает подниматься: лимит попыток сбрасывается «здоровым» соединением
    expect(FakeEventSource.openCount).toBeGreaterThan(9)
  })
})

describe("исчезнувшая задача", () => {
  it("после 404 панель прекращает опрос и не устраивает шторм переподключений", async () => {
    backend.status = runningStatus("task_a")
    backend.detail = taskDetail("task_a", "running")
    await mountPanel()
    expect(FakeEventSource.openCount).toBe(1)

    // Рестарт API: реестр задач в памяти обнулился
    backend.status = idleStatus()
    backend.detail = null
    backend.detailHttpError = 404
    const source = FakeEventSource.last
    await advanceWith(() => source.fail())
    await advance(POLL_MS * 6)

    expect(FakeEventSource.openCount).toBeLessThanOrEqual(2)
    expect(screen.queryByText("task_a")).toBeNull()
    expect(screen.getByText("Сервис свободен")).toBeTruthy()

    const detailCalls = backend.calls.detail
    await advance(POLL_MS * 4)
    expect(backend.calls.detail).toBe(detailCalls)
  })
})

/**
 * Страница инстанса работает только с группами, которые открыты на этом
 * эмуляторе: собрать участников или включить мониторинг для архивной записи
 * из Supabase нельзя. Общая страница без инстанса по-прежнему показывает архив.
 */
describe("список групп инстанса", () => {
  function groupsRequests() {
    return fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => /^\/api\/viber\/groups(\?|$)/.test(url))
  }

  it("на странице инстанса просит только группы этого устройства", async () => {
    render(<ViberParserPanel deviceId="worker" />)
    await settle()
    await advance(0)

    const [first] = groupsRequests()
    expect(first).toContain("onDevice=true")
    expect(first).toContain("deviceId=worker")
  })

  it("ручная выгрузка группы отправляется на выбранный инстанс", async () => {
    render(<ViberParserPanel deviceId="worker-03" />)
    await settle()
    await advance(0)

    fireEvent.click(screen.getByRole("button", { name: "Выгрузить в БД" }))
    await advance(0)

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/viber/users/sync/group/42?deviceId=worker-03",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("без инстанса список остаётся полным, вместе с архивом", async () => {
    await mountPanel()

    const [first] = groupsRequests()
    expect(first).toBeTruthy()
    expect(first).not.toContain("onDevice")
  })

  it("скрывает backend-диагностику недоступного инстанса в тексте и уведомлении", async () => {
    backend.groupsHttpError = 503
    backend.groupsErrorMessage = "adb -s host.docker.internal:5556 shell cp -f /data/data/com.viber.voip/databases/viber_messages exited with code 1: error: device offline"
    render(<ViberParserPanel deviceId="worker" />)
    await settle()
    await advance(0)

    expect(
      screen.getByText("Инстанс недоступен. Проверьте, что он запущен, и повторите попытку.")
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/adb|host\.docker\.internal|\/data\/data|exited with code|device offline/i)
    expect(toastMock.error).toHaveBeenCalledWith("Не удалось загрузить группы", {
      description: "Инстанс недоступен. Проверьте, что он запущен, и повторите попытку.",
    })
  })
})

/**
 * Список групп на странице инстанса отфильтрован по устройству, поэтому его
 * длина больше не отвечает на вопрос «сколько всего чатов в базе».
 */
describe("счётчик чатов на вкладке базы", () => {
  async function openDatabaseTab() {
    await reactAct(async () => {
      const tab = screen.getByRole("tab", { name: /Данные/ })
      // Radix переключает вкладку по нажатию, а не по клику.
      fireEvent.mouseDown(tab)
      fireEvent.click(tab)
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("без статистики показывает прочерк, а не длину списка групп", async () => {
    backend.dbStatsHttpError = 503
    render(<ViberParserPanel deviceId="worker" />)
    await settle()
    await advance(0)
    await openDatabaseTab()

    const card = screen.getByText("Чаты и диалоги").parentElement
    expect(card?.textContent).toContain("—")
    expect(card?.textContent).not.toContain("1")
  })
})
