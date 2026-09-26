// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react"
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

let calls: string[]

beforeEach(() => {
  installBrowserStubs()
  toastMock.error.mockClear()
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push(url)
      const path = url.replace(/^\/api\/viber\//, "")
      if (path.startsWith("groups")) return Promise.resolve(json(GROUPS))
      if (path.startsWith("broadcast/status")) return Promise.resolve(json({ isRunning: false, campaign: null }))
      if (path.startsWith("broadcast/campaigns")) return Promise.resolve(json([]))
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

  it("keeps the archive in the list when no instance is selected", async () => {
    render(<ViberBroadcastPanel />)

    await waitFor(() => expect(groupsRequest()).toBeTruthy())
    expect(groupsRequest()).not.toContain("onDevice")
  })
})
