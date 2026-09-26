import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PipelineCard } from "@/components/dashboard/viber/pipeline-card"
import type { TaskDetailDto } from "@/lib/viber-parser/types"

function task(overrides: Partial<TaskDetailDto> = {}): TaskDetailDto {
  return {
    id: "task_1",
    groupTarget: "АVTOTRAL",
    groupName: "АVTOTRAL",
    status: "ready",
    createdAt: "2026-09-09T09:59:00.000Z",
    currentStep: null,
    progress: null,
    stepHistory: [],
    ...overrides,
  }
}

function renderCard(overrides: Partial<React.ComponentProps<typeof PipelineCard>> = {}) {
  const props: React.ComponentProps<typeof PipelineCard> = {
    task: task(),
    isTaskRunning: false,
    isTaskLost: false,
    connection: "online",
    onDismiss: vi.fn(),
    onExportTxt: vi.fn(),
    onExportCsv: vi.fn(),
    onExportJson: vi.fn(),
    onCopyPhones: vi.fn(),
    ...overrides,
  }
  return render(<PipelineCard {...props} />)
}

describe("PipelineCard", () => {
  it("не падает, когда бэкенд не прислал историю шагов", () => {
    // Бэкенд может не прислать stepHistory вовсе — типы этого не гарантируют.
    const { stepHistory: _ignored, ...withoutHistory } = task()

    renderCard({ task: withoutHistory as TaskDetailDto })
    expect(screen.getByText(/Все этапы сбора успешно пройдены за 0 шагов/)).toBeInTheDocument()
  })

  it("показывает, что связь с задачей потеряна", () => {
    renderCard({ task: task({ status: "running" }), isTaskLost: true })
    expect(screen.getByText("Связь с задачей потеряна")).toBeInTheDocument()
  })

  it("не показывает бейдж потери у обычной задачи", () => {
    renderCard()
    expect(screen.queryByText("Связь с задачей потеряна")).not.toBeInTheDocument()
  })
})
