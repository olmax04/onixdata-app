import { describe, expect, it } from "vitest"

import {
  initialParserSyncState,
  parserSyncReducer,
  selectConnectionState,
  selectIsTaskRunning,
  type ParserSyncAction,
  type ParserSyncState,
} from "@/lib/viber-parser/parser-sync"
import type {
  TaskDetailDto,
  TaskEvent,
  TaskSummaryDto,
  ViberParserStatus,
} from "@/lib/viber-parser/types"

const T0 = Date.parse("2026-09-09T10:00:00.000Z")

function task(overrides: Partial<TaskDetailDto> = {}): TaskDetailDto {
  return {
    id: "task_1",
    groupTarget: "АVTOTRAL",
    groupName: "АVTOTRAL",
    status: "running",
    createdAt: "2026-09-09T09:59:00.000Z",
    startedAt: "2026-09-09T09:59:05.000Z",
    currentStep: {
      step: "paging_participants",
      description: "Сбор страниц",
      startedAt: "2026-09-09T09:59:30.000Z",
    },
    progress: { pagesCount: 2, headerTotal: 900 },
    stepHistory: [],
    ...overrides,
  }
}

function statusPayload(overrides: Partial<ViberParserStatus> = {}): ViberParserStatus {
  const detail = overrides.task === undefined ? task() : overrides.task
  return {
    state: "RUNNING",
    isDriverActive: true,
    taskId: detail?.id ?? null,
    task: detail,
    tasks: detail ? [detail as TaskSummaryDto] : [],
    currentStep: "paging_participants",
    progress: detail?.progress ?? null,
    groupName: detail?.groupName ?? null,
    fetchedAt: "2026-09-09T10:00:00.000Z",
    ...overrides,
  }
}

function run(state: ParserSyncState, ...actions: ParserSyncAction[]): ParserSyncState {
  return actions.reduce(parserSyncReducer, state)
}

describe("parserSyncReducer / poll_success", () => {
  it("сохраняет статус, задачу и историю", () => {
    const payload = statusPayload()
    const state = run(initialParserSyncState, {
      type: "poll_success",
      payload,
      seq: 1,
      now: T0,
    })

    expect(state.status).toEqual(payload)
    expect(state.task).toEqual(payload.task)
    expect(state.tasks).toEqual(payload.tasks)
    expect(state.consecutiveFailures).toBe(0)
    expect(state.lastError).toBeNull()
    expect(state.lastSuccessAt).toBe(T0)
  })

  it("игнорирует устаревший ответ с меньшим seq", () => {
    const fresh = statusPayload({ task: task({ status: "running", progress: { pagesCount: 9 } }) })
    const stale = statusPayload({ task: task({ status: "initializing", progress: { pagesCount: 1 } }) })

    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: fresh, seq: 5, now: T0 },
      { type: "poll_success", payload: stale, seq: 4, now: T0 + 100 }
    )

    expect(state.task?.progress?.pagesCount).toBe(9)
    expect(state.task?.status).toBe("running")
  })

  it("не теряет задачу, если detail не пришёл, но taskId тот же", () => {
    const withDetail = statusPayload()
    const withoutDetail = statusPayload({ task: null, taskId: "task_1", tasks: [task() as TaskSummaryDto] })

    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: withDetail, seq: 1, now: T0 },
      { type: "poll_success", payload: withoutDetail, seq: 2, now: T0 + 2000 }
    )

    expect(state.task?.id).toBe("task_1")
    expect(state.task?.progress?.pagesCount).toBe(2)
  })

  it("оставляет карточку активной задачи, когда бэкенд перезапустился и список пуст", () => {
    const empty = statusPayload({ state: "IDLE", task: null, taskId: null, tasks: [], currentStep: null })
    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: statusPayload(), seq: 1, now: T0 },
      { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 }
    )
    expect(state.task?.id).toBe("task_1")
    expect(state.lostTaskId).toBe("task_1")
    expect(state.pendingLostTaskId).toBe("task_1")
    expect(selectIsTaskRunning(state)).toBe(false)
  })

  it("убирает завершённую задачу, пропавшую из ответа после рестарта", () => {
    const empty = statusPayload({ state: "IDLE", task: null, taskId: null, tasks: [], currentStep: null })
    const state = run(
      initialParserSyncState,
      {
        type: "poll_success",
        payload: statusPayload({ state: "IDLE", task: task({ status: "ready" }) }),
        seq: 1,
        now: T0,
      },
      { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 }
    )
    expect(state.task).toBeNull()
    expect(state.pendingLostTaskId).toBeNull()
  })
})

