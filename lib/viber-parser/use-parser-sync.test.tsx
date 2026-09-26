import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useViberParserSync } from "@/lib/viber-parser/use-parser-sync"
import type { TaskDetailDto, TaskSummaryDto, ViberParserStatus } from "@/lib/viber-parser/types"

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  closed = false
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

function detail(overrides: Partial<TaskDetailDto> = {}): TaskDetailDto {
  return {
    id: "task_1",
    groupTarget: "АVTOTRAL",
    groupName: "АVTOTRAL",
    status: "running",
    createdAt: "2026-09-09T09:59:00.000Z",
    currentStep: {
      step: "paging_participants",
      description: "Сбор страниц",
      startedAt: "2026-09-09T09:59:30.000Z",
    },
    progress: { pagesCount: 2 },
    stepHistory: [],
    ...overrides,
  }
}

function status(overrides: Partial<ViberParserStatus> = {}): ViberParserStatus {
  const task = overrides.task === undefined ? detail() : overrides.task
  return {
    state: "RUNNING",
    isDriverActive: true,
    taskId: task?.id ?? null,
    task,
    tasks: task ? [task as TaskSummaryDto] : [],
    currentStep: task?.currentStep?.step ?? null,
    progress: task?.progress ?? null,
    groupName: task?.groupName ?? null,
    fetchedAt: "2026-09-09T10:00:00.000Z",
    ...overrides,
  }
}

