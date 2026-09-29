// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://panel.example.com/dashboard/emulators"}
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { EmulatorScreenDialog } from "@/components/dashboard/emulator-screen-dialog"
import { installBrowserStubs } from "./support/panel-harness"

const DIRECT =
  "http://136.92.24.88:8000/#!action=stream&udid=host.docker.internal%3A5557&player=broadway&ws=ws%3A%2F%2F136.92.24.88%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3Dhost.docker.internal%253A5557"

beforeEach(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
})

describe("EmulatorScreenDialog", () => {
  it("на HTTPS-панели встраивает экран через прокси /scrcpy/, а не по HTTP", async () => {
    render(
      <EmulatorScreenDialog
        open
        onOpenChange={() => {}}
        emulatorName="test-emulator"
        scrcpyUrl={DIRECT}
        adbPort={5557}
      />
    )

    const iframe = await waitFor(() => screen.getByTitle("Экран test-emulator"))
    const src = new URL(iframe.getAttribute("src")!)
    expect(src.origin).toBe("https://panel.example.com")
    expect(src.pathname).toBe("/scrcpy/index.html")
    const hash = new URLSearchParams(src.hash.slice(2))
    expect(hash.get("udid")).toBe("host.docker.internal:5557")
    expect(hash.get("ws")).toBe(
      "wss://panel.example.com/scrcpy/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557"
    )
    expect(screen.queryByText(/Mixed Content/)).toBeNull()

    // Прямая ссылка на VPS остаётся запасным вариантом.
    expect(screen.getByText("прямую ссылку на scrcpy-web").closest("a")?.getAttribute("href")).toBe(DIRECT)
  })

  it("без ссылки на экран показывает, что трансляция недоступна", () => {
    render(
      <EmulatorScreenDialog open onOpenChange={() => {}} emulatorName="x" scrcpyUrl={null} />
    )
    expect(screen.getByText("Трансляция экрана недоступна.")).toBeTruthy()
  })
})
