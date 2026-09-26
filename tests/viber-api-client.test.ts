import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { viberApi } from "@/lib/viber-parser/client"

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("viberApi client (Swagger API)", () => {
  describe("system", () => {
    it("getStatus calls /api/viber/viber/status", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ isRunning: true, pid: 1234 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const status = await viberApi.system.getStatus()
      expect(fetchMock).toHaveBeenCalledWith("/api/viber/viber/status", expect.any(Object))
      expect(status).toEqual({ isRunning: true, pid: 1234 })
    })

    it("start calls POST /api/viber/viber/start", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ isRunning: true, pid: 1234, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const res = await viberApi.system.start({ clearData: false, waitForLogin: true })
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/viber/start",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ clearData: false, waitForLogin: true }),
        })
      )
      expect(res.isRunning).toBe(true)
    })
  })

  describe("auth", () => {
    it("submitPhone calls POST /api/viber/auth/phone", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: "Code sent" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const res = await viberApi.auth.submitPhone({ phoneNumber: "+380501234567" })
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/auth/phone",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phoneNumber: "+380501234567" }),
        })
      )
      expect(res.success).toBe(true)
    })

    it("submitCode calls POST /api/viber/auth/code", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: "Logged in" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const res = await viberApi.auth.submitCode({ code: "654321" })
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/auth/code",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "654321" }),
        })
      )
      expect(res.success).toBe(true)
    })
  })

  describe("users (Supabase sync)", () => {
    it("list calls /api/viber/users with query parameters", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 25791,
            limit: 10,
            offset: 0,
            items: [{ id: 824, phone: "+380507805449", name: "Nico" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )

      const res = await viberApi.users.list({ limit: 10, offset: 0, phone: "+380" })
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/users?limit=10&offset=0&phone=%2B380",
        expect.any(Object)
      )
      expect(res.total).toBe(25791)
      expect(res.items.length).toBe(1)
    })

    it("getSyncStatus calls /api/viber/users/sync/status", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            reachable: true,
            message: "Supabase доступен",
            usersTotal: 25791,
            groupsTotal: 3,
            membersTotal: 25937,
            groups: [],
            checkedAt: "2026-09-26T10:00:00Z",
            lastSyncedAt: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )

      const status = await viberApi.users.getSyncStatus(3)
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/users/sync/status?conversationId=3",
        expect.any(Object)
      )
      expect(status.usersTotal).toBe(25791)
    })

    it("syncAll calls POST /api/viber/users/sync/all", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: "Синхронизировано",
            groupsTotal: 3,
            usersUpserted: 100,
            failed: 0,
            syncedAt: "2026-09-26T10:00:00Z",
            groups: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )

      const res = await viberApi.users.syncAll()
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/users/sync/all",
        expect.objectContaining({ method: "POST" })
      )
      expect(res.success).toBe(true)
    })
  })

  describe("broadcast campaigns", () => {
    it("getCampaigns calls /api/viber/broadcast/campaigns", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const campaigns = await viberApi.broadcast.getCampaigns()
      expect(fetchMock).toHaveBeenCalledWith("/api/viber/broadcast/campaigns", expect.any(Object))
      expect(campaigns).toEqual([])
    })

    it("createCampaign calls POST /api/viber/broadcast/campaigns", async () => {
      const newCampaign = {
        name: "Тест",
        groups: [{ conversationId: 1, name: "Группа 1" }],
        messages: ["Привет!"],
      }
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "camp_1", ...newCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const res = await viberApi.broadcast.createCampaign(newCampaign)
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/broadcast/campaigns",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newCampaign),
        })
      )
      expect(res.id).toBe("camp_1")
    })

    it("deleteCampaign calls DELETE /api/viber/broadcast/campaigns/:id", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "camp_1", deleted: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

      const res = await viberApi.broadcast.deleteCampaign("camp_1")
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/viber/broadcast/campaigns/camp_1",
        expect.objectContaining({ method: "DELETE" })
      )
      expect(res.deleted).toBe(true)
    })
  })
})