function jsonResponse(payload: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("EventSource", MockEventSource)
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function setHidden(value: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("useViberParserSync", () => {
  it("делает первый опрос и отдаёт задачу", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync())
    await flush()

    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.connection).toBe("online")
    expect(result.current.isTaskRunning).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("/api/viber/status", expect.anything())
  })

  it("при ошибке опроса не теряет задачу и показывает переподключение", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse(status())))
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ error: "Бэкенд Viber недоступен" }, { status: 503 }))
    )

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(result.current.task?.id).toBe("task_1")

    await flush(2100)
    expect(result.current.connection).toBe("reconnecting")
    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.isTaskRunning).toBe(true)
    expect(result.current.status?.state).toBe("RUNNING")

    await flush(2100)
    await flush(2100)
    expect(result.current.connection).toBe("offline")
    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.isTaskRunning).toBe(true)
  })

  it("опрашивает активную задачу каждые 2 секунды", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    renderHook(() => useViberParserSync())
    await flush()
    const afterFirst = fetchMock.mock.calls.length

    await flush(2100)
    expect(fetchMock.mock.calls.length).toBe(afterFirst + 1)

    await flush(2100)
    expect(fetchMock.mock.calls.length).toBe(afterFirst + 2)
  })

  it("в покое опрашивает раз в 5 секунд", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(status({ state: "IDLE", task: detail({ status: "ready" }) })))
    )

    renderHook(() => useViberParserSync())
    await flush()
    const afterFirst = fetchMock.mock.calls.length

    await flush(2100)
    expect(fetchMock.mock.calls.length).toBe(afterFirst)

    await flush(3000)
    expect(fetchMock.mock.calls.length).toBe(afterFirst + 1)
  })

  it("применяет события SSE и не закрывает поток при ошибке", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(MockEventSource.instances).toHaveLength(1)

    const source = MockEventSource.instances[0]!
    expect(source.url).toBe("/api/viber/tasks/task_1/events")

    await act(async () => {
      source.emit({
        taskId: "task_1",
        status: "running",
        step: {
          step: "waiting_numbers_sync",
          description: "Ожидание синка",
          startedAt: "2026-09-09T10:00:05.000Z",
        },
        progress: { syncedPhoneNumbers: 42 },
        timestamp: "2026-09-09T10:00:05.000Z",
      })
    })

    expect(result.current.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(result.current.task?.progress?.syncedPhoneNumbers).toBe(42)

    await act(async () => {
      source.onerror?.({})
    })
    expect(source.closed).toBe(false)
  })

  it("сообщает о завершении задачи ровно один раз", async () => {
    const onTerminal = vi.fn()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync({ onTerminal }))
    await flush()
    expect(MockEventSource.instances).toHaveLength(1)
    const source = MockEventSource.instances[0]!

    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(status({ state: "IDLE", task: detail({ status: "ready" }) })))
    )

    await act(async () => {
      source.emit({ taskId: "task_1", status: "ready", timestamp: "2026-09-09T10:00:09.000Z" })
    })

    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(onTerminal.mock.calls[0]?.[0]?.status).toBe("ready")

    await flush(6000)
    await flush(6000)
    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(result.current.isTaskRunning).toBe(false)
    expect(source.closed).toBe(true)
  })

  it("на терминале по SSE не выдумывает итоги, а добирает их немедленным опросом", async () => {
    const onTerminal = vi.fn()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync({ onTerminal }))
    await flush()
    const source = MockEventSource.instances[0]!

    const collected = {
      group: "АVTOTRAL",
      conversationId: 26,
      pagesCount: 5,
      participantsCount: 900,
      participantsWithPhone: 640,
      savedJsonPath: "a.json",
      savedTxtPath: "a.txt",
    }
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          status({ state: "IDLE", task: detail({ status: "ready", result: collected }) })
        )
      )
    )

    await act(async () => {
      source.emit({ taskId: "task_1", status: "ready", timestamp: "2026-09-09T10:00:09.000Z" })
    })

    // Событие задачи result не несёт — уведомление обязано остаться без чисел.
    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(onTerminal.mock.calls[0]?.[0]?.result).toBeNull()

    // Опрос после терминала добирает detail: карточка показывает настоящие итоги.
    await flush()
    expect(result.current.task?.status).toBe("ready")
    expect(result.current.task?.result?.participantsCount).toBe(900)
    expect(result.current.task?.result?.participantsWithPhone).toBe(640)
    expect(onTerminal).toHaveBeenCalledTimes(1)
  })

  it("startCollect оптимистично показывает задачу", async () => {
    let started = false
    fetchMock.mockImplementation((input: string) => {
      if (String(input).includes("participants/collect")) {
        started = true
        return Promise.resolve(jsonResponse({ taskId: "task_new", message: "ok", group: "Тест" }))
      }
      if (!started) {
        return Promise.resolve(
          jsonResponse(status({ state: "IDLE", task: null, taskId: null, tasks: [] }))
        )
      }
      // Бэкенд создаёт задачу синхронно, поэтому следующий опрос её уже видит.
      return Promise.resolve(
        jsonResponse(
          status({
            state: "INITIALIZING",
            task: detail({ id: "task_new", status: "initializing", groupTarget: "Тест", groupName: "Тест" }),
          })
        )
      )
    })

    const { result } = renderHook(() => useViberParserSync())
    await flush()

    await act(async () => {
      await result.current.startCollect({ group: "Тест", restartApp: true, allowPartial: true })
    })

    expect(result.current.task?.id).toBe("task_new")
    expect(result.current.task?.status).toBe("initializing")
    expect(result.current.isTaskRunning).toBe(true)
  })

  it("dismissTask прячет карточку завершённой задачи", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(status({ state: "IDLE", task: detail({ status: "ready" }) })))
    )

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(result.current.task?.id).toBe("task_1")

    act(() => {
      result.current.dismissTask()
    })
    expect(result.current.task).toBeNull()

    await flush(6000)
    expect(result.current.task).toBeNull()
  })
})


