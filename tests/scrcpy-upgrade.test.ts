import http from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { afterEach, describe, expect, it } from "vitest"

import {
  createScrcpyUpgradeHandler,
  installScrcpyUpgradeHook,
  isScrcpyUpgrade,
  upstreamTarget,
} from "../server/scrcpy-upgrade.cjs"

const servers: http.Server[] = []
/** Сокеты после апгрейда отвязаны от сервера: closeAllConnections их не закроет. */
const sockets = new Set<Socket>()

async function listen(server: http.Server): Promise<string> {
  servers.push(server)
  server.on("connection", (socket: Socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(async () => {
  sockets.forEach((socket) => socket.destroy())
  sockets.clear()
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        })
    )
  )
})

/** scrcpy-web: принимает апгрейд на любом пути и эхом возвращает байты. */
async function startUpstream() {
  const seen: Array<{ url?: string; cookie?: string; authorization?: string }> = []
  const server = http.createServer((_req, res) => res.end())
  server.on("upgrade", (req, socket: Socket) => {
    seen.push({ url: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization })
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
    )
    socket.on("data", (chunk) => socket.write(chunk))
  })
  return { origin: await listen(server), seen }
}

/** Панель: /api/scrcpy/session пускает только с куки `session=ok`. */
async function startPanel(upstream: string) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/api/scrcpy/session") {
      res.statusCode = 404
      return res.end()
    }
    if (!req.headers.cookie?.includes("session=ok")) {
      res.statusCode = 401
      return res.end("{}")
    }
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ upstream }))
  })
  return listen(server)
}

async function startFront(sessionOrigin: string) {
  const handler = createScrcpyUpgradeHandler({ sessionOrigin })
  const server = http.createServer((_req, res) => res.end())
  server.on("upgrade", handler)
  return listen(server)
}

function upgrade(origin: string, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; socket?: Socket }>((resolve, reject) => {
    const req = http.request(`${origin}${path}`, {
      headers: { Connection: "Upgrade", Upgrade: "websocket", ...headers },
    })
    req.on("upgrade", (res, socket) => resolve({ status: res.statusCode ?? 0, socket }))
    req.on("response", (res) => resolve({ status: res.statusCode ?? 0 }))
    req.on("error", reject)
    req.end()
  })
}

function echo(socket: Socket, message: string) {
  return new Promise<string>((resolve) => {
    socket.once("data", (chunk) => resolve(chunk.toString()))
    socket.write(message)
  })
}

describe("scrcpy upgrade proxy", () => {
  it("проксирует WebSocket на scrcpy-web без префикса /scrcpy и без кук панели", async () => {
    const upstream = await startUpstream()
    const front = await startFront(await startPanel(upstream.origin))

    const { status, socket } = await upgrade(
      front,
      "/scrcpy/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557",
      { Cookie: "session=ok", Authorization: "Bearer secret" }
    )

    expect(status).toBe(101)
    await expect(echo(socket!, "ping")).resolves.toBe("ping")
    socket!.destroy()
    expect(upstream.seen).toEqual([
      {
        url: "/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557",
        cookie: undefined,
        authorization: undefined,
      },
    ])
  })

  it("не пускает без сессии панели", async () => {
    const upstream = await startUpstream()
    const front = await startFront(await startPanel(upstream.origin))

    const { status } = await upgrade(front, "/scrcpy/index.html?action=proxy-adb")

    expect(status).toBe(401)
    expect(upstream.seen).toHaveLength(0)
  })

  it("отвечает 502, если панель недоступна", async () => {
    const front = await startFront("http://127.0.0.1:1")
    const { status } = await upgrade(front, "/scrcpy/index.html", { Cookie: "session=ok" })
    expect(status).toBe(502)
  })
})

describe("installScrcpyUpgradeHook", () => {
  it("отдаёт /scrcpy обработчику прокси, а остальные апгрейды — Next.js", async () => {
    const calls: string[] = []
    const fakeHttp = { createServer: http.createServer }
    installScrcpyUpgradeHook(fakeHttp as typeof http, (req: http.IncomingMessage, socket: Socket) => {
      calls.push(`scrcpy ${req.url}`)
      socket.destroy()
    })

    const server = fakeHttp.createServer((_req, res) => res.end())
    expect(fakeHttp.createServer).toBe(http.createServer)
    server.on("upgrade", (req: http.IncomingMessage, socket: Socket) => {
      calls.push(`next ${req.url}`)
      socket.destroy()
    })
    const origin = await listen(server)

    await upgrade(origin, "/scrcpy/index.html").catch(() => undefined)
    await upgrade(origin, "/_next/webpack-hmr").catch(() => undefined)

    expect(calls).toEqual(["scrcpy /scrcpy/index.html", "next /_next/webpack-hmr"])
  })
})

describe("helpers", () => {
  it("isScrcpyUpgrade", () => {
    expect(isScrcpyUpgrade("/scrcpy/index.html?action=x")).toBe(true)
    expect(isScrcpyUpgrade("/scrcpy")).toBe(true)
    expect(isScrcpyUpgrade("/scrcpyx")).toBe(false)
    expect(isScrcpyUpgrade(undefined)).toBe(false)
  })

  it("upstreamTarget", () => {
    expect(upstreamTarget("http://1.2.3.4:8000", "/scrcpy/index.html?a=1&b=2")).toBe(
      "http://1.2.3.4:8000/index.html?a=1&b=2"
    )
    expect(upstreamTarget("http://1.2.3.4:8000", "/scrcpy")).toBe("http://1.2.3.4:8000/")
  })
})
