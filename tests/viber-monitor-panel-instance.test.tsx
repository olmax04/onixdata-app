// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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

import { ViberMonitorPanel } from "@/components/dashboard/viber-monitor-panel"
import { FakeEventSource, installBrowserStubs } from "./support/panel-harness"

/**
 * Панель «Поток» открыта на конкретном инстансе, а список групп собирается из
 * устройства и Supabase — локальный conversationId в нём может принадлежать
 * чужому аккаунту. Поэтому включение обязано нести и инстанс, и глобальный
 * groupKey, иначе сервер ищет группу не на том эмуляторе.
 */

const MONITOR_STATUS = {
  isRunning: false,
  deviceId: "viber",
  groups: [],
  liveWatch: false,
  pollIntervalMs: 2500,
  lastProcessedMessageId: 0,
  processedMessagesCount: 0,
  phonesFromTextCount: 0,
  phonesFromViberCount: 0,
}

const GROUPS = {
  count: 1,
  groups: [
    {
      conversationId: 99,
      groupId: "gk-1",
      name: "АVTOTRAL",
      conversationType: 5,
      memberCount: 10,
    },
  ],
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

let calls: Array<{ url: string; method: string; body: string | null }>
/** HTTP-код вместо списка групп: 503 — инстанс недоступен. */
let groupsHttpError: number | null
let monitorStatus: Record<string, unknown>
/** Что отдаёт устройство: у части бесед conversations.group_id пуст. */
let groupsPayload: Record<string, unknown>

beforeEach(() => {
  groupsHttpError = null
  monitorStatus = MONITOR_STATUS
  groupsPayload = GROUPS
  installBrowserStubs()
  FakeEventSource.reset()
  vi.stubGlobal("EventSource", FakeEventSource)
  toastMock.success.mockClear()
  toastMock.error.mockClear()
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      calls.push({ url, method, body: typeof init?.body === "string" ? init.body : null })
      const path = url.replace(/^\/api\/viber\//, "")
      if (path.startsWith("groups")) {
        return Promise.resolve(
          groupsHttpError
            ? json({ message: "Устройство недоступно: проверьте статус подключения." }, groupsHttpError)
            : json(groupsPayload)
        )
      }
      if (path.startsWith("messages/monitor/status")) return Promise.resolve(json(monitorStatus))
      if (path.startsWith("messages/monitored")) return Promise.resolve(json([]))
      if (/messages\/monitor\/groups\/\d+\/(enable|disable)/.test(path)) {
        return Promise.resolve(json(MONITOR_STATUS))
      }
      return Promise.resolve(json({ error: `unexpected ${method} ${path}` }, 500))
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ViberMonitorPanel on a named instance", () => {
  it("sends the instance and the global group key when a group is switched on", async () => {
    render(<ViberMonitorPanel deviceId="viber" />)

    const toggle = await screen.findByRole("switch", { name: /Включить мониторинг АVTOTRAL/ })
    toggle.click()

    await waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("messages/monitor/groups/99/enable"))
      ).toBe(true)
    })
    const enable = calls.find((call) => call.url.includes("/enable"))
    expect(enable?.method).toBe("POST")
    expect(JSON.parse(enable?.body ?? "{}")).toEqual({ deviceId: "viber", groupKey: "gk-1" })
  })

  it("names the default instance explicitly when the page carries none", async () => {
    // Иначе список групп приходит с default, а лента — со всех инстансов сразу.
    render(<ViberMonitorPanel />)

    const toggle = await screen.findByRole("switch", { name: /Включить мониторинг АVTOTRAL/ })
    toggle.click()

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes("/enable"))).toBe(true)
    })
    for (const path of ["groups?", "messages/monitor/status", "messages/monitored"]) {
      const call = calls.find((item) => item.url.includes(path))
      expect(call?.url).toContain("deviceId=default")
    }
    const enable = calls.find((call) => call.url.includes("/enable"))
    expect(JSON.parse(enable?.body ?? "{}")).toEqual({ deviceId: "default", groupKey: "gk-1" })
  })

  it("asks only for the groups that exist on the instance", async () => {
    // Мониторинг включается лишь для открытых на инстансе групп, поэтому
    // архивные записи из Supabase и ростеров в списке не нужны.
    render(<ViberMonitorPanel deviceId="viber" />)

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes("groups?"))).toBe(true)
    })
    const groupsCall = calls.find((call) => call.url.includes("groups?"))
    expect(groupsCall?.url).toContain("onDevice=true")
  })

  it("names the unreachable instance instead of an empty group list", async () => {
    groupsHttpError = 503
    render(<ViberMonitorPanel deviceId="viber" />)

    const message = await screen.findByText(/Инстанс недоступен/)
    expect(message.textContent).toContain("Устройство недоступно")
  })

  it("warns about the dead instance even when monitored groups fill the list", async () => {
    // Список не пустеет: мониторящиеся группы дописываются из статуса. Без
    // отдельной строки ошибки экран выглядит как живой инстанс.
    groupsHttpError = 503
    monitorStatus = {
      ...MONITOR_STATUS,
      groups: [
        { deviceId: "viber", conversationId: 1, groupKey: "gk-a", name: "Группа А", enabled: true, lastMessageId: 0 },
        { deviceId: "viber", conversationId: 2, groupKey: "gk-b", name: "Группа Б", enabled: true, lastMessageId: 0 },
      ],
    }

    render(<ViberMonitorPanel deviceId="viber" />)

    expect(await screen.findByText(/Инстанс недоступен/)).toBeTruthy()
    expect(screen.getByText("Группа А")).toBeTruthy()
  })

  it("omits the group key for a conversation that has none", async () => {
    // У беседы пустой conversations.group_id. Выдуманный ключ (row id) сервер
    // не находит и отвечает 404 — без ключа он резолвит группу по локальному ID.
    groupsPayload = {
      count: 1,
      groups: [
        {
          conversationId: 7,
          groupId: null,
          name: "Без ключа",
          conversationType: 5,
          memberCount: 4,
        },
      ],
    }

    render(<ViberMonitorPanel deviceId="viber" />)

    const toggle = await screen.findByRole("switch", { name: /Включить мониторинг Без ключа/ })
    toggle.click()

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes("messages/monitor/groups/7/enable"))).toBe(true)
    })
    const enable = calls.find((call) => call.url.includes("/enable"))
    expect(JSON.parse(enable?.body ?? "{}")).toEqual({ deviceId: "viber" })
  })

  it("hides a disabled registry row that no longer exists on the instance", async () => {
    // Группу удалили или аккаунт переустановили: включить её обратно нельзя,
    // сервер ответит 404. Показывать такую строку выключенной незачем.
    monitorStatus = {
      ...MONITOR_STATUS,
      groups: [
        {
          deviceId: "viber",
          conversationId: 500,
          groupKey: "gk-gone",
          name: "Удалённая группа",
          enabled: false,
          lastMessageId: 0,
        },
      ],
    }

    render(<ViberMonitorPanel deviceId="viber" />)

    await screen.findByRole("switch", { name: /мониторинг АVTOTRAL/ })
    expect(screen.queryByText("Удалённая группа")).toBeNull()
  })

  it("keeps an enabled registry row that is gone from the instance so it can be switched off", async () => {
    monitorStatus = {
      ...MONITOR_STATUS,
      groups: [
        {
          deviceId: "viber",
          conversationId: 500,
          groupKey: "gk-gone",
          name: "Удалённая группа",
          enabled: true,
          lastMessageId: 0,
        },
      ],
    }

    render(<ViberMonitorPanel deviceId="viber" />)

    const toggle = await screen.findByRole("switch", { name: /Выключить мониторинг Удалённая группа/ })
    expect(toggle.getAttribute("data-state")).toBe("checked")
    expect(toggle.hasAttribute("disabled")).toBe(false)
    expect(screen.getByText(/Нет на инстансе/)).toBeTruthy()
    // Включить такую строку нечем: единственное доступное действие — снять.
    expect(screen.queryByRole("switch", { name: /Включить мониторинг Удалённая группа/ })).toBeNull()

    toggle.click()

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes("messages/monitor/groups/500/disable"))).toBe(true)
    })
  })

  it("asks the backend for the status, groups and feed of that instance only", async () => {
    render(<ViberMonitorPanel deviceId="viber" />)

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes("messages/monitor/status"))).toBe(true)
    })
    for (const path of ["groups?", "messages/monitor/status", "messages/monitored"]) {
      const call = calls.find((item) => item.url.includes(path))
      expect(call?.url).toContain("deviceId=viber")
    }
  })
})