describe("parserSyncReducer / poll_failure", () => {
  it("ничего не сбрасывает и копит счётчик ошибок", () => {
    const payload = statusPayload()
    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload, seq: 1, now: T0 },
      { type: "poll_failure", error: "Бэкенд Viber недоступен", seq: 2, now: T0 + 2000 },
      { type: "poll_failure", error: "Бэкенд Viber недоступен", seq: 3, now: T0 + 4000 }
    )

    expect(state.status).toEqual(payload)
    expect(state.task).toEqual(payload.task)
    expect(state.tasks).toEqual(payload.tasks)
    expect(state.consecutiveFailures).toBe(2)
    expect(state.lastError).toBe("Бэкенд Viber недоступен")
    expect(state.lastSuccessAt).toBe(T0)
  })

  it("успешный ответ сбрасывает счётчик ошибок", () => {
    const state = run(
      initialParserSyncState,
      { type: "poll_failure", error: "err", seq: 1, now: T0 },
      { type: "poll_failure", error: "err", seq: 2, now: T0 + 1000 },
      { type: "poll_success", payload: statusPayload(), seq: 3, now: T0 + 2000 }
    )
    expect(state.consecutiveFailures).toBe(0)
    expect(state.lastError).toBeNull()
  })

  it("игнорирует устаревшую ошибку", () => {
    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: statusPayload(), seq: 7, now: T0 },
      { type: "poll_failure", error: "старый ответ", seq: 6, now: T0 + 100 }
    )
    expect(state.consecutiveFailures).toBe(0)
    expect(state.lastError).toBeNull()
  })
})

describe("selectConnectionState / selectIsTaskRunning", () => {
  const online = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  it("online пока опрос успешен", () => {
    expect(selectConnectionState(online, T0 + 1000)).toBe("online")
  })

  it("одна-две ошибки — переподключение, а не офлайн", () => {
    const one = run(online, { type: "poll_failure", error: "e", seq: 2, now: T0 + 2000 })
    expect(selectConnectionState(one, T0 + 3000)).toBe("reconnecting")

    const two = run(one, { type: "poll_failure", error: "e", seq: 3, now: T0 + 4000 })
    expect(selectConnectionState(two, T0 + 5000)).toBe("reconnecting")
  })

  it("три ошибки подряд — офлайн", () => {
    const three = run(
      online,
      { type: "poll_failure", error: "e", seq: 2, now: T0 + 2000 },
      { type: "poll_failure", error: "e", seq: 3, now: T0 + 4000 },
      { type: "poll_failure", error: "e", seq: 4, now: T0 + 6000 }
    )
    expect(selectConnectionState(three, T0 + 7000)).toBe("offline")
  })

  it("офлайн, если успеха не было дольше 12 секунд", () => {
    const one = run(online, { type: "poll_failure", error: "e", seq: 2, now: T0 + 13_000 })
    expect(selectConnectionState(one, T0 + 13_000)).toBe("offline")
  })

  it("задача считается активной при переподключении", () => {
    const reconnecting = run(online, { type: "poll_failure", error: "e", seq: 2, now: T0 + 2000 })
    expect(selectIsTaskRunning(reconnecting)).toBe(true)
    expect(selectConnectionState(reconnecting, T0 + 3000)).toBe("reconnecting")
  })

  it("завершённая задача не считается активной", () => {
    const done = run(online, {
      type: "poll_success",
      payload: statusPayload({ state: "IDLE", task: task({ status: "ready" }) }),
      seq: 2,
      now: T0 + 2000,
    })
    expect(selectIsTaskRunning(done)).toBe(false)
  })
})

