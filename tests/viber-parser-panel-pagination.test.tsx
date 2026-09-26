// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock("sonner", () => ({ toast: toastMock }))

import { ViberParserPanel } from "@/components/dashboard/viber-parser-panel"
import {
  advance,
  Backend,
  FakeEventSource,
  installBrowserStubs,
  installFetch,
  makeBackend,
  makeMembers,
  settle,
} from "./support/panel-harness"

let backend: Backend
let fetchSpy: ReturnType<typeof installFetch>

beforeEach(() => {
  vi.useFakeTimers()
  installBrowserStubs()
  FakeEventSource.reset()
  vi.stubGlobal("EventSource", FakeEventSource)
  try {
    window.localStorage.clear()
  } catch {
    // окружение без хранилища — панель обязана работать и так
  }
  backend = makeBackend({ members: makeMembers(120) })
  fetchSpy = installFetch(backend)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function mountPanel() {
  render(<ViberParserPanel />)
  await settle()
  await advance(0)
}

function memberRows() {
  return screen.queryAllByTestId("members-row")
}

function rowNumbers() {
  return memberRows().map((row) => row.querySelector("td")?.textContent?.trim() ?? "")
}

async function click(element: HTMLElement) {
  await reactAct(async () => {
    fireEvent.click(element)
    await vi.advanceTimersByTimeAsync(0)
  })
}

async function pickPageSize(label: string) {
  const trigger = screen.getByRole("combobox", { name: "Размер страницы" })
  await reactAct(async () => {
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    await vi.advanceTimersByTimeAsync(0)
  })
  await click(screen.getByRole("option", { name: label }))
}

describe("пагинация участников", () => {
  it("рендерит только первую страницу, а не весь список", async () => {
    await mountPanel()

    expect(memberRows()).toHaveLength(50)
    expect(screen.getByText("Показано 1–50 из 120")).toBeTruthy()
  })

  it("«Вперёд» и «Назад» переключают страницы", async () => {
    await mountPanel()

    await click(screen.getByRole("button", { name: "Вперёд" }))
    expect(memberRows()).toHaveLength(50)
    expect(screen.getByText("Показано 51–100 из 120")).toBeTruthy()

    await click(screen.getByRole("button", { name: "Назад" }))
    expect(screen.getByText("Показано 1–50 из 120")).toBeTruthy()
  })

  it("нумерация второй страницы продолжается с 51", async () => {
    await mountPanel()
    await click(screen.getByRole("button", { name: "Вперёд" }))

    expect(rowNumbers()[0]).toBe("51")
    expect(rowNumbers()[49]).toBe("100")
  })

  it("смена размера страницы даёт 100 строк и возвращает на первую страницу", async () => {
    await mountPanel()
    await click(screen.getByRole("button", { name: "Вперёд" }))
    expect(screen.getByText("Показано 51–100 из 120")).toBeTruthy()

    await pickPageSize("По 100")

    expect(memberRows()).toHaveLength(100)
    expect(screen.getByText("Показано 1–100 из 120")).toBeTruthy()
  })

  it("поиск возвращает на первую страницу", async () => {
    await mountPanel()
    await click(screen.getByRole("button", { name: "Вперёд" }))
    expect(screen.getByText("Показано 51–100 из 120")).toBeTruthy()

    await reactAct(async () => {
      fireEvent.change(screen.getByPlaceholderText("Поиск по имени/номеру…"), {
        target: { value: "Участник" },
      })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText("Показано 1–50 из 120")).toBeTruthy()
  })
})

describe("ручное обновление участников", () => {
  function memberUrls() {
    return fetchSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/members"))
  }

  it("первичная загрузка идёт без refresh, кнопка обновления — с refresh=1", async () => {
    await mountPanel()

    expect(memberUrls()).toHaveLength(1)
    expect(memberUrls()[0]).not.toContain("refresh=1")

    await click(screen.getByRole("button", { name: "Обновить участников" }))

    const urls = memberUrls()
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain("refresh=1")
  })
})
