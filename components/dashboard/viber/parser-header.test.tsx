import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ParserHeader } from "@/components/dashboard/viber/parser-header"

function renderHeader(overrides: Partial<React.ComponentProps<typeof ParserHeader>> = {}) {
  const props: React.ComponentProps<typeof ParserHeader> = {
    connection: "online",
    initialLoadDone: true,
    consecutiveFailures: 0,
    lastError: null,
    isTaskRunning: false,
    currentStepLabel: "Выполняется",
    isStopping: false,
    isRefreshing: false,
    onStop: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ParserHeader {...props} />) }
}

describe("ParserHeader", () => {
  it("держит заголовок панели на втором уровне после h1 из шапки", () => {
    renderHeader()
    expect(screen.getByRole("heading", { level: 2, name: /Viber Automation Engine/ })).toBeInTheDocument()
  })

  it("у иконочной кнопки обновления есть доступное имя", () => {
    renderHeader()
    expect(screen.getByRole("button", { name: "Обновить данные" })).toBeInTheDocument()
  })

  it("блокирует кнопку и крутит иконку, пока идёт ручное обновление", async () => {
    const user = userEvent.setup()
    let finish: (() => void) | null = null
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )

    renderHeader({ onRefresh })
    const button = screen.getByRole("button", { name: "Обновить данные" })
    expect(button).not.toBeDisabled()

    await user.click(button)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin")

    await act(async () => {
      finish?.()
    })

    expect(button).not.toBeDisabled()
    expect(button.querySelector("svg")?.getAttribute("class")).not.toContain("animate-spin")
  })

  it("во время первой загрузки кнопка тоже занята", () => {
    renderHeader({ initialLoadDone: false, isRefreshing: true })
    const button = screen.getByRole("button", { name: "Обновить данные" })
    expect(button).toBeDisabled()
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin")
  })
})
