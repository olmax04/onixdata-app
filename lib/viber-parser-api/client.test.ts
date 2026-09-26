import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ViberParserApiClient, ViberApiError } from "./client"

describe("ViberParserApiClient", () => {
  let client: ViberParserApiClient
  const originalFetch = global.fetch

  beforeEach(() => {
    client = new ViberParserApiClient("/api/viber")
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("корректно формирует GET запрос к группам", async () => {
    const mockGroups = [{ id: 1, name: "Test Group", messageCount: 5, participantCount: 10, unreadCount: 0, type: 1 }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(mockGroups)),
    } as unknown as Response)

    const result = await client.groups.list()
    expect(result).toEqual(mockGroups)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/viber/groups"),
      expect.objectContaining({ method: "GET" })
    )
  })

  it("корректно формирует POST запрос для авторизации по номеру", async () => {
    const mockResponse = { success: true, message: "OK" }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as unknown as Response)

    const result = await client.auth.loginPhone({ phoneNumber: "+1234567890", countryName: "Belarus" })
    expect(result).toEqual(mockResponse)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/viber/auth/phone"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phoneNumber: "+1234567890", countryName: "Belarus" }),
      })
    )
  })

  it("выбрасывает ViberApiError при статусе ошибки от сервера", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: "Неверный код" })),
    } as unknown as Response)

    await expect(client.auth.enterCode({ code: "0000" })).rejects.toThrow(ViberApiError)
  })

  it("передает query параметры при запросе пользователей", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ limit: 10, offset: 0, items: [] })),
    } as unknown as Response)

    await client.users.list({ limit: 10, search: "Ivan" })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=10"),
      expect.anything()
    )
  })
})
