import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET, POST } from "../app/api/emulators/[[...path]]/route"

function request(path = "", method = "GET") {
  return new NextRequest(`http://localhost:3000/api/emulators${path ? `/${path}` : ""}`, {
    method,
  })
}

function context(path = "") {
  return { params: { path: path ? path.split("/") : [] } }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.EMULATOR_AGENT_URL = "http://agent:9000"
  process.env.VIBER_PARSER_URL = "http://parser:8080"
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("emulator proxy", () => {
  it("returns the reached agent error without replacing it with fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Инстанс остановлен" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    )

    const response = await POST(
      request("container-1/viber/logout", "POST"),
      context("container-1/viber/logout")
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Инстанс остановлен" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("marks the standalone virtual worker as not supporting logout", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("agent unavailable"))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ isRunning: true, pid: 10, account: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

    const response = await GET(request(), context())
    const body = await response.json()

    expect(body.emulators[0].supportsViberLogout).toBe(false)
  })

  it("replaces the agent's localhost screen link with the VPS address", async () => {
    process.env.EMULATOR_AGENT_URL = "http://136.92.24.88:9000"
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            emulators: [
              {
                id: "c1",
                name: "test-emulator",
                adbPort: 5557,
                scrcpyUrl:
                  "http://localhost:8000/#!action=stream&udid=host.docker.internal%3A5557&player=mse&ws=ws%3A%2F%2Flocalhost%3A8000%2F",
              },
              { id: "c2", name: "stopped", adbPort: null, scrcpyUrl: null },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockRejectedValueOnce(new TypeError("parser unavailable"))

    const response = await GET(request(), context())
    const body = await response.json()

    expect(body.emulators[0].scrcpyUrl).toBe(
      "http://136.92.24.88:8000/#!action=stream&udid=host.docker.internal%3A5557&player=broadway&ws=ws%3A%2F%2F136.92.24.88%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3Dhost.docker.internal%253A5557"
    )
    expect(body.emulators[1].scrcpyUrl).toBeNull()
  })
})