describe("parserSyncReducer / sse_event", () => {
  const base = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  function event(overrides: Partial<TaskEvent> = {}): TaskEvent {
    return {
      taskId: "task_1",
      status: "running",
      timestamp: "2026-09-09T10:00:05.000Z",
      ...overrides,
    }
  }

  it("мержит шаг и прогресс в текущую задачу", () => {
    const state = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: event({
        step: {
          step: "waiting_numbers_sync",
          description: "Ожидание синка номеров",
          startedAt: "2026-09-09T10:00:05.000Z",
        },
        progress: { syncedPhoneNumbers: 120 },
      }),
    })

    expect(state.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(state.task?.progress).toEqual({
      pagesCount: 2,
      headerTotal: 900,
      syncedPhoneNumbers: 120,
    })
  })

  it("игнорирует события другой задачи", () => {
    const state = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: event({ taskId: "task_other", status: "error", error: "чужая ошибка" }),
    })
    expect(state.task?.status).toBe("running")
    expect(state.pendingTerminal).toBeNull()
  })

  it("фиксирует терминальный статус для последующего добора данных", () => {
    const state = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 9000,
      event: event({ status: "ready" }),
    })

    expect(state.task?.status).toBe("ready")
    expect(state.pendingTerminal).toEqual({
      taskId: "task_1",
      status: "ready",
      groupName: "АVTOTRAL",
      result: null,
      error: null,
    })
    expect(state.notifiedTerminalTaskIds).toEqual(["task_1"])
  })
})

describe("parserSyncReducer / завершение задачи ровно один раз", () => {
  const base = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  it("не дублирует эффект, когда терминал пришёл и по SSE, и по поллингу", () => {
    const afterSse = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 9000,
      event: { taskId: "task_1", status: "ready", timestamp: "x" },
    })
    expect(afterSse.pendingTerminal?.taskId).toBe("task_1")

    const handled = run(afterSse, { type: "terminal_handled", taskId: "task_1" })
    expect(handled.pendingTerminal).toBeNull()

    const afterPoll = run(handled, {
      type: "poll_success",
      payload: statusPayload({ state: "IDLE", task: task({ status: "ready" }) }),
      seq: 2,
      now: T0 + 10_000,
    })
    expect(afterPoll.pendingTerminal).toBeNull()
  })

  it("терминал по SSE не приносит итогов, но следующий опрос кладёт их в карточку", () => {
    const afterSse = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 9000,
      event: { taskId: "task_1", status: "ready", timestamp: "x" },
    })
    // Событие несёт только статус: чисел в уведомлении быть не может.
    expect(afterSse.pendingTerminal?.result).toBeNull()
    expect(afterSse.task?.result ?? null).toBeNull()

    const collected = {
      group: "АVTOTRAL",
      conversationId: 26,
      pagesCount: 5,
      participantsCount: 900,
      participantsWithPhone: 640,
      savedJsonPath: "a.json",
      savedTxtPath: "a.txt",
    }
    const afterPoll = run(run(afterSse, { type: "terminal_handled", taskId: "task_1" }), {
      type: "poll_success",
      payload: statusPayload({ state: "IDLE", task: task({ status: "ready", result: collected }) }),
      seq: 3,
      now: T0 + 10_000,
    })

    // Уже терминальная задача не «замораживается»: detail с итогами применяется.
    expect(afterPoll.task?.status).toBe("ready")
    expect(afterPoll.task?.result).toEqual(collected)
    expect(afterPoll.pendingTerminal).toBeNull()
  })

  it("ловит завершение по поллингу, если SSE оборвался", () => {
    const state = run(base, {
      type: "poll_success",
      payload: statusPayload({
        state: "IDLE",
        task: task({ status: "ready", result: {
          group: "АVTOTRAL",
          conversationId: 26,
          pagesCount: 5,
          participantsCount: 900,
          participantsWithPhone: 640,
          savedJsonPath: "a.json",
          savedTxtPath: "a.txt",
        } }),
      }),
      seq: 2,
      now: T0 + 10_000,
    })

    expect(state.pendingTerminal?.status).toBe("ready")
    expect(state.pendingTerminal?.result?.participantsCount).toBe(900)
  })

  it("ловит завершение по списку задач, если detail не пришёл", () => {
    const state = run(base, {
      type: "poll_success",
      payload: statusPayload({
        state: "IDLE",
        task: null,
        taskId: "task_1",
        tasks: [{ ...(task({ status: "stopped" }) as TaskSummaryDto) }],
      }),
      seq: 2,
      now: T0 + 10_000,
    })

    expect(state.pendingTerminal?.taskId).toBe("task_1")
    expect(state.pendingTerminal?.status).toBe("stopped")
    // Карточка обязана догнать список: после тоста «выполняется» на экране быть не может.
    expect(state.task?.status).toBe("stopped")
    expect(selectIsTaskRunning(state)).toBe(false)
  })

  it("дотягивает терминальный статус из списка задач в карточку, когда detail не пришёл", () => {
    const state = run(base, {
      type: "poll_success",
      payload: statusPayload({
        state: "IDLE",
        task: null,
        taskId: "task_1",
        currentStep: null,
        tasks: [
          task({ status: "ready", completedAt: "2026-09-09T10:00:20.000Z" }) as TaskSummaryDto,
        ],
      }),
      seq: 2,
      now: T0 + 10_000,
    })

    expect(state.task?.id).toBe("task_1")
    expect(state.task?.status).toBe("ready")
    expect(state.task?.completedAt).toBe("2026-09-09T10:00:20.000Z")
    // Остальное берём из известного detail: список задач шагов и итогов не несёт.
    expect(state.task?.progress?.pagesCount).toBe(2)
    expect(selectIsTaskRunning(state)).toBe(false)
  })

  it("не трогает карточку, пока задача в списке ещё активна", () => {
    const state = run(base, {
      type: "poll_success",
      payload: statusPayload({
        task: null,
        taskId: "task_1",
        tasks: [task({ status: "running" }) as TaskSummaryDto],
      }),
      seq: 2,
      now: T0 + 10_000,
    })

    expect(state.task).toEqual(base.task)
    expect(state.pendingTerminal).toBeNull()
  })

  it("не показывает уведомление для задачи, завершённой до открытия страницы", () => {
    const state = run(initialParserSyncState, {
      type: "poll_success",
      payload: statusPayload({ state: "IDLE", task: task({ status: "ready" }) }),
      seq: 1,
      now: T0,
    })
    expect(state.pendingTerminal).toBeNull()
    expect(state.notifiedTerminalTaskIds).toEqual([])
  })
})

