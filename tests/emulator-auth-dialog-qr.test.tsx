// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastMock, refreshMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  refreshMock: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: toastMock }))
vi.mock("@/lib/emulators-context", () => ({
  useEmulators: () => ({ emulators: [], loading: false, refresh: refreshMock }),
}))

import { EmulatorAuthDialog } from "@/components/dashboard/emulator-auth-dialog"
import { installBrowserStubs } from "./support/panel-harness"
import type { QrAuthStatus } from "@/lib/viber-qr"

const EMULATOR = {
  id: "worker-2",
  name: "worker-2",
  adbSerial: "127.0.0.1:5556",
  scrcpyUrl: null,
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 49 49"><path d="M0 0h1v1H0z"/></svg>'

/** Whatever `GET status` should answer next; each test drives it directly. */
let nextStatus: QrAuthStatus
let startResponse: { ok: boolean; body: Record<string, unknown> }
const fetchCalls: { url: string; method: string; body?: unknown }[] = []

function installFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      fetchCalls.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })

      if (url.startsWith("/api/viber/auth/qr/start")) {
        return {
          ok: startResponse.ok,
          status: startResponse.ok ? 200 : 409,
          json: async () => startResponse.body,
        } as Response
      }
      if (url.startsWith("/api/viber/auth/qr/status")) {
        return { ok: true, status: 200, json: async () => nextStatus } as Response
      }
      if (url.startsWith("/api/viber/auth/qr/cancel")) {
        return { ok: true, status: 200, json: async () => ({ state: "idle" }) } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    }),
  )
}

function renderDialog(onSuccess = vi.fn()) {
  return render(
    <EmulatorAuthDialog emulator={EMULATOR} open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
  )
}

/** Switches to QR mode and asks for a code for a valid number. */
async function openQr(): Promise<void> {
  fireEvent.click(screen.getByRole("tab", { name: /По QR-коду/i }))
  fireEvent.change(screen.getByLabelText(/Номер телефона аккаунта Viber/i), {
    target: { value: "+48794034881" },
  })
  fireEvent.click(screen.getByRole("button", { name: /Показать QR/i }))
  await waitFor(() => {
    expect(fetchCalls.some((call) => call.url.startsWith("/api/viber/auth/qr/start"))).toBe(true)
  })
}

beforeEach(() => {
  installBrowserStubs()
  fetchCalls.length = 0
  nextStatus = { state: "starting" }
  startResponse = { ok: true, body: { state: "starting", message: "ok" } }
  installFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("EmulatorAuthDialog — QR mode", () => {
  it("offers both ways in and starts on SMS", () => {
    renderDialog()
    expect(
      screen.getByRole("tab", { name: /По SMS/i }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(
      screen.getByRole("tab", { name: /По QR-коду/i }).getAttribute("aria-selected"),
    ).toBe("false")
    expect(screen.getByLabelText(/Номер телефона Viber/i)).toBeTruthy()
  })

  it("says plainly that the QR route sends no SMS", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("tab", { name: /По QR-коду/i }))
    expect(screen.getByText(/SMS не отправляется/i)).toBeTruthy()
  })

  it("refuses to start without a plausible number", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("tab", { name: /По QR-коду/i }))
    fireEvent.change(screen.getByLabelText(/Номер телефона аккаунта Viber/i), {
      target: { value: "123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Показать QR/i }))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(fetchCalls.some((call) => call.url.includes("/qr/start"))).toBe(false)
  })

  it("sends the number and the device to the API", async () => {
    renderDialog()
    await openQr()

    const start = fetchCalls.find((call) => call.url.includes("/qr/start"))
    expect(start?.method).toBe("POST")
    expect(start?.body).toMatchObject({
      phoneNumber: "+48794034881",
      deviceId: "127.0.0.1:5556",
    })
  })

  it("draws the code as SVG and says it is waiting to be scanned", async () => {
    nextStatus = {
      state: "qr_ready",
      qr: { svg: SVG, capturedAt: "2026-09-15T10:00:00.000Z" },
    }
    renderDialog()
    await openQr()

    await waitFor(() => expect(screen.getByTestId("qr-svg")).toBeTruthy())
    expect(screen.getByTestId("qr-svg").querySelector("svg")).toBeTruthy()
    expect(screen.getByRole("status").textContent).toMatch(/Ожидание сканирования/i)
  })

  it("falls back to the cropped screenshot when the code could not be decoded", async () => {
    nextStatus = {
      state: "qr_ready",
      qr: { pngBase64: "AAAA", capturedAt: "2026-09-15T10:00:00.000Z" },
    }
    renderDialog()
    await openQr()

    await waitFor(() => expect(screen.getByTestId("qr-png")).toBeTruthy())
    const img = screen.getByTestId("qr-png") as HTMLImageElement
    expect(img.src).toContain("data:image/png;base64,AAAA")
    // Upscaling a 150px crop smoothly is what makes a code unreadable.
    expect(img.style.imageRendering).toBe("pixelated")
  })

  it("reports the scan and then the finish", async () => {
    nextStatus = { state: "scanned" }
    renderDialog()
    await openQr()

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/Отсканировано/i),
    )
  })

  it("refreshes the instance list and reports success once Viber is ready", async () => {
    const onSuccess = vi.fn()
    nextStatus = { state: "ready" }
    renderDialog(onSuccess)
    await openQr()

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(toastMock.success).toHaveBeenCalled()
  })

  it("shows the emulator screen when Viber lands somewhere unrecognised", async () => {
    nextStatus = { state: "unknown_screen", screenshotBase64: "BBBB" }
    renderDialog()
    await openQr()

    await waitFor(() => expect(screen.getByTestId("qr-unknown-screenshot")).toBeTruthy())
    expect(screen.getByRole("status").textContent).toMatch(/незнакомый экран/i)
  })

  it("surfaces the API's own refusal instead of a generic message", async () => {
    startResponse = { ok: false, body: { message: 'Устройство "worker-2" занято другой задачей' } }
    renderDialog()
    await openQr()

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/занято/i))
  })

  it("frees the device when the dialog is dismissed with Esc, not just the button", async () => {
    nextStatus = { state: "qr_ready", qr: { svg: SVG, capturedAt: "now" } }
    renderDialog()
    await openQr()
    await waitFor(() => expect(screen.getByTestId("qr-svg")).toBeTruthy())

    // Radix routes Esc, the close cross and the overlay click through
    // onOpenChange(false) — none of them goes near the «Отменить» button.
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
      code: "Escape",
    })

    await waitFor(() =>
      expect(fetchCalls.some((call) => call.url.includes("/qr/cancel"))).toBe(true),
    )
  })

  it("frees the device when the operator cancels", async () => {
    nextStatus = { state: "qr_ready", qr: { svg: SVG, capturedAt: "now" } }
    renderDialog()
    await openQr()

    await waitFor(() => expect(screen.getByTestId("qr-svg")).toBeTruthy())
    fireEvent.click(screen.getByRole("button", { name: /Отменить/i }))

    await waitFor(() =>
      expect(fetchCalls.some((call) => call.url.includes("/qr/cancel"))).toBe(true),
    )
  })
})
