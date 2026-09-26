import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { HistoryTab } from "@/components/dashboard/viber/history-tab"
import type { TaskDetailDto, TaskSummaryDto } from "@/lib/viber-parser/types"

const summary: TaskSummaryDto = {
  id: "task_1",
  groupTarget: "АVTOTRAL",
  groupName: "АVTOTRAL",
  status: "ready",
  createdAt: "2026-09-09T09:59:00.000Z",
  completedAt: "2026-09-09T10:01:00.000Z",
}

describe("HistoryTab", () => {
  it("блокирует кнопку обновления, пока запрос не завершился", async () => {
    const user = userEvent.setup()
    let finish: (() => void) | null = null
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )

    render(
      <HistoryTab
        tasks={[]}
        loading={false}
        onRefresh={onRefresh}
        onOpenDetail={vi.fn().mockResolvedValue(null)}
      />
    )

    const button = screen.getByRole("button", { name: "Обновить историю задач" })
    expect(button).not.toBeDisabled()

    await user.click(button)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()

    await act(async () => {
      finish?.()
    })

    expect(button).not.toBeDisabled()
  })

  it("открывает детали задачи, у которой бэкенд не прислал stepHistory", async () => {
    const user = userEvent.setup()
    // Прокси отдаёт detail без stepHistory — диалог обязан открыться, а не упасть.
    const detail = { ...summary } as TaskDetailDto

    render(
      <HistoryTab
        tasks={[summary]}
        loading={false}
        onRefresh={vi.fn()}
        onOpenDetail={vi.fn().mockResolvedValue(detail)}
      />
    )

    await user.click(screen.getByRole("button", { name: "Детали" }))

    expect(await screen.findByText("Шаги ещё не зафиксированы.")).toBeInTheDocument()
  })
})
