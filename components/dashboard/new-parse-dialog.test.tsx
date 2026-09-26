import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("sonner", () => ({ toast }))

import { NewParseDialog } from "@/components/dashboard/new-parse-dialog"
import { platforms } from "@/lib/mock-data"

/* Radix опирается на API, которых нет в jsdom. */
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
  window.HTMLElement.prototype.releasePointerCapture = vi.fn()
  window.HTMLElement.prototype.setPointerCapture = vi.fn()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const renderDialog = () =>
  render(<NewParseDialog trigger={<button>Новая задача</button>} />)

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Новая задача" }))
  return screen.findByRole("dialog")
}

const platformTrigger = () => screen.getByRole("combobox", { name: "Платформа" })

/*
 * Открытый SelectContent вешает окружение jsdom, поэтому платформу выбираем
 * тем же способом, что и с клавиатуры, — набором первой буквы (typeahead).
 */
const pickViber = () => fireEvent.keyDown(platformTrigger(), { key: "V" })

const frequencyTrigger = () =>
  screen.getByRole("combobox", { name: "Частота обновления" })

/* «Р» — первая буква у всех частот, typeahead берёт верхнюю: «Реальное время». */
const pickFirstFrequency = () =>
  fireEvent.keyDown(frequencyTrigger(), { key: "Р" })

describe("NewParseDialog", () => {
  beforeEach(() => {
    toast.success.mockClear()
    toast.error.mockClear()
  })

  it("не отправляет форму без платформы", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openDialog(user)

    /* До отправки этот текст есть только в placeholder. */
    expect(screen.getAllByText("Выберите платформу")).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Запустить сбор" }))

    await waitFor(() => {
      expect(screen.getAllByText("Выберите платформу")).toHaveLength(2)
    })
    expect(platformTrigger()).toHaveAttribute("aria-invalid", "true")
  })

  it("предлагает Viber первым", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openDialog(user)

    expect(platforms[0]).toBe("Viber")

    pickViber()
    await waitFor(() => {
      expect(platformTrigger()).toHaveTextContent("Viber")
    })
  })

  it("«Отмена» закрывает диалог и сбрасывает форму", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openDialog(user)

    await user.type(
      screen.getByLabelText("Ссылка, группа или канал"),
      "invite.viber.com/demo"
    )
    pickViber()
    await waitFor(() => {
      expect(platformTrigger()).toHaveTextContent("Viber")
    })

    await user.click(screen.getByRole("button", { name: "Отмена" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    await openDialog(user)

    expect(platformTrigger()).toHaveTextContent("Выберите платформу")
    expect(platformTrigger()).not.toHaveTextContent("Viber")
    expect(screen.getByLabelText("Ссылка, группа или канал")).toHaveValue("")
  })

  it("после неудачной отправки и закрытия ошибка не остаётся", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openDialog(user)

    await user.click(screen.getByRole("button", { name: "Запустить сбор" }))
    await waitFor(() => {
      expect(platformTrigger()).toHaveAttribute("aria-invalid", "true")
    })

    await user.click(screen.getByRole("button", { name: "Отмена" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    await openDialog(user)

    expect(screen.getAllByText("Выберите платформу")).toHaveLength(1)
    expect(platformTrigger()).toHaveAttribute("aria-invalid", "false")
  })

  it("заполненная форма отвечает тостом, закрывается и сбрасывается", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openDialog(user)

    await user.type(
      screen.getByLabelText("Ссылка, группа или канал"),
      "invite.viber.com/demo"
    )
    await user.type(
      screen.getByLabelText("Ключевые слова"),
      "доставка, тариф"
    )

    pickViber()
    await waitFor(() => {
      expect(platformTrigger()).toHaveTextContent("Viber")
    })

    pickFirstFrequency()
    await waitFor(() => {
      expect(frequencyTrigger()).toHaveTextContent("Реальное время")
    })

    await user.click(screen.getByRole("button", { name: "Запустить сбор" }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1)
    })
    expect(toast.success).toHaveBeenCalledWith("Задача парсинга запущена", {
      description:
        "Viber: invite.viber.com/demo. Демо-режим, сбор не выполняется.",
    })

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    await openDialog(user)

    expect(screen.getByLabelText("Ссылка, группа или канал")).toHaveValue("")
    expect(screen.getByLabelText("Ключевые слова")).toHaveValue("")
    expect(platformTrigger()).toHaveTextContent("Выберите платформу")
    expect(frequencyTrigger()).toHaveTextContent("Выберите частоту")
  })
})
