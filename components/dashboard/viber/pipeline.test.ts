import { describe, expect, it } from "vitest"

import {
  computePipelineMetrics,
  computePipelineSteps,
} from "@/components/dashboard/viber/pipeline"
import {
  filterMembers,
  formatTaskDate,
  formatTaskDuration,
  collectUniquePhones,
} from "@/components/dashboard/viber/format"
import type { TaskDetailDto, TaskSummaryDto, ViberMember } from "@/lib/viber-parser/types"

function stateOf(steps: ReturnType<typeof computePipelineSteps>, step: string) {
  return steps.find((item) => item.step === step)?.state
}

function task(overrides: Partial<TaskDetailDto> = {}): TaskDetailDto {
  return {
    id: "task_1",
    groupTarget: "26",
    status: "running",
    createdAt: "2026-09-09T10:00:00.000Z",
    stepHistory: [],
    ...overrides,
  }
}

describe("computePipelineSteps", () => {
  it("отмечает пройденные шаги по stepHistory, текущий — по currentStep", () => {
    const steps = computePipelineSteps(
      task({
        currentStep: {
          step: "paging_participants",
          description: "Сбор страниц",
          startedAt: "2026-09-09T10:01:00.000Z",
        },
        stepHistory: [
          { step: "resolving_group", startedAt: "2026-09-09T10:00:01.000Z", durationMs: 1200 },
          { step: "attaching_frida", startedAt: "2026-09-09T10:00:03.000Z", durationMs: 2400 },
          { step: "navigating_viber", startedAt: "2026-09-09T10:00:06.000Z", durationMs: 5400 },
        ],
      })
    )

    expect(stateOf(steps, "resolving_group")).toBe("done")
    expect(stateOf(steps, "navigating_viber")).toBe("done")
    expect(stateOf(steps, "paging_participants")).toBe("current")
    expect(stateOf(steps, "exporting_results")).toBe("pending")
    expect(steps.find((s) => s.step === "attaching_frida")?.durationMs).toBe(2400)
  })

  it("у завершённой задачи текущего шага нет", () => {
    const steps = computePipelineSteps(
      task({
        status: "ready",
        currentStep: null,
        stepHistory: [
          { step: "resolving_group", startedAt: "2026-09-09T10:00:01.000Z", durationMs: 1000 },
          { step: "exporting_results", startedAt: "2026-09-09T10:05:00.000Z", durationMs: 900 },
        ],
      })
    )

    expect(steps.some((step) => step.state === "current")).toBe(false)
    expect(stateOf(steps, "exporting_results")).toBe("done")
  })

  it("помечает сбойный шаг как ошибочный", () => {
    const steps = computePipelineSteps(
      task({
        status: "error",
        currentStep: null,
        stepHistory: [
          { step: "resolving_group", startedAt: "2026-09-09T10:00:01.000Z", durationMs: 1000 },
          { step: "attaching_frida", startedAt: "2026-09-09T10:00:03.000Z", durationMs: 500 },
        ],
      })
    )

    expect(stateOf(steps, "resolving_group")).toBe("done")
    expect(stateOf(steps, "attaching_frida")).toBe("error")
  })

  it("без задачи все шаги в ожидании", () => {
    const steps = computePipelineSteps(null)
    expect(steps).toHaveLength(10)
    expect(steps.every((step) => step.state === "pending")).toBe(true)
  })
})

describe("computePipelineMetrics", () => {
  it("строит прогресс пагинации по реальным ключам", () => {
    const metrics = computePipelineMetrics({
      headerTotal: 900,
      pagesCount: 3,
      currentOffset: 150,
      pageSize: 50,
      lastPage: false,
    })

    expect(metrics[0]?.id).toBe("paging")
    expect(metrics[0]?.percent).toBe(17)
    expect(metrics[0]?.detail).toContain("Страниц: 3")
    expect(metrics[0]?.detail).toContain("Смещение: 150")
  })

  it("показывает ожидание синка номеров", () => {
    const metrics = computePipelineMetrics({ syncedPhoneNumbers: 120, stable: true })
    expect(metrics[0]?.id).toBe("numbers-sync")
    expect(metrics[0]?.detail).toContain("120")
  })

  it("поддерживает оба варианта ключей активности", () => {
    expect(computePipelineMetrics({ total: 10, completed: 4 })[0]?.percent).toBe(40)
    expect(computePipelineMetrics({ onlineTotal: 10, onlineChecked: 9 })[0]?.percent).toBe(90)
  })

  it("без прогресса метрик нет", () => {
    expect(computePipelineMetrics(null)).toEqual([])
    expect(computePipelineMetrics({})).toEqual([])
  })
})

describe("format", () => {
  it("формат даты защищён от Invalid Date", () => {
    expect(formatTaskDate({ createdAt: "", startedAt: undefined })).toBe("—")
    expect(formatTaskDate({ createdAt: "не дата", startedAt: null })).toBe("—")
    expect(formatTaskDate({ createdAt: "2026-09-09T10:00:00.000Z" })).not.toBe("—")
  })

  it("длительность считается по completedAt", () => {
    const summary: TaskSummaryDto = {
      id: "t",
      groupTarget: "26",
      status: "ready",
      createdAt: "2026-09-09T10:00:00.000Z",
      startedAt: "2026-09-09T10:00:00.000Z",
      completedAt: "2026-09-09T10:02:30.000Z",
    }
    expect(formatTaskDuration(summary)).toBe("2 мин 30 сек")
  })

  it("для активной задачи показывает, что она идёт", () => {
    const summary: TaskSummaryDto = {
      id: "t",
      groupTarget: "26",
      status: "running",
      createdAt: "2026-09-09T10:00:00.000Z",
      startedAt: "2026-09-09T10:00:00.000Z",
    }
    expect(formatTaskDuration(summary, Date.parse("2026-09-09T10:00:45.000Z"))).toBe("идёт 45 сек")
  })

  it("фильтрация и дедупликация участников", () => {
    const members: ViberMember[] = [
      { participantId: 1, phoneNumber: "+380501112233", name: "Иван", memberId: "abc", roleLabel: "member", isDecoded: true },
      { participantId: 2, phoneNumber: "380501112233", name: "Иван дубль", memberId: "abc2", roleLabel: "member", isDecoded: true },
      { participantId: 3, phoneNumber: "Ожидает дешифровки", rawNumber: "em:xyz", name: null, memberId: "em:xyz", roleLabel: "admin", isDecoded: false },
    ]

    expect(filterMembers(members)).toHaveLength(2)
    expect(filterMembers(members, { hideDuplicates: false })).toHaveLength(3)
    expect(filterMembers(members, { filter: "decoded" })).toHaveLength(1)
    expect(filterMembers(members, { filter: "undecoded" })).toHaveLength(1)
    expect(filterMembers(members, { filter: "admins" })).toHaveLength(1)
    expect(filterMembers(members, { query: "иван" })).toHaveLength(1)
    expect(collectUniquePhones(members)).toEqual(["+380501112233", "380501112233"])
  })
})