describe("parserSyncReducer / task_started, visibility, reset_view", () => {
  it("оптимистично показывает новую задачу", () => {
    const state = run(initialParserSyncState, {
      type: "task_started",
      taskId: "task_new",
      group: "АVTOTRAL",
      seq: 10,
      now: T0,
    })

    expect(state.task).toEqual({
      id: "task_new",
      groupTarget: "АVTOTRAL",
      groupName: "АVTOTRAL",
      status: "initializing",
      createdAt: new Date(T0).toISOString(),
      currentStep: null,
      progress: null,
      stepHistory: [],
    })
    expect(state.status?.state).toBe("INITIALIZING")
    expect(state.status?.taskId).toBe("task_new")
    expect(selectIsTaskRunning(state)).toBe(true)
  })

  it("устаревший ответ поллинга не затирает только что запущенную задачу", () => {
    const state = run(
      initialParserSyncState,
      { type: "task_started", taskId: "task_new", group: "АVTOTRAL", seq: 10, now: T0 },
      {
        type: "poll_success",
        payload: statusPayload({ state: "IDLE", task: null, taskId: null, tasks: [] }),
        seq: 9,
        now: T0 + 10,
      }
    )
    expect(state.task?.id).toBe("task_new")
  })

  it("reset_view скрывает карточку и не возвращает её следующим поллингом", () => {
    const finished = statusPayload({ state: "IDLE", task: task({ status: "ready" }) })
    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: statusPayload(), seq: 1, now: T0 },
      { type: "poll_success", payload: finished, seq: 2, now: T0 + 2000 },
      { type: "reset_view" },
      { type: "poll_success", payload: finished, seq: 3, now: T0 + 4000 }
    )

    expect(state.task).toBeNull()
    expect(state.tasks).toHaveLength(1)
  })

  it("новая задача снова показывается после reset_view", () => {
    const finished = statusPayload({ state: "IDLE", task: task({ status: "ready" }) })
    const next = statusPayload({ task: task({ id: "task_2", status: "running" }) })
    const state = run(
      initialParserSyncState,
      { type: "poll_success", payload: finished, seq: 1, now: T0 },
      { type: "reset_view" },
      { type: "poll_success", payload: next, seq: 2, now: T0 + 2000 }
    )
    expect(state.task?.id).toBe("task_2")
  })

  it("visibility и sse-флаги пишутся в состояние", () => {
    const state = run(
      initialParserSyncState,
      { type: "visibility", hidden: true },
      { type: "sse_open" }
    )
    expect(state.hidden).toBe(true)
    expect(state.sseConnected).toBe(true)
    expect(run(state, { type: "sse_error" }).sseConnected).toBe(false)
  })
})


