import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { isScrcpyProxyPath, scrcpyProxyResponse } from "../lib/scrcpy-proxy"
import { updateSession } from "../lib/supabase/middleware"

const UPSTREAM = "http://136.92.24.88:8000"

describe("isScrcpyProxyPath", () => {
  it("совпадает только с /scrcpy и вложенными путями", () => {
    expect(isScrcpyProxyPath("/scrcpy")).toBe(true)
    expect(isScrcpyProxyPath("/scrcpy/")).toBe(true)
    expect(isScrcpyProxyPath("/scrcpy/bundle.js")).toBe(true)
    expect(isScrcpyProxyPath("/scrcpyx")).toBe(false)
    expect(isScrcpyProxyPath("/dashboard/scrcpy")).toBe(false)
  })
})

describe("scrcpyProxyResponse", () => {
  it("переписывает страницу и WebSocket на scrcpy-web с сохранением query", () => {
    const req = new NextRequest(
      "https://panel.example.com/scrcpy/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557"
    )
    const res = scrcpyProxyResponse(req, UPSTREAM)
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      `${UPSTREAM}/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557`
    )
  })

  it("отдаёт статику ws-scrcpy из корня upstream", () => {
    const res = scrcpyProxyResponse(new NextRequest("https://panel.example.com/scrcpy/avc.wasm"), UPSTREAM)
    expect(res.headers.get("x-middleware-rewrite")).toBe(`${UPSTREAM}/avc.wasm`)
  })

  it("не пересылает на VPS куки и Authorization панели", () => {
    const req = new NextRequest("https://panel.example.com/scrcpy/index.html", {
      headers: { cookie: "sb-access-token=secret", authorization: "Bearer secret", "x-keep": "1" },
    })
    const res = scrcpyProxyResponse(req, UPSTREAM)
    const overridden = (res.headers.get("x-middleware-override-headers") ?? "").split(",")
    expect(overridden).not.toContain("cookie")
    expect(overridden).not.toContain("authorization")
    expect(overridden).toContain("x-keep")
  })

  it("ведёт /scrcpy на страницу ws-scrcpy внутри /scrcpy/, чтобы относительные пути работали", () => {
    const res = scrcpyProxyResponse(new NextRequest("https://panel.example.com/scrcpy"), UPSTREAM)
    expect(res.status).toBe(308)
    expect(res.headers.get("location")).toBe("https://panel.example.com/scrcpy/index.html")
  })

  it("без адреса scrcpy-web отвечает 503", async () => {
    const res = scrcpyProxyResponse(new NextRequest("https://panel.example.com/scrcpy/index.html"), null)
    expect(res.status).toBe(503)
  })
})

describe("middleware: /scrcpy", () => {
  it("не пускает к экрану без авторизации", async () => {
    const res = await updateSession(new NextRequest("http://localhost:3000/scrcpy/index.html"))
    expect(res.status).toBe(401)
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
