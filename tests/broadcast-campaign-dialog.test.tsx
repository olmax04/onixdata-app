// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

import { BroadcastCampaignDialog } from "@/components/dashboard/broadcast-campaign-dialog"
import { installBrowserStubs } from "./support/panel-harness"
import type { BroadcastCampaign } from "@/lib/viber-parser/types"

const campaign: BroadcastCampaign = {
  id: "campaign_1",
  name: "Вечерняя рассылка",
  groups: [{ conversationId: 26, name: "Клиенты" }],
  messages: ["Первый текст"],
  intervalMs: 120_000,
  minIntervalPerChatMs: 1_800_000,
  rotation: "shuffle-cycle",
  loop: true,
  activeFrom: "09:00",
  activeTo: "21:00",
  status: "stopped",
  nextGroupIndex: 0,
  rotationState: [{ conversationId: 26, sendCount: 2, lastMessageIndex: 0 }],
  sentCount: 2,
  failedCount: 0,
  lastError: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  startedAt: null,
  stoppedAt: null,
}

const groupRows = [
  { conversationId: 26, name: "Клиенты", memberCount: 10 },
  { conversationId: 31, name: "Партнёры", memberCount: 5 },
]

const fetchMock = vi.fn()

function renderDialog(overrides?: Partial<BroadcastCampaign>, deviceId?: string) {
  const value = { ...campaign, ...overrides }
  const onSaved = vi.fn(async () => {})
  render(
    <BroadcastCampaignDialog
      campaign={value}
      deviceId={deviceId}
      groupRows={groupRows}
      open={true}
      onOpenChange={() => {}}
      onSaved={onSaved}
    />
  )
  return { onSaved }
}

describe("BroadcastCampaignDialog", () => {
  beforeEach(() => {
    installBrowserStubs()
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.info.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("показывает параметры и тексты кампании", () => {
    renderDialog()

    expect(screen.getByLabelText("Название")).toHaveProperty("value", "Вечерняя рассылка")
    expect(screen.getByLabelText("Текст 1")).toHaveProperty("value", "Первый текст")
    expect(screen.getByLabelText("Пауза, мин")).toHaveProperty("value", "2")
    expect(screen.getByLabelText("На чат, мин")).toHaveProperty("value", "30")
    expect(screen.getByLabelText("Рабочие часы с")).toHaveProperty("value", "09:00")
    expect(screen.getByText(/Клиенты — 2/)).toBeDefined()
  })

  it("запрещает правки, пока рассылка идёт", () => {
    renderDialog({ status: "running" })

    expect(screen.getByText("Остановите рассылку, чтобы изменить")).toBeDefined()
    expect(screen.getByLabelText("Название")).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: /Сохранить/ })).toHaveProperty("disabled", true)
  })

  it("отправляет PATCH только с изменёнными полями", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...campaign, name: "Утренняя" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const { onSaved } = renderDialog()

    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Утренняя" } })
    fireEvent.click(screen.getByRole("button", { name: /Сохранить/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/viber/broadcast/campaigns/campaign_1")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(String(init.body))).toEqual({ name: "Утренняя" })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(toastMock.success).toHaveBeenCalled()
  })

  it("отправляет PATCH в выбранный инстанс", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...campaign, name: "Утренняя" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    renderDialog(undefined, "worker / 1")

    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Утренняя" } })
    fireEvent.click(screen.getByRole("button", { name: /Сохранить/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/viber/broadcast/campaigns/campaign_1?deviceId=worker+%2F+1"
    )
  })

  it("передаёт имена групп вместе с новым списком бесед", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(campaign), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    renderDialog()

    fireEvent.click(screen.getByLabelText("Партнёры"))
    fireEvent.click(screen.getByRole("button", { name: /Сохранить/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      conversationIds: [26, 31],
      groupNames: { "26": "Клиенты", "31": "Партнёры" },
    })
  })

  it("не шлёт запрос, когда ничего не изменилось", () => {
    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /Сохранить/ }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(toastMock.info).toHaveBeenCalledWith("Изменений нет")
  })
})