describe("parserSyncReducer / потеря задачи после рестарта бэкенда", () => {
  const running = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  const empty = statusPayload({
    state: "IDLE",
    task: null,
    taskId: null,
    tasks: [],
    currentStep: null,
    progress: null,
    groupName: null,
  })

  it("сообщает о потере ровно один раз и не теряет карточку на следующих опросах", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    expect(lost.pendingLostTaskId).toBe("task_1")

    const handled = run(lost, { type: "lost_task_handled", taskId: "task_1" })
    expect(handled.pendingLostTaskId).toBeNull()
    expect(handled.task?.id).toBe("task_1")

    const again = run(
      handled,
      { type: "poll_success", payload: empty, seq: 3, now: T0 + 4000 },
      { type: "poll_success", payload: empty, seq: 4, now: T0 + 6000 }
    )
    expect(again.pendingLostTaskId).toBeNull()
    expect(again.task?.id).toBe("task_1")
    expect(again.lostTaskId).toBe("task_1")
    expect(selectIsTaskRunning(again)).toBe(false)
  })

  it("не считает потерей ответ, где задача есть только в списке", () => {
    const onlySummary = statusPayload({
      state: "RUNNING",
      task: null,
      taskId: "task_1",
      tasks: [task() as TaskSummaryDto],
    })
    const state = run(running, { type: "poll_success", payload: onlySummary, seq: 2, now: T0 + 2000 })
    expect(state.pendingLostTaskId).toBeNull()
    expect(state.lostTaskId).toBeNull()
    expect(state.task?.id).toBe("task_1")
  })

  it("новая задача снимает пометку потери", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    const fresh = run(lost, {
      type: "poll_success",
      payload: statusPayload({ task: task({ id: "task_2" }) }),
      seq: 3,
      now: T0 + 4000,
    })
    expect(fresh.lostTaskId).toBeNull()
    expect(fresh.task?.id).toBe("task_2")
    expect(selectIsTaskRunning(fresh)).toBe(true)
  })

  it("task_started снимает пометку потери", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    const started = run(lost, {
      type: "task_started",
      taskId: "task_2",
      group: "АVTOTRAL",
      seq: 3,
      now: T0 + 4000,
    })
    expect(started.lostTaskId).toBeNull()
    expect(selectIsTaskRunning(started)).toBe(true)
  })

  it("скрытая пользователем карточка не считается потерянной", () => {
    const dismissed = run(running, { type: "reset_view" })
    const state = run(dismissed, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    expect(state.task).toBeNull()
    expect(state.pendingLostTaskId).toBeNull()
  })

  it("вернувшаяся в ответ задача снимает пометку потери", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    expect(lost.lostTaskId).toBe("task_1")
    expect(lost.pendingLostTaskId).toBe("task_1")

    const back = run(lost, {
      type: "poll_success",
      payload: statusPayload(),
      seq: 3,
      now: T0 + 4000,
    })

    expect(back.lostTaskId).toBeNull()
    expect(back.pendingLostTaskId).toBeNull()
    expect(back.task?.id).toBe("task_1")
    expect(selectIsTaskRunning(back)).toBe(true)
  })

  it("вернувшаяся задача снимает пометку и после того, как о потере уже сообщили", () => {
    const handled = run(
      running,
      { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 },
      { type: "lost_task_handled", taskId: "task_1" }
    )
    expect(handled.lostTaskId).toBe("task_1")

    const back = run(handled, {
      type: "poll_success",
      payload: statusPayload({ task: null, taskId: "task_1", tasks: [task() as TaskSummaryDto] }),
      seq: 3,
      now: T0 + 4000,
    })

    expect(back.lostTaskId).toBeNull()
    expect(selectIsTaskRunning(back)).toBe(true)
  })

  it("не считает потерянной оптимистичную задачу, которую бэкенд ещё не подтверждал", () => {
    const started = run(initialParserSyncState, {
      type: "task_started",
      taskId: "task_new",
      group: "АVTOTRAL",
      seq: 1,
      now: T0,
    })

    // Один пустой успешный ответ — это гонка со стартом, а не рестарт бэкенда.
    const state = run(started, { type: "poll_success", payload: empty, seq: 2, now: T0 + 500 })

    expect(state.pendingLostTaskId).toBeNull()
    expect(state.lostTaskId).toBeNull()
    expect(state.task?.id).toBe("task_new")
    expect(selectIsTaskRunning(state)).toBe(true)
  })

  it("подтверждённая бэкендом оптимистичная задача снова детектится как потерянная", () => {
    const confirmed = run(
      initialParserSyncState,
      { type: "task_started", taskId: "task_1", group: "АVTOTRAL", seq: 1, now: T0 },
      { type: "poll_success", payload: statusPayload(), seq: 2, now: T0 + 2000 }
    )

    const state = run(confirmed, { type: "poll_success", payload: empty, seq: 3, now: T0 + 4000 })

    expect(state.pendingLostTaskId).toBe("task_1")
    expect(state.lostTaskId).toBe("task_1")
    expect(selectIsTaskRunning(state)).toBe(false)
  })
})

