import { describe, expect, it } from "vitest"

import {
  applyTaskEvent,
  buildStepTimeline,
  describeTaskCompletion,
  isCompletionAnnounceable,
  isTerminalTaskStatus,
  mergeTaskDetail,
} from "@/lib/viber-parser/task-progress"
import type { TaskDetailDto, TaskStatus, TaskStepDto } from "@/lib/viber-parser/types"

const T0 = Date.parse("2026-09-11T10:00:00.000Z")

function iso(offsetMs: number) {
  return new Date(T0 + offsetMs).toISOString()
}

function step(name: string, index: number, durationMs: number | null = 1000): TaskStepDto {
  return {
    step: name,
    description: `Шаг ${name}`,
    startedAt: iso(index * 1000),
    durationMs,
  }
}

/** Реальная последовательность бэкенда: 12 записей на 10 карточек UI. */
const FULL_HISTORY: TaskStepDto[] = [
  "initializing",
  "resolving_group",
  "attaching_frida",
  "navigating_viber",
  "paging_participants",
  "syncing_live_db",
  "restarting_viber",
  "waiting_numbers_sync",
  "deduplicating_and_finalizing",
  "exporting_results",
  "fetching_online_activity",
  "exporting_results",
].map((name, index) => step(name, index, (index + 1) * 100))

function detail(overrides: Partial<TaskDetailDto> = {}): TaskDetailDto {
  return {
    id: "task_a",
    groupTarget: "Группа",
    groupName: "Группа",
    status: "running",
    startedAt: iso(0),
    stepHistory: [],
    currentStep: null,
    progress: null,
    result: null,
    error: null,
    ...overrides,
  }
}

describe("isTerminalTaskStatus", () => {
  it("терминальные и рабочие статусы", () => {
    const terminal: TaskStatus[] = ["ready", "error", "stopped"]
    const active: TaskStatus[] = ["initializing", "starting", "running"]
    expect(terminal.every(isTerminalTaskStatus)).toBe(true)
    expect(active.some(isTerminalTaskStatus)).toBe(false)
    expect(isTerminalTaskStatus(null)).toBe(false)
    expect(isTerminalTaskStatus(undefined)).toBe(false)
  })
})

