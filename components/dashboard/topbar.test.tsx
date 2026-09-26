import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}))

import { Topbar } from "@/components/dashboard/topbar"

describe("Topbar", () => {
  beforeEach(() => {
    toast.mockClear()
  })

  it("поле поиска контролируемое", async () => {
    const user = userEvent.setup()
    render(<Topbar title="Обзор" />)

    const input = screen.getByLabelText("Поиск по сообщениям")
    await user.type(input, "тариф")

    expect(input).toHaveValue("тариф")
  })

  it("отправка поиска показывает демо-тост", () => {
    render(<Topbar title="Обзор" />)

    fireEvent.submit(screen.getByRole("search"))

    expect(toast).toHaveBeenCalledWith("Поиск", {
      description: "Демо-режим: индекс не подключён.",
    })
  })

  it("счётчик уведомлений не кладёт div внутрь кнопки", () => {
    render(<Topbar title="Обзор" />)

    const button = screen.getByRole("button", { name: "Уведомления: 5" })
    expect(button.querySelector("div")).toBeNull()
    expect(button).toHaveTextContent("5")
  })
})