describe("parserSyncReducer / seq у sse_event", () => {
  const base = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  const stepEvent: TaskEvent = {
    taskId: "task_1",
    status: "running",
    timestamp: "2026-09-09T10:00:05.000Z",
    step: {
      step: "waiting_numbers_sync",
      description: "Ожидание синка",
      startedAt: "2026-09-09T10:00:05.000Z",
    },
    progress: { syncedPhoneNumbers: 120 },
  }

  it("ответ поллинга со старым seq не откатывает шаг после sse_event", () => {
    const afterSse = run(base, {
      type: "sse_event",
      seq: 3,
      now: T0 + 5000,
      event: stepEvent,
    })
    expect(afterSse.lastEventSeq).toBe(3)

    // Поллинг стартовал до события (seq 2), а ответ приехал позже — шаг он не откатывает.
    const afterStalePoll = run(afterSse, {
      type: "poll_success",
      payload: statusPayload(),
      seq: 2,
      now: T0 + 6000,
    })
    expect(afterStalePoll.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(afterStalePoll.task?.progress?.syncedPhoneNumbers).toBe(120)
  })

  it("ответ поллинга после события обновляет историю и связь, не трогая шаг", () => {
    const failed = run(base, {
      type: "poll_failure",
      error: "Бэкенд Viber недоступен",
      seq: 2,
      now: T0 + 1000,
    })
    expect(failed.consecutiveFailures).toBe(1)

    const afterSse = run(failed, { type: "sse_event", seq: 4, now: T0 + 5000, event: stepEvent })

    // Опрос стартовал до события (seq 3), но принёс историю задач и итоги шагов.
    const history = [
      { step: "resolving_group", description: "Поиск группы", startedAt: "x", durationMs: 1200 },
    ]
    const state = run(afterSse, {
      type: "poll_success",
      payload: statusPayload({
        task: task({ stepHistory: history }),
        tasks: [
          task() as TaskSummaryDto,
          task({ id: "task_0", status: "ready" }) as TaskSummaryDto,
        ],
      }),
      seq: 3,
      now: T0 + 6000,
    })

    expect(state.tasks).toHaveLength(2)
    expect(state.task?.stepHistory).toEqual(history)
    expect(state.lastSuccessAt).toBe(T0 + 6000)
    expect(state.consecutiveFailures).toBe(0)
    expect(state.lastError).toBeNull()
    expect(state.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(state.task?.progress?.syncedPhoneNumbers).toBe(120)
    expect(state.status?.currentStep).toBe("waiting_numbers_sync")
  })

  it("терминальный ответ поллинга после события применяется целиком", () => {
    const afterSse = run(base, { type: "sse_event", seq: 4, now: T0 + 5000, event: stepEvent })

    const collected = {
      group: "АVTOTRAL",
      conversationId: 26,
      pagesCount: 5,
      participantsCount: 900,
      participantsWithPhone: 640,
      savedJsonPath: "a.json",
      savedTxtPath: "a.txt",
    }
    const state = run(afterSse, {
      type: "poll_success",
      payload: statusPayload({
        state: "IDLE",
        task: task({ status: "ready", result: collected }),
        currentStep: null,
      }),
      seq: 3,
      now: T0 + 6000,
    })

    expect(state.task?.status).toBe("ready")
    expect(state.task?.result).toEqual(collected)
    expect(state.pendingTerminal?.taskId).toBe("task_1")
    expect(state.pendingTerminal?.result?.participantsCount).toBe(900)
    expect(selectIsTaskRunning(state)).toBe(false)
  })

  it("ошибка опроса не блокируется номером sse-события", () => {
    const afterSse = run(base, { type: "sse_event", seq: 4, now: T0 + 5000, event: stepEvent })
    const state = run(afterSse, {
      type: "poll_failure",
      error: "Бэкенд Viber недоступен",
      seq: 3,
      now: T0 + 6000,
    })

    expect(state.consecutiveFailures).toBe(1)
    expect(state.lastError).toBe("Бэкенд Viber недоступен")
    expect(state.task?.currentStep?.step).toBe("waiting_numbers_sync")
  })
})

describe("parserSyncReducer / sse_event без detail", () => {
  const withoutDetail = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload({ task: null, taskId: "task_1", tasks: [task() as TaskSummaryDto] }),
    seq: 1,
    now: T0,
  })

  it("мержит событие, когда detail не доехал, но статус знает taskId", () => {
    expect(withoutDetail.task).toBeNull()

    const state = run(withoutDetail, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: {
        taskId: "task_1",
        status: "running",
        timestamp: "2026-09-09T10:00:05.000Z",
        step: {
          step: "waiting_numbers_sync",
          description: "Ожидание синка",
          startedAt: "2026-09-09T10:00:05.000Z",
        },
        progress: { syncedPhoneNumbers: 7 },
      },
    })

    expect(state.task?.id).toBe("task_1")
    expect(state.task?.stepHistory).toEqual([])
    expect(state.task?.currentStep?.step).toBe("waiting_numbers_sync")
    expect(state.task?.progress?.syncedPhoneNumbers).toBe(7)
    expect(selectIsTaskRunning(state)).toBe(true)
  })

  it("терминальное событие без detail отдаёт побочный эффект завершения", () => {
    const state = run(withoutDetail, {
      type: "sse_event",
      seq: 2,
      now: T0 + 9000,
      event: { taskId: "task_1", status: "ready", timestamp: "2026-09-09T10:00:09.000Z" },
    })

    expect(state.pendingTerminal?.taskId).toBe("task_1")
    expect(state.pendingTerminal?.status).toBe("ready")
    expect(selectIsTaskRunning(state)).toBe(false)
  })

  it("игнорирует событие чужой задачи, когда detail не доехал", () => {
    const state = run(withoutDetail, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: { taskId: "task_other", status: "error", timestamp: "x" },
    })
    expect(state.task).toBeNull()
    expect(state.pendingTerminal).toBeNull()
  })

  it("не воскрешает завершённую задачу", () => {
    const idle = run(initialParserSyncState, {
      type: "poll_success",
      payload: statusPayload({
        state: "IDLE",
        task: null,
        taskId: "task_1",
        tasks: [task({ status: "ready" }) as TaskSummaryDto],
      }),
      seq: 1,
      now: T0,
    })

    const state = run(idle, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: { taskId: "task_1", status: "running", timestamp: "x" },
    })
    expect(state.task).toBeNull()
  })
})