describe("buildStepTimeline", () => {
  it("пустая история и отсутствие задачи не ломают таймлайн", () => {
    const empty = buildStepTimeline(null)
    expect(empty.byStep).toEqual({})
    expect(empty.visitedSteps).toEqual([])
    expect(empty.currentStep).toBeNull()
    expect(empty.isTerminal).toBe(false)

    const fresh = buildStepTimeline(detail({ status: "initializing" }))
    expect(fresh.visitedSteps).toEqual([])
  })

  it("завершённая задача: все шаги из истории пройдены, текущего нет", () => {
    const timeline = buildStepTimeline(
      detail({ status: "ready", stepHistory: FULL_HISTORY, currentStep: null })
    )

    expect(timeline.isTerminal).toBe(true)
    expect(timeline.currentStep).toBeNull()
    expect(timeline.visitedSteps).toHaveLength(11)
    expect(
      timeline.visitedSteps.every((name) => timeline.byStep[name]?.state === "completed")
    ).toBe(true)
  })

  it("шаг initializing попадает в таймлайн, хотя карточки для него нет", () => {
    const timeline = buildStepTimeline(detail({ status: "ready", stepHistory: FULL_HISTORY }))
    expect(timeline.byStep.initializing?.state).toBe("completed")
    expect(timeline.visitedSteps[0]).toBe("initializing")
  })

  it("повторный exporting_results считается один раз, длительности суммируются", () => {
    const timeline = buildStepTimeline(detail({ status: "ready", stepHistory: FULL_HISTORY }))
    const view = timeline.byStep.exporting_results

    expect(view?.occurrences).toBe(2)
    // 10-я запись (1000 мс) и 12-я (1200 мс)
    expect(view?.durationMs).toBe(2200)
    expect(view?.startedAt).toBe(FULL_HISTORY[9].startedAt)
  })

  it("текущий шаг подсвечен, непройденные отсутствуют", () => {
    const timeline = buildStepTimeline(
      detail({
        status: "running",
        stepHistory: FULL_HISTORY.slice(0, 4),
        currentStep: step("paging_participants", 4, null),
      })
    )

    expect(timeline.currentStep).toBe("paging_participants")
    expect(timeline.byStep.paging_participants?.state).toBe("current")
    expect(timeline.byStep.navigating_viber?.state).toBe("completed")
    expect(timeline.byStep.exporting_results).toBeUndefined()
  })

  it("текущий шаг берётся из статуса, если деталь его ещё не знает", () => {
    const timeline = buildStepTimeline(detail({ status: "running" }), "attaching_frida")
    expect(timeline.byStep.attaching_frida?.state).toBe("current")
  })

  it("упавший шаг помечен ошибкой, а не галочкой", () => {
    const timeline = buildStepTimeline(
      detail({
        status: "error",
        error: "boom",
        stepHistory: FULL_HISTORY.slice(0, 4),
        currentStep: step("navigating_viber", 3),
      })
    )

    expect(timeline.byStep.navigating_viber?.state).toBe("error")
    expect(timeline.byStep.attaching_frida?.state).toBe("completed")
  })

  it("прерванный шаг остановленной задачи помечен отдельно", () => {
    const timeline = buildStepTimeline(
      detail({
        status: "stopped",
        stepHistory: FULL_HISTORY.slice(0, 5),
        currentStep: step("paging_participants", 4),
      })
    )

    expect(timeline.byStep.paging_participants?.state).toBe("stopped")
    expect(timeline.byStep.syncing_live_db).toBeUndefined()
  })

  it("прерванный шаг показывается, даже если не успел попасть в историю", () => {
    const timeline = buildStepTimeline(
      detail({
        status: "stopped",
        stepHistory: FULL_HISTORY.slice(0, 5),
        currentStep: step("syncing_live_db", 5, null),
      })
    )

    expect(timeline.byStep.syncing_live_db?.state).toBe("stopped")
    expect(timeline.byStep.paging_participants?.state).toBe("completed")
    expect(timeline.currentStep).toBeNull()
  })

  it("остановленная задача без currentStep помечает последний шаг истории", () => {
    const timeline = buildStepTimeline(
      detail({ status: "stopped", stepHistory: FULL_HISTORY.slice(0, 5), currentStep: null })
    )
    expect(timeline.byStep.paging_participants?.state).toBe("stopped")
  })
})

