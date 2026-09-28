// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { InstanceFolderCard } from "../components/dashboard/instance-folder-card"
import type { EmulatorItem } from "../lib/emulator-status"

const emulator: EmulatorItem = {
  id: "container-1234567890",
  name: "android-emulator",
  containerName: "android-emulator",
  status: "Viber активен",
  state: "running",
  created: 1,
  adbPort: 5555,
  adbSerial: "localhost:5555",
  scrcpyUrl: null,
  bootCompleted: true,
  viberRunning: true,
  adbOnline: true,
  setupStatus: null,
  supportsViberLogout: true,
  viberAccount: {
    phoneNumber: "+48452207088",
    displayName: "Maks",
    status: "authorized",
    authorizedAt: "2026-09-27T12:00:00.000Z",
    source: "device",
  },
}

function renderCard(overrides: Partial<EmulatorItem> = {}, actionLoading: string | null = null) {
  const onLogout = vi.fn()
  render(
    <InstanceFolderCard
      emulator={{ ...emulator, ...overrides }}
      isExpanded={true}
      onToggleExpand={vi.fn()}
      onAction={vi.fn()}
      onDelete={vi.fn()}
      onRecreate={vi.fn()}
      onOpenScreen={vi.fn()}
      onOpenLogs={vi.fn()}
      onOpenAuth={vi.fn()}
      onLogout={onLogout}
      actionLoading={actionLoading}
    />
  )
  return onLogout
}

describe("InstanceFolderCard Viber status", () => {
  afterEach(cleanup)

  it("shows application and authorized account details in a separate block", () => {
    renderCard()

    expect(screen.getByRole("heading", { name: "Статус Viber" })).toBeDefined()
    expect(screen.getByText("Приложение запущено")).toBeDefined()
    expect(screen.getByText("Maks")).toBeDefined()
    expect(screen.getByText("+48 452 207 088")).toBeDefined()
  })

  it("wires logout and exposes its loading state", () => {
    const onLogout = renderCard()
    fireEvent.click(screen.getByRole("button", { name: "Выйти из Viber" }))
    expect(onLogout).toHaveBeenCalledWith(emulator)

    cleanup()
    renderCard({}, `logout-${emulator.id}`)
    const button = screen.getByRole("button", { name: "Выход из Viber..." })
    expect(button.getAttribute("disabled")).not.toBeNull()
  })

  it("shows a clear unauthenticated state and disables logout", () => {
    renderCard({ viberRunning: false, viberAccount: null })

    expect(screen.getByText("Приложение не запущено")).toBeDefined()
    expect(screen.getByText("Вход в аккаунт не выполнен")).toBeDefined()
    expect(screen.getByRole("button", { name: "Выйти из Viber" }).getAttribute("disabled")).not.toBeNull()
  })

  it("disables logout when the emulator does not support it", () => {
    renderCard({ supportsViberLogout: false })

    expect(screen.getByRole("button", { name: "Выйти из Viber" }).getAttribute("disabled")).not.toBeNull()
  })

  it("blocks this card while an action is running on another instance", () => {
    renderCard({}, "restart-another-container")

    expect(screen.getByRole("button", { name: "Выйти из Viber" }).getAttribute("disabled")).not.toBeNull()
  })
})