describe("parserSyncReducer / предохранитель для неподтверждённой задачи", () => {
  const empty = statusPayload({
    state: "IDLE",
    task: null,
    taskId: null,
    tasks: [],
    currentStep: null,
    progress: null,
    groupName: null,
  })

  it("держит неподтверждённую задачу три пустых ответа и только потом объявляет потерянной", () => {
    // Бэкенд упал сразу после старта: подтверждения задачи не было ни разу.
    const started = run(initialParserSyncState, {
      type: "task_started",
      taskId: "task_new",
      group: "АVTOTRAL",
      seq: 1,
      now: T0,
    })
    const afterFailures = run(
      started,
      { type: "poll_failure", error: "Бэкенд Viber недоступен", seq: 2, now: T0 + 2000 },
      { type: "poll_failure", error: "Бэкенд Viber недоступен", seq: 3, now: T0 + 4000 },
      { type: "poll_failure", error: "Бэкенд Viber недоступен", seq: 4, now: T0 + 6000 }
    )

    const first = run(afterFailures, { type: "poll_success", payload: empty, seq: 5, now: T0 + 8000 })
    expect(first.lostTaskId).toBeNull()
    expect(first.pendingLostTaskId).toBeNull()
    expect(selectIsTaskRunning(first)).toBe(true)

    const second = run(first, { type: "poll_success", payload: empty, seq: 6, now: T0 + 10_000 })
    expect(second.lostTaskId).toBeNull()
    expect(second.pendingLostTaskId).toBeNull()
    expect(selectIsTaskRunning(second)).toBe(true)

    // Три пустых ответа подряд — старт уже не мог не долететь: задача потеряна.
    const third = run(second, { type: "poll_success", payload: empty, seq: 7, now: T0 + 12_000 })
    expect(third.task?.id).toBe("task_new")
    expect(third.lostTaskId).toBe("task_new")
    expect(third.pendingLostTaskId).toBe("task_new")
    expect(selectIsTaskRunning(third)).toBe(false)
  })

  it("счётчик пропусков обнуляется, когда задача снова появилась в ответе", () => {
    const started = run(initialParserSyncState, {
      type: "task_started",
      taskId: "task_1",
      group: "АVTOTRAL",
      seq: 1,
      now: T0,
    })
    const twoMisses = run(
      started,
      { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 },
      { type: "poll_success", payload: empty, seq: 3, now: T0 + 4000 }
    )
    expect(twoMisses.pendingLostTaskId).toBeNull()

    const confirmed = run(twoMisses, {
      type: "poll_success",
      payload: statusPayload({ task: null, taskId: "task_1", tasks: [task() as TaskSummaryDto] }),
      seq: 4,
      now: T0 + 6000,
    })
    expect(confirmed.pendingLostTaskId).toBeNull()
    expect(confirmed.lostTaskId).toBeNull()

    // Подтверждённая задача теряется уже с первого пропуска — допуск не накапливается.
    const lost = run(confirmed, { type: "poll_success", payload: empty, seq: 5, now: T0 + 8000 })
    expect(lost.lostTaskId).toBe("task_1")
    expect(lost.pendingLostTaskId).toBe("task_1")
  })
})