describe("mergeTaskDetail", () => {
  const ready = detail({ status: "ready", stepHistory: FULL_HISTORY, result: {
    group: "Группа",
    conversationId: 42,
    pagesCount: 3,
    participantsCount: 120,
    participantsWithPhone: 87,
    savedJsonPath: "a.json",
    savedTxtPath: "a.txt",
  } })

  it("терминальный снимок не откатывается к рабочему", () => {
    const stale = detail({ status: "running", stepHistory: FULL_HISTORY.slice(0, 3) })
    expect(mergeTaskDetail(ready, stale)).toBe(ready)
  })

  it("более бедная история не затирает более полную", () => {
    const poorer = detail({ status: "ready", stepHistory: FULL_HISTORY.slice(0, 6) })
    expect(mergeTaskDetail(ready, poorer)).toBe(ready)
  })

  it("другая задача заменяет текущую", () => {
    const other = detail({ id: "task_b", status: "running" })
    expect(mergeTaskDetail(ready, other)).toBe(other)
  })

  it("более полный снимок той же задачи принимается", () => {
    const earlier = detail({
      status: "running",
      stepHistory: FULL_HISTORY.slice(0, 4),
      currentStep: step("paging_participants", 4, null),
    })
    const later = detail({
      status: "running",
      stepHistory: FULL_HISTORY.slice(0, 7),
      currentStep: step("waiting_numbers_sync", 7, null),
    })

    expect(mergeTaskDetail(earlier, later)).toBe(later)
    expect(mergeTaskDetail(earlier, ready)).toBe(ready)
  })

  it("поздний ответ по неактуальной задаче игнорируется", () => {
    const current = detail({ id: "task_b", status: "running" })
    const lateFromOldTask = detail({ id: "task_a", status: "ready", stepHistory: FULL_HISTORY })

    expect(mergeTaskDetail(current, lateFromOldTask, "task_b")).toBe(current)
    expect(mergeTaskDetail(current, detail({ id: "task_b", status: "running" }), "task_b")).not.toBe(
      current
    )
  })

  it("итог задачи не теряется, если новый снимок пришёл без result", () => {
    const withoutResult = detail({ status: "ready", stepHistory: FULL_HISTORY, result: null })
    const merged = mergeTaskDetail(ready, withoutResult)
    expect(merged?.result).toEqual(ready.result)
  })

  it("при равной полноте более старый текущий шаг не откатывает свежий", () => {
    const fresh = detail({
      status: "running",
      stepHistory: FULL_HISTORY.slice(0, 4),
      currentStep: step("paging_participants", 4, null),
    })
    const older = detail({
      status: "running",
      stepHistory: FULL_HISTORY.slice(0, 4),
      currentStep: step("navigating_viber", 3, null),
    })

    expect(mergeTaskDetail(fresh, older)).toBe(fresh)
    expect(mergeTaskDetail(older, fresh)).toBe(fresh)
  })

  it("пустой снимок не трогает состояние", () => {
    expect(mergeTaskDetail(ready, null)).toBe(ready)
    expect(mergeTaskDetail(null, ready)).toBe(ready)
  })
})

describe("applyTaskEvent", () => {
  const base = detail({
    status: "starting",
    stepHistory: [],
    currentStep: step("resolving_group", 0, null),
  })

  it("смена шага переносит предыдущий в историю и считает длительность", () => {
    const next = applyTaskEvent(base, {
      taskId: "task_a",
      status: "running",
      step: step("attaching_frida", 2, null),
      timestamp: iso(2000),
    })

    expect(next?.stepHistory).toHaveLength(1)
    expect(next?.stepHistory[0]?.step).toBe("resolving_group")
    expect(next?.stepHistory[0]?.durationMs).toBe(2000)
    expect(next?.currentStep).toMatchObject({ step: "attaching_frida" })
    expect(next?.status).toBe("running")
  })

  it("повторное событие того же шага не дублирует историю и мержит прогресс", () => {
    const withProgress = detail({
      status: "running",
      stepHistory: [],
      currentStep: step("resolving_group", 0, null),
      progress: { headerTotal: 120, currentOffset: 20 },
    })

    const first = applyTaskEvent(withProgress, {
      taskId: "task_a",
      status: "running",
      step: step("attaching_frida", 2, null),
      timestamp: iso(2000),
    })
    const second = applyTaskEvent(first, {
      taskId: "task_a",
      status: "running",
      step: step("attaching_frida", 2, null),
      progress: { currentOffset: 40, pagesCount: 2 },
    })

    expect(second?.stepHistory).toHaveLength(1)
    // прогресс дополняется, а не заменяется целиком
    expect(second?.progress).toEqual({ headerTotal: 120, currentOffset: 40, pagesCount: 2 })
  })

  it("возврат к уже пройденному шагу снова кладёт предыдущий в историю", () => {
    const afterExport = detail({
      status: "running",
      stepHistory: FULL_HISTORY.slice(0, 10),
      currentStep: step("fetching_online_activity", 10, null),
    })

    const backToExport = applyTaskEvent(afterExport, {
      taskId: "task_a",
      status: "running",
      step: step("exporting_results", 11, null),
      timestamp: iso(11_000),
    })

    expect(backToExport?.stepHistory).toHaveLength(11)
    expect(backToExport?.stepHistory[10]?.step).toBe("fetching_online_activity")
    expect(backToExport?.currentStep).toMatchObject({ step: "exporting_results" })

    const timeline = buildStepTimeline(backToExport)
    expect(timeline.byStep.exporting_results?.state).toBe("current")
    expect(timeline.byStep.exporting_results?.occurrences).toBe(1)
  })

  it("в историю попадает даже шаг, отличный от последней записи истории", () => {
    const resumed = detail({
      status: "running",
      // последняя запись истории — НЕ текущий шаг
      stepHistory: [step("resolving_group", 1), step("attaching_frida", 2)],
      currentStep: step("navigating_viber", 3, null),
    })

    const next = applyTaskEvent(resumed, {
      taskId: "task_a",
      status: "running",
      step: step("paging_participants", 4, null),
      timestamp: iso(4000),
    })

    expect(next?.stepHistory).toHaveLength(3)
    expect(next?.stepHistory[2]?.step).toBe("navigating_viber")
  })

  it("терминальное событие закрывает текущий шаг", () => {
    const done = applyTaskEvent(base, {
      taskId: "task_a",
      status: "ready",
      timestamp: iso(5000),
    })

    expect(done?.status).toBe("ready")
    expect(done?.currentStep).toBeNull()
    expect(done?.stepHistory).toHaveLength(1)
    expect(done?.completedAt).toBe(iso(5000))
  })

  it("событие чужой задачи и событие без загруженных деталей игнорируются", () => {
    expect(applyTaskEvent(base, { taskId: "task_b", status: "ready" })).toBe(base)
    expect(applyTaskEvent(null, { taskId: "task_a", status: "ready" })).toBeNull()
    expect(applyTaskEvent(base, null)).toBe(base)
  })

  it("итог задачи из событий не появляется — снимок остаётся без result", () => {
    const done = applyTaskEvent(base, { taskId: "task_a", status: "ready", timestamp: iso(5000) })
    expect(done?.result).toBeNull()
  })
})

