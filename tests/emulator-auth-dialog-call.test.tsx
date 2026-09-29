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

const EMULATOR = { id: "c1", name: "test-emulator", adbSerial: "136.92.24.88:5557", scrcpyUrl: null }
const CALL_MESSAGE =
  "Viber звонит на ваш номер. Введите последние 4 цифры номера, с которого поступил звонок."

const fetchCalls: { url: string; body?: Record<string, unknown> }[] = []

beforeEach(() => {
  installBrowserStubs()
  fetchCalls.length = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      fetchCalls.push({ url, body })
      if (url === "/api/viber/auth/phone" || url === "/api/viber/auth/call") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            step: "waiting_for_code",
            verification: "call",
            codeLength: 4,
            message: CALL_MESSAGE,
          }),
        } as Response
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function submitPhone() {
  render(<EmulatorAuthDialog emulator={EMULATOR} open onOpenChange={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(/Номер телефона Viber/i), {
    target: { value: "+48794034881" },
  })
  fireEvent.click(screen.getByRole("button", { name: /Отправить номер/i }))
  await waitFor(() => expect(screen.getByText(CALL_MESSAGE)).toBeTruthy())
}

describe("EmulatorAuthDialog — вход по звонку Viber", () => {
  it("после номера просит последние цифры номера звонящего", async () => {
    await submitPhone()

    const input = screen.getByLabelText("Последние 4 цифры номера звонящего") as HTMLInputElement
    expect(input.maxLength).toBe(4)
    expect(input.placeholder).toBe("0000")
    expect(fetchCalls[0]).toEqual({
      url: "/api/viber/auth/phone",
      body: { phoneNumber: "+48794034881", deviceId: "136.92.24.88:5557", clearData: false },
    })
  })

  it("не отправляет неполный код", async () => {
    await submitPhone()

    fireEvent.change(screen.getByLabelText(/Последние 4 цифры/), { target: { value: "48" } })
    fireEvent.click(screen.getByRole("button", { name: /Подтвердить код/i }))

    expect(toastMock.error).toHaveBeenCalledWith(
      "Введите последние 4 цифры номера, с которого звонил Viber"
    )
    expect(fetchCalls.some((call) => call.url === "/api/viber/auth/code")).toBe(false)
  })

  it("по кнопке запрашивает звонок ещё раз", async () => {
    await submitPhone()

    fireEvent.click(screen.getByRole("button", { name: /Позвонить ещё раз/i }))

    await waitFor(() =>
      expect(fetchCalls).toContainEqual({
        url: "/api/viber/auth/call",
        body: { deviceId: "136.92.24.88:5557" },
      })
    )
  })
})
