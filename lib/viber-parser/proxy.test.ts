import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildStatusPayload,
  composeAbortSignals,
  createSseHeartbeatStream,
  deriveParserState,
  matchProxyRoute,
  pickActiveTask,
  sanitizeCollectBody,
  sanitizeDecodeBody,
  stepNameOf,
} from "@/lib/viber-parser/proxy"
import type { TaskDetailDto, TaskSummaryDto } from "@/lib/viber-parser/types"

function summary(overrides: Partial<TaskSummaryDto> & { id: string }): TaskSummaryDto {
  return {
    groupTarget: "26",
    status: "ready",
    createdAt: "2026-09-09T10:00:00.000Z",
    ...overrides,
  }
}

describe("sanitizeCollectBody", () => {
  it("оставляет только поля, которые есть в CollectParticipantsDto бэкенда", () => {
    const result = sanitizeCollectBody({
      group: "  АVTOTRAL  ",
      allowPartial: true,
      restartApp: false,
      idleTimeoutMs: 15000,
      numbersSyncTimeoutMs: 45000,
      syncLiveDbAfter: true,
      fetchOnlineStatus: false,
      // поля, которых нет в DTO — бэкенд ответил бы 400
      pageLimit: 50,
      scrollPages: 3,
      forceRefresh: true,
      limit: 10,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      group: "АVTOTRAL",
      allowPartial: true,
      restartApp: false,
      idleTimeoutMs: 15000,
      numbersSyncTimeoutMs: 45000,
      syncLiveDbAfter: true,
      fetchOnlineStatus: false,
    })
  })

  it("не добавляет ключи со значением undefined", () => {
    const result = sanitizeCollectBody({ group: "26" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value)).toEqual(["group"])
  })

  it("игнорирует поля неверного типа", () => {
    const result = sanitizeCollectBody({
      group: "26",
      allowPartial: "yes",
      idleTimeoutMs: "15000",
      numbersSyncTimeoutMs: Number.NaN,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value)).toEqual(["group"])
  })

  it("принимает legacy-поле groupName", () => {
    const result = sanitizeCollectBody({ groupName: "Тестовая" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.group).toBe("Тестовая")
  })

  it("возвращает ошибку, если группа не указана", () => {
    expect(sanitizeCollectBody({ group: "   " }).ok).toBe(false)
    expect(sanitizeCollectBody(null).ok).toBe(false)
    expect(sanitizeCollectBody({}).ok).toBe(false)
  })
})

describe("sanitizeDecodeBody", () => {
  it("отбрасывает includeSelf и прочие поля вне DecodeRequestDto", () => {
    const body = sanitizeDecodeBody({
      dryRun: true,
      includeSelf: false,
      limit: 25,
      restartApp: false,
      waitForSyncSeconds: 20,
      backupPath: "/tmp/x",
    })

    expect(body).toEqual({
      dryRun: true,
      limit: 25,
      restartApp: false,
      waitForSyncSeconds: 20,
    })
  })

  it("подставляет значения по умолчанию и не шлёт limit: undefined", () => {
    const body = sanitizeDecodeBody({})
    expect(body).toEqual({ dryRun: false, restartApp: true, waitForSyncSeconds: 10 })
    expect("limit" in body).toBe(false)
  })
})

describe("pickActiveTask", () => {
  it("возвращает активную задачу, даже если она не первая в списке", () => {
    const tasks = [
      summary({ id: "t3", status: "ready", createdAt: "2026-09-09T12:00:00.000Z" }),
      summary({ id: "t2", status: "running", createdAt: "2026-09-09T11:00:00.000Z" }),
      summary({ id: "t1", status: "error", createdAt: "2026-09-09T10:00:00.000Z" }),
    ]
    expect(pickActiveTask(tasks)?.id).toBe("t2")
  })

  it("берёт самую свежую активную задачу", () => {
    const tasks = [
      summary({ id: "old", status: "running", createdAt: "2026-09-09T10:00:00.000Z" }),
      summary({ id: "new", status: "initializing", createdAt: "2026-09-09T12:00:00.000Z" }),
    ]
    expect(pickActiveTask(tasks)?.id).toBe("new")
  })

  it("без активных задач возвращает последнюю по createdAt", () => {
    const tasks = [
      summary({ id: "a", status: "ready", createdAt: "2026-09-09T10:00:00.000Z" }),
      summary({ id: "b", status: "error", createdAt: "2026-09-09T12:00:00.000Z" }),
    ]
    expect(pickActiveTask(tasks)?.id).toBe("b")
  })

  it("возвращает null для пустого списка", () => {
    expect(pickActiveTask([])).toBeNull()
  })
})

describe("deriveParserState", () => {
  it.each([
    ["running", "RUNNING"],
    ["initializing", "INITIALIZING"],
    ["starting", "INITIALIZING"],
    ["error", "ERROR"],
    ["ready", "IDLE"],
    ["stopped", "IDLE"],
  ] as const)("статус %s -> %s", (status, expected) => {
    expect(deriveParserState(summary({ id: "t", status }))).toBe(expected)
  })

  it("без задачи парсер свободен", () => {
    expect(deriveParserState(null)).toBe("IDLE")
  })
})

describe("stepNameOf", () => {
  it("достаёт имя шага из объекта", () => {
    expect(stepNameOf({ step: "paging_participants", startedAt: "x" })).toBe("paging_participants")
  })

  it("возвращает null для пустых значений", () => {
    expect(stepNameOf(null)).toBeNull()
    expect(stepNameOf(undefined)).toBeNull()
  })
})

describe("buildStatusPayload", () => {
  const detail: TaskDetailDto = {
    id: "t2",
    groupTarget: "26",
    groupName: "АVTOTRAL",
    status: "running",
    createdAt: "2026-09-09T11:00:00.000Z",
    startedAt: "2026-09-09T11:00:05.000Z",
    currentStep: {
      step: "paging_participants",
      description: "Сбор страниц",
      startedAt: "2026-09-09T11:00:10.000Z",
      progress: { pagesCount: 3 },
    },
    progress: { pagesCount: 3, headerTotal: 900, currentOffset: 150 },
    stepHistory: [],
  }

  it("собирает консолидированный статус активной задачи", () => {
    const payload = buildStatusPayload({
      tasks: [summary({ id: "t3", status: "ready" }), { ...detail }],
      detail,
      fetchedAt: "2026-09-09T11:00:11.000Z",
    })

    expect(payload.state).toBe("RUNNING")
    expect(payload.isDriverActive).toBe(true)
    expect(payload.taskId).toBe("t2")
    expect(payload.task).toEqual(detail)
    expect(payload.currentStep).toBe("paging_participants")
    expect(payload.progress).toEqual(detail.progress)
    expect(payload.groupName).toBe("АVTOTRAL")
    expect(payload.fetchedAt).toBe("2026-09-09T11:00:11.000Z")
  })

  it("отдаёт task: null, если detail не получен", () => {
    const payload = buildStatusPayload({
      tasks: [summary({ id: "t1", status: "running" })],
      detail: null,
      fetchedAt: "2026-09-09T11:00:11.000Z",
    })
    expect(payload.task).toBeNull()
    expect(payload.taskId).toBe("t1")
    expect(payload.state).toBe("RUNNING")
  })

  it("игнорирует detail от другой задачи", () => {
    const payload = buildStatusPayload({
      tasks: [summary({ id: "other", status: "running" })],
      detail,
      fetchedAt: "2026-09-09T11:00:11.000Z",
    })
    expect(payload.task).toBeNull()
  })

  it("ограничивает историю 50 последними задачами и сортирует по createdAt", () => {
    const tasks = Array.from({ length: 60 }, (_, index) =>
      summary({
        id: `t${index}`,
        status: "ready",
        createdAt: new Date(Date.UTC(2026, 8, 9, 0, index)).toISOString(),
      })
    )
    const payload = buildStatusPayload({
      tasks,
      detail: null,
      fetchedAt: "2026-09-09T11:00:11.000Z",
    })
    expect(payload.tasks).toHaveLength(50)
    expect(payload.tasks[0]?.id).toBe("t59")
  })

  it("для пустого списка задач возвращает IDLE без задачи", () => {
    const payload = buildStatusPayload({
      tasks: [],
      detail: null,
      fetchedAt: "2026-09-09T11:00:11.000Z",
    })
    expect(payload.state).toBe("IDLE")
    expect(payload.taskId).toBeNull()
    expect(payload.task).toBeNull()
    expect(payload.tasks).toEqual([])
    expect(payload.isDriverActive).toBe(true)
  })
})

describe("matchProxyRoute", () => {
  it("распознаёт GET-маршруты", () => {
    expect(matchProxyRoute("GET", ["status"])?.kind).toBe("status")
    expect(matchProxyRoute("GET", ["groups"])?.kind).toBe("groups")
    expect(matchProxyRoute("GET", ["groups", "26"])?.kind).toBe("group-detail")
    expect(matchProxyRoute("GET", ["groups", "26", "members"])?.kind).toBe("group-members")
    expect(matchProxyRoute("GET", ["groups", "26", "participants"])?.kind).toBe("group-members")
    expect(matchProxyRoute("GET", ["database", "stats"])?.kind).toBe("database-stats")
    expect(matchProxyRoute("GET", ["tasks"])?.kind).toBe("tasks")
    expect(matchProxyRoute("GET", ["tasks", "t1"])?.kind).toBe("task-detail")
    expect(matchProxyRoute("GET", ["tasks", "t1", "events"])?.kind).toBe("task-events")
    expect(matchProxyRoute("GET", ["tasks", "t1", "participants"])?.kind).toBe("task-participants")
    expect(matchProxyRoute("GET", ["messages", "events"])?.kind).toBe("messages-events")
    expect(matchProxyRoute("GET", ["messages", "monitor", "events"])?.kind).toBe("messages-events")
    expect(matchProxyRoute("GET", ["messages", "monitored"])?.kind).toBe("messages-monitored")
    expect(matchProxyRoute("GET", ["messages", "monitored", "export"])?.kind).toBe("messages-monitored-export")
    expect(matchProxyRoute("GET", ["messages", "monitor", "status"])?.kind).toBe("monitor-status")
    expect(matchProxyRoute("GET", ["messages", "monitor", "groups"])?.kind).toBe("monitor-groups")
    expect(matchProxyRoute("GET", ["broadcast", "campaigns"])?.kind).toBe("broadcast")
  })

  it("передаёт параметры маршрута", () => {
    expect(matchProxyRoute("GET", ["tasks", "task_42", "events"])?.params).toEqual({ id: "task_42" })
    expect(matchProxyRoute("GET", ["groups", "26", "members"])?.params).toEqual({ id: "26" })
  })

  it("распознаёт POST-маршруты", () => {
    expect(matchProxyRoute("POST", ["participants", "collect"])?.kind).toBe("collect")
    expect(matchProxyRoute("POST", ["database", "decode"])?.kind).toBe("decode")
    expect(matchProxyRoute("POST", ["database", "sync"])?.kind).toBe("database-sync")
    expect(matchProxyRoute("POST", ["stop"])?.kind).toBe("stop")
    expect(matchProxyRoute("POST", ["tasks", "t1", "stop"])?.kind).toBe("task-stop")
    expect(matchProxyRoute("POST", ["messages", "monitor", "start"])?.kind).toBe("monitor-start")
    expect(matchProxyRoute("POST", ["messages", "monitor", "stop"])?.kind).toBe("monitor-stop")
    expect(matchProxyRoute("POST", ["messages", "monitor", "groups", "26", "enable"])?.kind).toBe(
      "monitor-group-toggle"
    )
    expect(matchProxyRoute("POST", ["messages", "monitor", "groups", "26", "disable"])?.kind).toBe(
      "monitor-group-toggle"
    )
    expect(matchProxyRoute("POST", ["participants", "online-status"])?.kind).toBe("online-status")
    expect(matchProxyRoute("POST", ["broadcast", "campaigns"])?.kind).toBe("broadcast")
    expect(matchProxyRoute("POST", ["broadcast", "campaigns", "c1", "start"])?.kind).toBe("broadcast")
  })

  it("PATCH и DELETE разрешены только для кампаний рассылки", () => {
    expect(matchProxyRoute("PATCH", ["broadcast", "campaigns", "c1"])?.kind).toBe("broadcast")
    expect(matchProxyRoute("DELETE", ["broadcast", "campaigns", "c1"])?.kind).toBe("broadcast")
    expect(matchProxyRoute("PATCH", ["broadcast", "campaigns"])).toBeNull()
    expect(matchProxyRoute("DELETE", ["tasks", "t1"])).toBeNull()
  })

  it("не проксирует произвольные пути", () => {
    expect(matchProxyRoute("GET", ["auth", "credentials"])).toBeNull()
    expect(matchProxyRoute("GET", ["viber", "restart"])).toBeNull()
    expect(matchProxyRoute("POST", ["viber", "restart"])).toBeNull()
    expect(matchProxyRoute("POST", ["database", "wipe"])).toBeNull()
    expect(matchProxyRoute("GET", [])).toBeNull()
    expect(matchProxyRoute("GET", ["..", "etc"])).toBeNull()
  })
})

describe("createSseHeartbeatStream", () => {
  beforeEach(() => {
    // queueMicrotask не подменяем — на нём работает внутренняя очередь WHATWG-стримов
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("пробрасывает данные и добавляет ping каждые 15 секунд", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const heartbeat = createSseHeartbeatStream(15_000)

    const writer = heartbeat.writable.getWriter()
    const reader = heartbeat.readable.getReader()

    // readable у TransformStream имеет highWaterMark 0: write резолвится только после чтения
    const written = writer.write(encoder.encode("data: {}\n\n"))
    const first = await reader.read()
    expect(decoder.decode(first.value)).toBe("data: {}\n\n")
    await written

    await vi.advanceTimersByTimeAsync(15_000)
    const ping = await reader.read()
    expect(decoder.decode(ping.value)).toBe(": ping\n\n")

    await writer.close()
    const end = await reader.read()
    expect(end.done).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("снимает таймер при отмене чтения", async () => {
    const heartbeat = createSseHeartbeatStream(15_000)
    const reader = heartbeat.readable.getReader()
    await reader.cancel()
    await heartbeat.writable.abort().catch(() => undefined)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe("createSseHeartbeatStream / границы кадров", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("не вставляет ping внутрь кадра, разрезанного между чанками", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const heartbeat = createSseHeartbeatStream(15_000)

    const writer = heartbeat.writable.getWriter()
    const reader = heartbeat.readable.getReader()

    const head = 'data: {"taskId":"task_1","stat'
    const tail = 'us":"running"}\n\n'

    const firstWrite = writer.write(encoder.encode(head))
    expect(decoder.decode((await reader.read()).value)).toBe(head)
    await firstWrite

    // Тик таймера пришёлся на середину кадра — ping обязан подождать.
    await vi.advanceTimersByTimeAsync(15_000)

    const secondWrite = writer.write(encoder.encode(tail))
    expect(decoder.decode((await reader.read()).value)).toBe(tail)
    await secondWrite

    expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n")
    expect(JSON.parse(`${head}${tail}`.replace(/^data: /, "").trim())).toEqual({
      taskId: "task_1",
      status: "running",
    })

    await writer.close()
    expect((await reader.read()).done).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("шлёт ровно один отложенный ping, сколько бы тиков ни прошло внутри кадра", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const heartbeat = createSseHeartbeatStream(15_000)

    const writer = heartbeat.writable.getWriter()
    const reader = heartbeat.readable.getReader()

    const firstWrite = writer.write(encoder.encode("data: {"))
    await reader.read()
    await firstWrite

    await vi.advanceTimersByTimeAsync(45_000)

    const secondWrite = writer.write(encoder.encode("}\n\n"))
    expect(decoder.decode((await reader.read()).value)).toBe("}\n\n")
    await secondWrite

    expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n")

    const thirdWrite = writer.write(encoder.encode("data: 2\n\n"))
    expect(decoder.decode((await reader.read()).value)).toBe("data: 2\n\n")
    await thirdWrite

    await writer.close()
    expect((await reader.read()).done).toBe(true)
  })

  it("узнаёт границу кадра, разрезанную между чанками", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const heartbeat = createSseHeartbeatStream(15_000)

    const writer = heartbeat.writable.getWriter()
    const reader = heartbeat.readable.getReader()

    const firstWrite = writer.write(encoder.encode("data: 1\r\n"))
    await reader.read()
    await firstWrite

    await vi.advanceTimersByTimeAsync(15_000)

    const secondWrite = writer.write(encoder.encode("\r\n"))
    expect(decoder.decode((await reader.read()).value)).toBe("\r\n")
    await secondWrite

    expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n")

    await writer.close()
    expect((await reader.read()).done).toBe(true)
  })
})

describe("composeAbortSignals", () => {
  it("прерывается по любому из переданных сигналов", () => {
    const first = new AbortController()
    const second = new AbortController()
    const signal = composeAbortSignals([first.signal, second.signal])

    expect(signal.aborted).toBe(false)
    second.abort(new Error("клиент ушёл"))
    expect(signal.aborted).toBe(true)
  })

  it("возвращает уже прерванный сигнал как есть", () => {
    const aborted = new AbortController()
    aborted.abort()
    const alive = new AbortController()

    expect(composeAbortSignals([alive.signal, aborted.signal]).aborted).toBe(true)
    expect(composeAbortSignals([alive.signal]).aborted).toBe(false)
  })

  it("работает без AbortSignal.any (Node < 20.3)", () => {
    const holder = AbortSignal as unknown as { any?: unknown }
    const original = holder.any
    holder.any = undefined
    try {
      const first = new AbortController()
      const second = new AbortController()
      const signal = composeAbortSignals([first.signal, second.signal])

      expect(signal.aborted).toBe(false)
      first.abort()
      expect(signal.aborted).toBe(true)
    } finally {
      holder.any = original
    }
  })
})