describe("объявление о завершении", () => {
  const readyWithoutResult = detail({ status: "ready", stepHistory: FULL_HISTORY, result: null })
  const readyWithResult = detail({
    status: "ready",
    stepHistory: FULL_HISTORY,
    result: {
      group: "Группа",
      conversationId: 42,
      pagesCount: 3,
      participantsCount: 120,
      participantsWithPhone: 87,
      savedJsonPath: "a.json",
      savedTxtPath: "a.txt",
    },
  })

  it("снимок из SSE без результата ещё не повод объявлять о завершении", () => {
    expect(isCompletionAnnounceable(readyWithoutResult, false)).toBe(false)
  })

  it("дотянутый запросом снимок или снимок с результатом — можно объявлять", () => {
    expect(isCompletionAnnounceable(readyWithoutResult, true)).toBe(true)
    expect(isCompletionAnnounceable(readyWithResult, false)).toBe(true)
  })

  it("остановка и ошибка объявляются сразу, рабочая задача — никогда", () => {
    expect(isCompletionAnnounceable(detail({ status: "stopped" }), false)).toBe(true)
    expect(isCompletionAnnounceable(detail({ status: "error" }), false)).toBe(true)
    expect(isCompletionAnnounceable(detail({ status: "running" }), true)).toBe(false)
    expect(isCompletionAnnounceable(null, true)).toBe(false)
  })

  it("текст уведомления берёт реальные числа из результата", () => {
    expect(describeTaskCompletion(readyWithResult)).toEqual({
      kind: "success",
      title: "Сбор участников успешно завершен!",
      description: "Собрано: 120, с номерами: 87",
    })
    expect(describeTaskCompletion(detail({ status: "stopped" }))).toEqual({
      kind: "info",
      title: "Сбор остановлен",
    })
    expect(describeTaskCompletion(detail({ status: "error", error: "boom" }))).toEqual({
      kind: "error",
      title: "Ошибка при выполнении задачи",
      description: "boom",
    })
    expect(describeTaskCompletion(detail({ status: "running" }))).toBeNull()
  })
})
