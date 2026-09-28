// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DatasetsTable } from "@/components/dashboard/datasets-table"
import { SourcesTable } from "@/components/dashboard/sources-table"
import type { GroupSyncStatus } from "@/lib/viber-parser/types"

const BIG_GROUP_ID: GroupSyncStatus["id"] = "9007199254740993"

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const MOCK_SYNC_STATUS = {
  configured: true,
  reachable: true,
  message: "Supabase доступен, записи есть",
  usersTotal: 25791,
  groupsTotal: 3,
  membersTotal: 25937,
  lastSyncedAt: "2026-09-25T11:19:29.482646+00:00",
  groups: [
    {
      id: BIG_GROUP_ID,
      instanceId: "worker-02",
      groupKey: "5569560781658637023",
      conversationId: 3,
      name: "УКРАЇНЦІ В БЕРЛІНІ",
      participantCount: 1999,
      activeMembers: 1995,
      inactiveMembers: 4,
      lastSyncedAt: "2026-09-25T11:19:29.482646+00:00",
    },
  ],
  checkedAt: "2026-09-26T10:00:00Z",
}

const MOCK_USERS_PAGE = {
  total: 25791,
  limit: 25,
  offset: 0,
  items: [
    {
      id: 824,
      identity_key: "NZnYsXsvnNs=",
      member_id: "NZnYsXsvnNs=",
      phone: "+380507805449",
      name: "Nico",
      viber_name: "Nico",
      is_online: true,
      last_seen_at: "2026-09-16T12:26:42.201+00:00",
      updated_at: "2026-09-25T11:19:29.482646+00:00",
    },
    {
      id: 10,
      identity_key: "HcvrP82KC0w=",
      member_id: "HcvrP82KC0w=",
      phone: "+380988806081",
      name: "Lena",
      viber_name: null,
      is_online: false,
      last_seen_at: "2026-09-25T10:19:33.666+00:00",
      updated_at: "2026-09-25T11:19:29.482646+00:00",
    },
  ],
}

describe("DatasetsTable (Supabase Users)", () => {
  it("рендерит пользователей и статистику из Supabase", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("users/sync/status")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SYNC_STATUS), { status: 200 }))
      }
      if (url.includes("users")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_USERS_PAGE), { status: 200 }))
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })

    render(<DatasetsTable />)

    expect(await screen.findByText("+380507805449")).toBeDefined()
    expect(await screen.findByText("+380988806081")).toBeDefined()
    expect((await screen.findAllByText("Nico")).length).toBeGreaterThan(0)
    expect(await screen.findByText("Lena")).toBeDefined()
    expect(await screen.findByText("Онлайн")).toBeDefined()
    expect(await screen.findByText("Офлайн")).toBeDefined()
  })

  it("кнопка синхронизации шлёт запрос syncAll", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("users/sync/all") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: "Синхронизировано",
              usersUpserted: 50,
              groupsTotal: 3,
            }),
            { status: 200 }
          )
        )
      }
      if (url.includes("users/sync/status")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SYNC_STATUS), { status: 200 }))
      }
      if (url.includes("users")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_USERS_PAGE), { status: 200 }))
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })

    render(<DatasetsTable />)

    await waitFor(() => {
      expect(screen.getByText("+380507805449")).toBeDefined()
    })

    const syncButton = screen.getByText("Синхронизировать с Supabase")
    await act(async () => {
      fireEvent.click(syncButton)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/viber/users/sync/all",
      expect.objectContaining({ method: "POST" })
    )
  })
})

describe("SourcesTable (Supabase Groups)", () => {
  it("рендерит синхронизированные группы из Supabase", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("users/sync/status")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SYNC_STATUS), { status: 200 }))
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })

    render(<SourcesTable />)

    await waitFor(() => {
      expect(screen.getByText("УКРАЇНЦІ В БЕРЛІНІ")).toBeDefined()
      expect(screen.getByText("#3")).toBeDefined()
      expect(screen.getByText("1 999")).toBeDefined()
      expect(screen.getByText("1 995")).toBeDefined()
    })
  })

  it("кнопка синхронизации конкретной группы вызывает users/sync/group/:id", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("users/sync/group/3") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              groupName: "УКРАЇНЦІ В БЕРЛІНІ",
              usersUpserted: 20,
            }),
            { status: 200 }
          )
        )
      }
      if (url.includes("users/sync/status")) {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SYNC_STATUS), { status: 200 }))
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })

    render(<SourcesTable />)

    await waitFor(() => {
      expect(screen.getByText("УКРАЇНЦІ В БЕРЛІНІ")).toBeDefined()
    })

    const syncBtn = screen.getByText("Синхронизировать")
    await act(async () => {
      fireEvent.click(syncBtn)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/viber/users/sync/group/3",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("удаляет группу по Supabase id, блокирует строку и обновляет статус", async () => {
    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => {
      resolveDelete = resolve
    })
    let statusCalls = 0
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes(`users/groups/${BIG_GROUP_ID}`) && init?.method === "DELETE") {
        return deleteResponse
      }
      if (url.includes("users/sync/status")) {
        statusCalls += 1
        const status = statusCalls === 1
          ? MOCK_SYNC_STATUS
          : { ...MOCK_SYNC_STATUS, groupsTotal: 2, groups: [] }
        return Promise.resolve(new Response(JSON.stringify(status), { status: 200 }))
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)

    render(<SourcesTable />)
    await screen.findByText("УКРАЇНЦІ В БЕРЛІНІ")

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Удалить группу УКРАЇНЦІ В БЕРЛІНІ" }))
    })

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("УКРАЇНЦІ В БЕРЛІНІ"))
    expect(confirmSpy.mock.calls[0][0]).toContain("связи участников и сообщения мониторинга")
    expect(confirmSpy.mock.calls[0][0]).toContain("Пользователи останутся в базе")
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/viber/users/groups/${BIG_GROUP_ID}`,
      expect.objectContaining({ method: "DELETE" })
    )
    expect(screen.getByRole("button", { name: "Удаление группы УКРАЇНЦІ В БЕРЛІНІ" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: "Синхронизировать" }).hasAttribute("disabled")).toBe(true)

    await act(async () => {
      resolveDelete(new Response(JSON.stringify({ success: true, id: BIG_GROUP_ID, name: "УКРАЇНЦІ В БЕРЛІНІ" }), { status: 200 }))
      await deleteResponse
    })

    await waitFor(() => {
      expect(statusCalls).toBe(2)
      expect(screen.queryByText("УКРАЇНЦІ В БЕРЛІНІ")).toBeNull()
    })
  })
})