describe("useViberParserSync / гонки поллинга и SSE", () => {
  it("ответ поллинга, стартовавший раньше SSE-события, не откатывает шаг", async () => {
    const slow = deferred<Response>()
    let pollCalls = 0
    fetchMock.mockImplementation(() => {
      pollCalls += 1
      if (pollCalls === 1) return Promise.resolve(jsonResponse(status()))
      if (pollCalls === 2) return slow.promise
      return Promise.resolve(jsonResponse(status()))
    })

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(result.current.task?.currentStep?.step).toBe("paging_participants")

    // Второй опрос стартовал, ответа ещё нет.
    await flush(2100)
    expect(pollCalls).toBe(2)

    const source = MockEventSource.instances[0]!
    await act(async () => {
      source.emit({
        taskId: "task_1",
        status: "running",
        step: {
          step: "waiting_numbers_sync",
          description: "Ожидание синка",
          startedAt: "2026-09-09T10:00:05.000Z",
        },
        progress: { syncedPhoneNumbers: 42 },
        timestamp: "2026-09-09T10:00:05.000Z",
      })
    })
    expect(result.current.task?.currentStep?.step).toBe("waiting_numbers_sync")

    // Ответ старого опроса приезжает после события — применять его нельзя.
    await act(async () => {
      slow.resolve(jsonResponse(status()))
      await slow.promise
    })
    await flush()

    expect(result.current.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(result.current.task?.progress?.syncedPhoneNumbers).toBe(42)
  })

  it("при смене задачи закрывает старый поток и открывает новый", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    renderHook(() => useViberParserSync())
    await flush()
    expect(MockEventSource.instances).toHaveLength(1)
    const first = MockEventSource.instances[0]!
    expect(first.url).toBe("/api/viber/tasks/task_1/events")

    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(status({ task: detail({ id: "task_2" }) })))
    )
    await flush(2100)

    expect(first.closed).toBe(true)
    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[1]!.url).toBe("/api/viber/tasks/task_2/events")
    expect(MockEventSource.instances[1]!.closed).toBe(false)
  })

  it("после обрыва потока добирает состояние ровно одним опросом", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    renderHook(() => useViberParserSync())
    await flush()
    const source = MockEventSource.instances[0]!
    const before = fetchMock.mock.calls.length

    await act(async () => {
      source.onerror?.({})
    })
    expect(fetchMock.mock.calls.length).toBe(before)

    await act(async () => {
      source.onopen?.({})
    })
    expect(fetchMock.mock.calls.length).toBe(before + 1)

    // Повторное открытие без нового обрыва добор не повторяет.
    await act(async () => {
      source.onopen?.({})
    })
    expect(fetchMock.mock.calls.length).toBe(before + 1)
  })

  it("ловит завершение по SSE, когда detail задачи не пришёл", async () => {
    const onTerminal = vi.fn()
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          status({ task: null, taskId: "task_1", tasks: [detail() as TaskSummaryDto] })
        )
      )
    )

    const { result } = renderHook(() => useViberParserSync({ onTerminal }))
    await flush()
    expect(result.current.task).toBeNull()
    expect(result.current.isTaskRunning).toBe(true)
    expect(MockEventSource.instances).toHaveLength(1)

    const source = MockEventSource.instances[0]!
    await act(async () => {
      source.emit({ taskId: "task_1", status: "ready", timestamp: "2026-09-09T10:00:09.000Z" })
    })

    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(onTerminal.mock.calls[0]?.[0]?.status).toBe("ready")
    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.isTaskRunning).toBe(false)
  })
})

describe("useViberParserSync / рестарт бэкенда", () => {
  it("предупреждает о потере задачи ровно один раз и оставляет карточку", async () => {
    const onTaskLost = vi.fn()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync({ onTaskLost }))
    await flush()
    expect(result.current.task?.id).toBe("task_1")

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(status({ state: "IDLE", task: null, taskId: null, tasks: [] }))
      )
    )
    await flush(2100)

    expect(onTaskLost).toHaveBeenCalledTimes(1)
    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.isTaskLost).toBe(true)
    expect(result.current.isTaskRunning).toBe(false)

    await flush(6000)
    await flush(6000)
    expect(onTaskLost).toHaveBeenCalledTimes(1)
    expect(result.current.task?.id).toBe("task_1")
    expect(result.current.isTaskLost).toBe(true)
  })

  it("вернувшаяся задача снова считается выполняющейся и открывает поток событий", async () => {
    const onTaskLost = vi.fn()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    const { result } = renderHook(() => useViberParserSync({ onTaskLost }))
    await flush()
    expect(MockEventSource.instances).toHaveLength(1)

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(status({ state: "IDLE", task: null, taskId: null, tasks: [] }))
      )
    )
    await flush(2100)
    expect(result.current.isTaskLost).toBe(true)
    expect(MockEventSource.instances[0]!.closed).toBe(true)

    // Задача снова в ответе: карточка обязана ожить, а поток событий — открыться заново.
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))
    await flush(6000)

    expect(result.current.isTaskLost).toBe(false)
    expect(result.current.isTaskRunning).toBe(true)
    expect(result.current.task?.id).toBe("task_1")
    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[1]!.closed).toBe(false)
    expect(onTaskLost).toHaveBeenCalledTimes(1)
  })
})