describe("parserSyncReducer / терминальный статус не откатывается поллингом", () => {
  const base = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })

  it("свежий ответ с running не воскрешает остановленную задачу", () => {
    const stopped = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: { taskId: "task_1", status: "stopped", timestamp: "2026-09-09T10:00:05.000Z" },
    })
    expect(stopped.task?.status).toBe("stopped")

    // Ответ стартовал позже события (seq больше), но несёт кэш бэкенда с прошлым «running».
    const afterPoll = run(stopped, {
      type: "poll_success",
      payload: statusPayload({ task: task({ status: "running" }) }),
      seq: 3,
      now: T0 + 6000,
    })

    expect(afterPoll.task?.status).toBe("stopped")
    expect(selectIsTaskRunning(afterPoll)).toBe(false)
  })

  it("итоги из свежего ответа доезжают, статус остаётся терминальным", () => {
    const collected = {
      group: "АVTOTRAL",
      conversationId: 26,
      pagesCount: 5,
      participantsCount: 900,
      participantsWithPhone: 640,
      savedJsonPath: "a.json",
      savedTxtPath: "a.txt",
    }
    const stopped = run(base, {
      type: "sse_event",
      seq: 2,
      now: T0 + 5000,
      event: { taskId: "task_1", status: "stopped", timestamp: "2026-09-09T10:00:05.000Z" },
    })
    const afterPoll = run(stopped, {
      type: "poll_success",
      payload: statusPayload({ task: task({ status: "running", result: collected }) }),
      seq: 3,
      now: T0 + 6000,
    })

    expect(afterPoll.task?.status).toBe("stopped")
    expect(afterPoll.task?.result).toEqual(collected)
  })
})

describe("parserSyncReducer / sse_event снимает пометку потери", () => {
  const running = run(initialParserSyncState, {
    type: "poll_success",
    payload: statusPayload(),
    seq: 1,
    now: T0,
  })
  const empty = statusPayload({
    state: "IDLE",
    task: null,
    taskId: null,
    tasks: [],
    currentStep: null,
    progress: null,
    groupName: null,
  })

  it("событие по потерянной задаче возвращает её в работу", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    expect(lost.lostTaskId).toBe("task_1")
    expect(lost.pendingLostTaskId).toBe("task_1")

    const revived = run(lost, {
      type: "sse_event",
      seq: 3,
      now: T0 + 4000,
      event: { taskId: "task_1", status: "running", timestamp: "2026-09-09T10:00:04.000Z" },
    })

    expect(revived.lostTaskId).toBeNull()
    expect(revived.pendingLostTaskId).toBeNull()
    expect(revived.taskConfirmedByUpstream).toBe(true)
    expect(selectIsTaskRunning(revived)).toBe(true)
  })

  it("событие чужой задачи пометку потери не трогает", () => {
    const lost = run(running, { type: "poll_success", payload: empty, seq: 2, now: T0 + 2000 })
    const other = run(lost, {
      type: "sse_event",
      seq: 3,
      now: T0 + 4000,
      event: { taskId: "task_other", status: "running", timestamp: "2026-09-09T10:00:04.000Z" },
    })

    expect(other.lostTaskId).toBe("task_1")
    expect(other.pendingLostTaskId).toBe("task_1")
  })
})
