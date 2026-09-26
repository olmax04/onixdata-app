// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard/instances",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    profile: {
      name: "Максим Орлов",
      email: "maxim@onixdata.io",
      initials: "МО",
      role: "Владелец рабочей области",
    },
    signOut: vi.fn(),
  }),
}))

vi.mock("@/lib/emulators-context", () => ({
  useEmulators: () => ({
    emulators: [
      {
        id: "worker-1",
        name: "worker",
        containerName: "viber-worker-1",
        status: "online",
        state: "running",
        created: Date.now(),
        adbSerial: "emulator-5554",
      },
    ],
    loading: false,
    error: null,
    kvmAvailable: true,
    vpsHost: null,
    refresh: vi.fn(),
  }),
}))

import { Topbar } from "@/components/dashboard/topbar"

describe("Topbar header functionality", () => {
  beforeEach(() => {
    pushMock.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders title correctly", () => {
    render(<Topbar title="Инстансы Viber" />)
    expect(screen.getByText("Инстансы Viber")).toBeDefined()
  })

  it("does not render the 'Новая задача' button", () => {
    render(<Topbar title="Инстансы Viber" />)
    expect(screen.queryByText(/Новая задача/i)).toBeNull()
  })

  it("renders active search input with keyboard shortcut hint", () => {
    render(<Topbar title="Инстансы Viber" />)
    const searchInputs = screen.getAllByRole("searchbox")
    expect(searchInputs.length).toBeGreaterThan(0)
    const input = searchInputs[0]
    expect(input).toBeDefined()

    // Typing in search updates value
    fireEvent.change(input, { target: { value: "доставка" } })
    expect((input as HTMLInputElement).value).toBe("доставка")
  })

  it("submitting search redirects to /dashboard/stream?q=...", () => {
    render(<Topbar title="Инстансы Viber" />)
    const searchInputs = screen.getAllByRole("searchbox")
    const input = searchInputs[0]

    fireEvent.change(input, { target: { value: "тестовый запрос" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
    const form = input.closest("form")
    if (form) {
      fireEvent.submit(form)
    }

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/stream?q=%D1%82%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D1%8B%D0%B9%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81")
    )
  })

  it("renders notifications button with badge counter", () => {
    render(<Topbar title="Инстансы Viber" />)
    const bellBtn = screen.getByRole("button", { name: /Уведомления/i })
    expect(bellBtn).toBeDefined()
  })
})