describe("useViberParserSync / гонка оптимистичного старта", () => {
  it("пустой ответ сразу после старта не объявляет задачу потерянной", async () => {
    const onTaskLost = vi.fn()
    fetchMock.mockImplementation((input: string) => {
      if (String(input).includes("participants/collect")) {
        return Promise.resolve(jsonResponse({ taskId: "task_new", message: "ok" }))
      }
      // Бэкенд задачу ещё ни разу не показал: это гонка, а не рестарт процесса.
      return Promise.resolve(
        jsonResponse(status({ state: "IDLE", task: null, taskId: null, tasks: [] }))
      )
    })

    const { result } = renderHook(() => useViberParserSync({ onTaskLost }))
    await flush()

    await act(async () => {
      await result.current.startCollect({ group: "Тест" })
    })
    await flush()

    expect(onTaskLost).not.toHaveBeenCalled()
    expect(result.current.isTaskLost).toBe(false)
    expect(result.current.task?.id).toBe("task_new")
    expect(result.current.isTaskRunning).toBe(true)
  })
})

describe("useViberParserSync / видимость вкладки и связь", () => {
  it("на скрытой вкладке опрашивает раз в 30 секунд и сразу при возврате", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(status())))

    renderHook(() => useViberParserSync())
    await flush()
    const afterFirst = fetchMock.mock.calls.length

    await act(async () => {
      setHidden(true)
    })

    await flush(2100)
    expect(fetchMock.mock.calls.length).toBe(afterFirst)

    await flush(28_000)
    expect(fetchMock.mock.calls.length).toBe(afterFirst + 1)

    const beforeReturn = fetchMock.mock.calls.length
    await act(async () => {
      setHidden(false)
    })
    expect(fetchMock.mock.calls.length).toBe(beforeReturn + 1)

    setHidden(false)
  })

  it("уходит в офлайн по молчанию бэкенда, даже если состояние не менялось", async () => {
    let pollCalls = 0
    const hang = new Promise<Response>(() => {})
    fetchMock.mockImplementation(() => {
      pollCalls += 1
      if (pollCalls === 1) return Promise.resolve(jsonResponse(status()))
      if (pollCalls === 2) return Promise.reject(new Error("Бэкенд Viber недоступен"))
      return hang
    })

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(result.current.connection).toBe("online")

    await flush(2100)
    expect(result.current.connection).toBe("reconnecting")

    // Новых ответов нет вообще: состояние обязано протухнуть по таймеру, а не по рендеру.
    await flush(13_000)
    expect(result.current.connection).toBe("offline")
  })
})

describe("useViberParserSync / startCollect", () => {
  it("не сбрасывает задачу, которую поллинг уже показал", async () => {
    const hang = new Promise<Response>(() => {})
    let pollCalls = 0
    fetchMock.mockImplementation((input: string) => {
      if (String(input).includes("participants/collect")) {
        return Promise.resolve(jsonResponse({ taskId: "task_1", message: "ok" }))
      }
      pollCalls += 1
      if (pollCalls === 1) return Promise.resolve(jsonResponse(status()))
      return hang
    })

    const { result } = renderHook(() => useViberParserSync())
    await flush()
    expect(result.current.task?.status).toBe("running")

    await act(async () => {
      await result.current.startCollect({ group: "АVTOTRAL" })
    })

    expect(result.current.task?.status).toBe("running")
    expect(result.current.task?.currentStep?.step).toBe("paging_participants")
  })
})
