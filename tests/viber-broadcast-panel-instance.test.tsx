// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

import { ViberBroadcastPanel } from "@/components/dashboard/viber-broadcast-panel"
import { installBrowserStubs } from "./support/panel-harness"

/**
 * Рассылка идёт в чаты выбранного инстанса, поэтому целями кампании могут быть
 * только группы, открытые на его эмуляторе. Страница без инстанса по-прежнему
 * показывает полный список вместе с архивом.
 */

const GROUPS = {
  count: 1,
  groups: [
    {
      conversationId: 42,
      groupId: "777",
      name: "Тестовая группа",
      conversationType: 5,
      memberCount: 120,
    },
  ],
}

const CAMPAIGN = {
  id: "campaign_1",
  name: "Тестовая рассылка",
  groups: [{ conversationId: 42, name: "Тестовая группа" }],
  messages: ["Первый текст"],
  intervalMs: 120_000,
  minIntervalPerChatMs: 1_800_000,
  rotation: "shuffle-cycle",
  loop: true,
  activeFrom: "09:00",
  activeTo: "21:00",
  status: "stopped",
  nextGroupIndex: 0,
  rotationState: [],
  sentCount: 0,
  failedCount: 0,
  lastError: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  startedAt: null,
  stoppedAt: null,
} as const

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

let calls: string[]
let requests: Array<{ url: string; method: string }>
let campaignStatus: "stopped" | "running"

beforeEach(() => {
  installBrowserStubs()
  toastMock.error.mockClear()
  calls = []
  requests = []
  campaignStatus = "stopped"
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push(url)
      requests.push({ url, method: init?.method ?? "GET" })
      const path = url.replace(/^\/api\/viber\//, "")
      if (path.startsWith("groups")) return Promise.resolve(json(GROUPS))
      if (path.startsWith("broadcast/status")) {
        return Promise.resolve(
          json({
            isRunning: campaignStatus === "running",
            campaign: campaignStatus === "running" ? { ...CAMPAIGN, status: campaignStatus } : null,
          })
        )
      }
      if (path.includes("/start") && init?.method === "POST") {
        campaignStatus = "running"
        return Promise.resolve(json({ ...CAMPAIGN, status: campaignStatus }))
      }
      if (path.includes("/stop") && init?.method === "POST") {
        campaignStatus = "stopped"
        return Promise.resolve(json({ ...CAMPAIGN, status: campaignStatus }))
      }
      if (path.startsWith("broadcast/campaigns")) {
        if (init?.method === "POST") return Promise.resolve(json(CAMPAIGN))
        if (init?.method === "DELETE") return Promise.resolve(json(null))
        return Promise.resolve(json([{ ...CAMPAIGN, status: campaignStatus }]))
      }
      if (path.startsWith("broadcast/history")) return Promise.resolve(json([]))
      return Promise.resolve(json({ error: `unexpected ${path}` }, 500))
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ViberBroadcastPanel group targets", () => {
  function groupsRequest() {
    return calls.find((url) => /^\/api\/viber\/groups(\?|$)/.test(url))
  }

  it("asks only for the groups of the selected instance", async () => {
    render(<ViberBroadcastPanel deviceId="worker" />)

    await waitFor(() => expect(groupsRequest()).toBeTruthy())
    expect(groupsRequest()).toContain("deviceId=worker")
    expect(groupsRequest()).toContain("onDevice=true")
  })

  it("scopes broadcast reads and actions to the selected instance", async () => {
    render(<ViberBroadcastPanel deviceId="worker / 1" />)

    await waitFor(() => {
      expect(calls).toEqual(
        expect.arrayContaining([
          "/api/viber/broadcast/campaigns?deviceId=worker+%2F+1",
          "/api/viber/broadcast/status?deviceId=worker+%2F+1",
          "/api/viber/broadcast/history/last?deviceId=worker+%2F+1",
          "/api/viber/broadcast/history?limit=50&deviceId=worker+%2F+1",
        ])
      )
    })

    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новая" } })
    fireEvent.click(screen.getByLabelText("Тестовая группа"))
    fireEvent.change(screen.getByLabelText("Текст 1"), { target: { value: "Сообщение" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить кампанию" }))
    await waitFor(() =>
      expect(requests).toContainEqual({
        url: "/api/viber/broadcast/campaigns?deviceId=worker+%2F+1",
        method: "POST",
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "Запустить" }))
    await waitFor(() =>
      expect(calls).toContain(
        "/api/viber/broadcast/campaigns/campaign_1/start?deviceId=worker+%2F+1"
      )
    )

    fireEvent.click(await screen.findByRole("button", { name: "Стоп" }))
    await waitFor(() =>
      expect(calls).toContain(
        "/api/viber/broadcast/campaigns/campaign_1/stop?deviceId=worker+%2F+1"
      )
    )

    fireEvent.click(await screen.findByRole("button", { name: "Удалить Тестовая рассылка" }))
    await waitFor(() =>
      expect(requests).toContainEqual({
        url: "/api/viber/broadcast/campaigns/campaign_1?deviceId=worker+%2F+1",
        method: "DELETE",
      })
    )
  })

  it("keeps the archive in the list when no instance is selected", async () => {
    render(<ViberBroadcastPanel />)

    await waitFor(() => expect(groupsRequest()).toBeTruthy())
    expect(groupsRequest()).not.toContain("onDevice")
    expect(calls).toEqual(
      expect.arrayContaining([
        "/api/viber/broadcast/campaigns",
        "/api/viber/broadcast/status",
        "/api/viber/broadcast/history/last",
        "/api/viber/broadcast/history?limit=50",
      ])
    )
  })
})
