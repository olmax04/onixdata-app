// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("sonner", () => ({ toast: toastMock }))

import { ViberParserPanel } from "@/components/dashboard/viber-parser-panel"
import {
  advance,
  FakeEventSource,
  installBrowserStubs,
  installFetch,
  makeBackend,
  makeMembers,
  settle,
} from "./support/panel-harness"

let calls: string[]

beforeEach(() => {
  vi.useFakeTimers()
  installBrowserStubs()
  FakeEventSource.reset()
  vi.stubGlobal("EventSource", FakeEventSource)
  Object.values(toastMock).forEach((fn) => fn.mockClear())

  const backend = makeBackend({ members: makeMembers(20) })
  const harnessFetch = installFetch(backend)
  calls = []
  // Группа, у которой в Supabase уже 20 участников: панель показывает баннер
  // «В базе уже есть сохранённые данные» с кнопкой «Подгрузить из базы».
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push(`${(init?.method ?? "GET").toUpperCase()} ${url}`)
      if (url.replace(/^\/api\/viber\//, "").split("?")[0] === "groups") {
        return new Response(
          JSON.stringify({
            count: 1,
            groups: [
              {
                conversationId: 42,
                groupId: 777,
                name: "Тестовая группа",
                conversationType: 5,
                memberCount: 120,
                messageCount: 10,
                dbParticipantCount: 20,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return harnessFetch(input, init)
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("«Подгрузить из базы»", () => {
  it("читает участников из Supabase, а не запускает задачу на эмуляторе", async () => {
    render(<ViberParserPanel />)
    await settle()
    await advance(0)

    const button = screen.getByRole("button", { name: /Подгрузить из базы/i })
    fireEvent.click(button)
    await settle()
    await advance(0)

    expect(calls.some((c) => c.startsWith("POST") && c.includes("participants/"))).toBe(false)
    expect(
      calls.some((c) => c.startsWith("GET /api/viber/groups/42/members") && c.includes("source=supabase"))
    ).toBe(true)
    expect(toastMock.success).toHaveBeenCalledWith("Участники загружены из базы", {
      description: "20 участников",
    })
    expect(toastMock.error).not.toHaveBeenCalled()
  })
})
