import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/viber/[...path]/route"

const ORIGIN = "http://127.0.0.1:8080"

function req(path: string) {
  return new NextRequest(`http://localhost:3000/api/viber/${path}`)
}

function ctx(path: string) {
  return { params: { path: path.split("/") } }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.VIBER_PARSER_URL = ORIGIN
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("GET /api/viber/status", () => {
  it("успешный ответ отдаёт состояние сервиса и статус последней задачи", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "task_a", status: "ready", groupTarget: "Группа", groupName: "Группа" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const res = await GET(req("status"), ctx("status"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      state: "IDLE",
      isDriverActive: true,
      taskId: "task_a",
      latestTaskStatus: "ready",
    })
  })

  it("таймаут апстрима — это 504, а не «сервис офлайн»", async () => {
    const timeout = new Error("timed out")
    timeout.name = "TimeoutError"
    fetchMock.mockRejectedValue(timeout)

    const res = await GET(req("status"), ctx("status"))
    const body = await res.json()

    expect(res.status).toBe(504)
    expect(body.error).toContain("не ответил вовремя")
    expect(body.isDriverActive).toBeUndefined()
  })

  it("недоступный апстрим — 502", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await GET(req("status"), ctx("status"))
    expect(res.status).toBe(502)
  })

  it("апстрим ответил ошибкой — это честное состояние сервиса, HTTP 200", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }))

    const res = await GET(req("status"), ctx("status"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isDriverActive).toBe(false)
    expect(body.error).toContain("503")
  })
})

describe("SSE-ветки прокси", () => {
  it("поток событий задачи не маскирует 404 апстрима под пустой поток", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "нет" }), { status: 404 }))

    const res = await GET(req("tasks/task_a/events"), ctx("tasks/task_a/events"))

    expect(res.status).toBe(404)
    expect(res.headers.get("content-type")).toContain("application/json")
  })

  it("живой поток событий задачи проксируется как есть", async () => {
    fetchMock.mockResolvedValue(
      new Response("data: {}\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    )

    const res = await GET(req("tasks/task_a/events"), ctx("tasks/task_a/events"))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
  })

  it("лента монитора остаётся переподключаемой: ошибка апстрима не переводит EventSource в CLOSED", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "нет" }), { status: 503 }))

    const res = await GET(
      req("messages/monitor/events"),
      ctx("messages/monitor/events")
    )

    // EventSource переподключается сам только если ответ 200 + text/event-stream;
    // на любой другой ответ он уходит в CLOSED и лента умирает навсегда.
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    const text = await res.text()
    expect(text).toContain("retry:")
  })

  it("лента монитора переподключаема и когда апстрима нет вовсе (D2)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await GET(req("messages/monitor/events"), ctx("messages/monitor/events"))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    expect(await res.text()).toContain("retry:")
  })

  it("поток событий открывается с таймаутом на установление соединения (D3)", async () => {
    let seenSignal: AbortSignal | undefined
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      seenSignal = init?.signal ?? undefined
      return new Response("data: {}\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    })

    await GET(req("tasks/task_a/events"), ctx("tasks/task_a/events"))
    expect(seenSignal).toBeInstanceOf(AbortSignal)
    // таймаут снимается после установления соединения — живой поток не обрывается
    expect(seenSignal?.aborted).toBe(false)
  })

  it("недоступный поток событий задачи не маскируется под пустой поток", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await GET(req("tasks/task_a/events"), ctx("tasks/task_a/events"))
    expect(res.status).toBe(502)
  })
})

describe("GET /api/viber/groups/:id/members", () => {
  function participantsResponse() {
    return new Response(
      JSON.stringify([
        {
          id: 1,
          memberId: "m1",
          number: "+375291112233",
          name: "Иван",
          contactName: null,
          viberName: null,
          groupRole: 0,
          roleLabel: "member",
          active: true,
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  it("не дублирует список участников полем rawParticipants", async () => {
    fetchMock.mockResolvedValue(participantsResponse())

    const res = await GET(req("groups/42/members"), ctx("groups/42/members"))
    const body = await res.json()

    expect(body.count).toBe(1)
    expect(body.members).toHaveLength(1)
    expect(Object.keys(body)).not.toContain("rawParticipants")
  })

  it("прокидывает refresh в апстрим и не добавляет его без запроса", async () => {
    fetchMock.mockResolvedValue(participantsResponse())

    await GET(req("groups/42/members"), ctx("groups/42/members"))
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("refresh")

    fetchMock.mockClear()
    await GET(req("groups/42/members?refresh=1"), ctx("groups/42/members"))
    expect(String(fetchMock.mock.calls[0][0])).toContain("refresh=1")
  })
})

describe("GET /api/viber/groups", () => {
  function groupsResponse() {
    return new Response(
      JSON.stringify([
        { id: 42, type: 5, groupId: "777", name: "Группа", messageCount: 10, participantCount: 120 },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  it("прокидывает refresh в апстрим и не добавляет его без запроса", async () => {
    fetchMock.mockResolvedValue(groupsResponse())

    await GET(req("groups"), ctx("groups"))
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("refresh")

    fetchMock.mockClear()
    await GET(req("groups?refresh=1"), ctx("groups"))
    expect(String(fetchMock.mock.calls[0][0])).toContain("refresh=1")
  })

  it("прокидывает onDevice в апстрим и не добавляет его без запроса", async () => {
    fetchMock.mockResolvedValue(groupsResponse())

    await GET(req("groups?deviceId=worker"), ctx("groups"))
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("onDevice")

    fetchMock.mockClear()
    await GET(req("groups?deviceId=worker&onDevice=true"), ctx("groups"))
    const upstream = String(fetchMock.mock.calls[0][0])
    expect(upstream).toContain("onDevice=true")
    expect(upstream).toContain("deviceId=worker")
  })

  it("не выдаёт row id за глобальный ключ группы", async () => {
    // У беседы без conversations.group_id ключа нет. Подставленный row id
    // уходил бы в мониторинг как groupKey, и тот не находил бы группу.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 7, type: 5, groupId: null, name: "Без ключа", messageCount: 3, participantCount: 4 },
          { id: 42, type: 5, groupId: "777", name: "Группа", messageCount: 10, participantCount: 120 },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const res = await GET(req("groups"), ctx("groups"))
    const body = await res.json()

    expect(body.groups[0]).toMatchObject({ conversationId: 7, groupId: null })
    expect(body.groups[1]).toMatchObject({ conversationId: 42, groupId: "777" })
  })
})

describe("GET /api/viber/database/stats", () => {
  it("прокидывает refresh в апстрим", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ conversationsCount: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    await GET(req("database/stats?refresh=1"), ctx("database/stats"))
    expect(String(fetchMock.mock.calls[0][0])).toContain("refresh=1")
  })
})
