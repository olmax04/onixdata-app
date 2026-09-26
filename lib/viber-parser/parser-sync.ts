import type {
  ParserConnectionState,
  TaskCollectionResultDto,
  TaskDetailDto,
  TaskEvent,
  TaskProgress,
  TaskStatus,
  TaskSummaryDto,
  ViberParserStatus,
} from "@/lib/viber-parser/types"

/** Сколько ошибок подряд считаем потерей связи. */
export const OFFLINE_FAILURE_THRESHOLD = 3
/** Сколько миллисекунд без успешного ответа считаем потерей связи. */
export const OFFLINE_STALE_MS = 12_000
/** Подтверждённая задача пропала из ответа — это уже рестарт бэкенда, ждать нечего. */
export const LOST_TASK_MISSING_POLLS = 1
/**
 * Неподтверждённой задаче даём фору: бэкенд мог упасть до первого успешного ответа,
 * и тогда единственный «пустой» успех — гонка со стартом. Но если задачи нет и после
 * нескольких успешных ответов подряд, её больше нет ни у кого.
 */
export const LOST_TASK_MISSING_POLLS_UNCONFIRMED = 3

const ACTIVE_STATUSES: TaskStatus[] = ["initializing", "starting", "running"]
const TERMINAL_STATUSES: TaskStatus[] = ["ready", "stopped", "error"]

export function isActiveTaskStatus(status: TaskStatus | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.includes(status)
}

export function isTerminalTaskStatus(status: TaskStatus | null | undefined): boolean {
  return !!status && TERMINAL_STATUSES.includes(status)
}

export interface TerminalTaskInfo {
  taskId: string
  status: TaskStatus
  groupName: string | null
  result: TaskCollectionResultDto | null
  error: string | null
}

export interface ParserSyncState {
  status: ViberParserStatus | null
  task: TaskDetailDto | null
  tasks: TaskSummaryDto[]
  /** Номер последнего применённого ответа поллинга: защищает от гонок параллельных запросов. */
  lastPollSeq: number
  /**
   * Номер последнего применённого SSE-события. Считается отдельно от поллинга: ответ,
   * стартовавший до события, обязан донести историю и связь, но не откатить шаг.
   */
  lastEventSeq: number
  lastSuccessAt: number | null
  consecutiveFailures: number
  lastError: string | null
  hidden: boolean
  sseConnected: boolean
  /** Задача, карточку которой пользователь скрыл вручную. */
  dismissedTaskId: string | null
  /** Завершение, побочные эффекты которого ещё не отработаны. */
  pendingTerminal: TerminalTaskInfo | null
  notifiedTerminalTaskIds: string[]
  /**
   * Активная задача, которая пропала из успешного ответа бэкенда (обычно — рестарт
   * процесса Nest, задачи живут в памяти). Карточка остаётся на экране, но задача
   * больше не считается выполняющейся.
   */
  lostTaskId: string | null
  /** Потеря задачи, о которой ещё не сообщили пользователю. */
  pendingLostTaskId: string | null
  /**
   * Бэкенд хотя бы раз подтвердил текущую задачу. Пока подтверждения нет, задача известна
   * только из оптимистичного `task_started`, и пустой ответ — гонка со стартом, не потеря.
   */
  taskConfirmedByUpstream: boolean
  /**
   * Сколько успешных ответов подряд пришло без текущей задачи. Без счётчика
   * неподтверждённая задача, стартовавшая перед падением бэкенда, зависала бы
   * «выполняющейся» навсегда: подтверждения ей уже неоткуда взяться.
   */
  missingPollCount: number
}

export type ParserSyncAction =
  | { type: "poll_success"; payload: ViberParserStatus; seq: number; now: number }
  | { type: "poll_failure"; error: string; seq: number; now: number }
  | { type: "sse_event"; event: TaskEvent; seq: number; now: number }
  | { type: "sse_open" }
  | { type: "sse_error" }
  | { type: "task_started"; taskId: string; group: string; seq: number; now: number }
  | { type: "visibility"; hidden: boolean }
  | { type: "reset_view" }
  | { type: "terminal_handled"; taskId: string }
  | { type: "lost_task_handled"; taskId: string }

export const initialParserSyncState: ParserSyncState = {
  status: null,
  task: null,
  tasks: [],
  lastPollSeq: 0,
  lastEventSeq: 0,
  lastSuccessAt: null,
  consecutiveFailures: 0,
  lastError: null,
  hidden: false,
  sseConnected: false,
  dismissedTaskId: null,
  pendingTerminal: null,
  notifiedTerminalTaskIds: [],
  lostTaskId: null,
  pendingLostTaskId: null,
  taskConfirmedByUpstream: false,
  missingPollCount: 0,
}

function terminalInfoFrom(
  task: TaskDetailDto | TaskSummaryDto,
  detail: TaskDetailDto | null
): TerminalTaskInfo {
  return {
    taskId: task.id,
    status: task.status,
    groupName: task.groupName || task.groupTarget || null,
    result: detail?.result ?? (task as TaskDetailDto).result ?? null,
    error: detail?.error ?? (task as TaskDetailDto).error ?? null,
  }
}

/**
 * Побочные эффекты завершения выполняются ровно один раз на задачу — неважно,
 * пришёл переход по SSE или его увидел поллинг после обрыва потока.
 */
function withTerminal(
  state: ParserSyncState,
  next: ParserSyncState,
  previousTask: TaskDetailDto | null,
  candidate: TaskDetailDto | TaskSummaryDto | null,
  detail: TaskDetailDto | null
): ParserSyncState {
  if (!candidate || !isTerminalTaskStatus(candidate.status)) return next
  if (!previousTask || previousTask.id !== candidate.id) return next
  if (!isActiveTaskStatus(previousTask.status)) return next
  if (state.notifiedTerminalTaskIds.includes(candidate.id)) return next

  return {
    ...next,
    pendingTerminal: terminalInfoFrom(candidate, detail),
    notifiedTerminalTaskIds: [...state.notifiedTerminalTaskIds, candidate.id].slice(-20),
  }
}

function reducePollSuccess(
  state: ParserSyncState,
  action: Extract<ParserSyncAction, { type: "poll_success" }>
): ParserSyncState {
  if (action.seq <= state.lastPollSeq) return state

  const payload = action.payload
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
  const previousTask = state.task

  const knownUpstream = (taskId: string) =>
    payload.task?.id === taskId ||
    payload.taskId === taskId ||
    tasks.some((item) => item.id === taskId)

  let task: TaskDetailDto | null
  if (payload.task) {
    task = payload.task
  } else if (payload.taskId && previousTask && previousTask.id === payload.taskId) {
    // detail не доехал — оставляем то, что уже знаем, иначе панель «схлопнется».
    task = previousTask

    // Но завершение из списка задач подхватываем: иначе после тоста о готовности
    // карточка так и висела бы «выполняется», пока не доедет detail.
    const summary = tasks.find((item) => item.id === payload.taskId)
    if (
      summary &&
      isTerminalTaskStatus(summary.status) &&
      !isTerminalTaskStatus(previousTask.status)
    ) {
      task = {
        ...previousTask,
        status: summary.status,
        completedAt: summary.completedAt ?? previousTask.completedAt ?? null,
        error: (summary as TaskDetailDto).error ?? previousTask.error ?? null,
      }
    }
  } else {
    task = null
  }

  // Успешный ответ, в котором активной задачи больше нет — бэкенд перезапустился
  // и потерял и задачу, и историю. Молча гасить карточку нельзя.
  let lostTaskId = state.lostTaskId
  let pendingLostTaskId = state.pendingLostTaskId
  const previousKnownUpstream = !!previousTask && knownUpstream(previousTask.id)
  const missingPollCount =
    !previousTask || previousKnownUpstream ? 0 : state.missingPollCount + 1

  if (previousKnownUpstream) {
    // Задача снова в ответе бэкенда: потери нет, а прошлую пометку надо снять —
    // иначе живая карточка навсегда останется «потерянной».
    lostTaskId = null
    pendingLostTaskId = null
  } else if (previousTask && isActiveTaskStatus(previousTask.status)) {
    // Подтверждённой задаче хватает одного пропуска, неподтверждённой даём фору:
    // её мог не успеть увидеть бэкенд, но вечно ждать подтверждения нельзя.
    const threshold = state.taskConfirmedByUpstream
      ? LOST_TASK_MISSING_POLLS
      : LOST_TASK_MISSING_POLLS_UNCONFIRMED

    if (missingPollCount >= threshold) {
      if (lostTaskId !== previousTask.id) {
        pendingLostTaskId = previousTask.id
      }
      // Показывать нечего — оставляем карточку последней задачи, но уже не как выполняющуюся.
      if (!task) {
        task = previousTask
        lostTaskId = previousTask.id
      }
    } else if (!task) {
      // Пропусков ещё мало: это гонка со стартом, а не рестарт процесса.
      task = previousTask
    }
  }

  let dismissedTaskId = state.dismissedTaskId
  if (task && dismissedTaskId) {
    if (task.id === dismissedTaskId) {
      task = null
    } else {
      dismissedTaskId = null
    }
  }

  if (!task || task.id !== lostTaskId) {
    lostTaskId = null
  }

  // Опрос мог стартовать раньше SSE-события, а ответ приехать позже. История задач,
  // итоги шагов и состояние связи в нём свежие, а вот шаг, прогресс и статус уже
  // устарели — их владелец поток событий. Терминальный ответ применяется целиком:
  // завершение задачи поллинг видит раньше, чем поток успевает закрыться.
  let keepSseFields = false
  if (task && previousTask && task.id === previousTask.id) {
    const terminalArrived =
      isTerminalTaskStatus(task.status) && !isTerminalTaskStatus(previousTask.status)
    // Завершение необратимо: ответ бэкенда с прежним «running» — это его кэш, а не
    // рестарт задачи. Такой откат не зависит от номеров: он неверен при любом seq.
    const terminalRollback =
      isTerminalTaskStatus(previousTask.status) && !isTerminalTaskStatus(task.status)

    keepSseFields = (state.lastEventSeq > action.seq && !terminalArrived) || terminalRollback
  }

  if (keepSseFields && task && previousTask && task !== previousTask) {
    task = {
      ...task,
      status: previousTask.status,
      currentStep: previousTask.currentStep ?? null,
      progress: previousTask.progress ?? null,
    }
  }

  const status: ViberParserStatus =
    keepSseFields && state.status
      ? {
          ...payload,
          state: state.status.state,
          currentStep: state.status.currentStep,
          progress: state.status.progress,
        }
      : payload

  const next: ParserSyncState = {
    ...state,
    status,
    task,
    tasks,
    dismissedTaskId,
    lostTaskId,
    pendingLostTaskId,
    taskConfirmedByUpstream: task
      ? knownUpstream(task.id) ||
        (previousTask?.id === task.id && state.taskConfirmedByUpstream)
      : false,
    missingPollCount,
    lastPollSeq: action.seq,
    lastSuccessAt: action.now,
    consecutiveFailures: 0,
    lastError: null,
  }

  const summaryCandidate =
    payload.task ?? (previousTask ? tasks.find((item) => item.id === previousTask.id) ?? null : null)

  return withTerminal(state, next, previousTask, summaryCandidate, payload.task)
}

function reducePollFailure(
  state: ParserSyncState,
  action: Extract<ParserSyncAction, { type: "poll_failure" }>
): ParserSyncState {
  // Номер SSE-события ошибку опроса не блокирует: связь — зона ответственности поллинга.
  if (action.seq <= state.lastPollSeq) return state

  // Ничего не сбрасываем: статус, задача, история и участники остаются на экране.
  return {
    ...state,
    lastPollSeq: action.seq,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastError: action.error,
  }
}

/**
 * Прокси отдаёт `task: null`, если detail задачи не доехал. Событие про эту задачу
 * терять нельзя: строим минимальный detail, чтобы шаги, прогресс и терминал сработали.
 */
function synthesizeTaskFromStatus(
  state: ParserSyncState,
  action: Extract<ParserSyncAction, { type: "sse_event" }>
): TaskDetailDto | null {
  const status = state.status
  if (!status || status.taskId !== action.event.taskId) return null

  const baseStatus: TaskStatus | null =
    status.state === "RUNNING" ? "running" : status.state === "INITIALIZING" ? "initializing" : null
  if (!baseStatus) return null

  return {
    id: action.event.taskId,
    groupTarget: status.groupName ?? action.event.taskId,
    groupName: status.groupName ?? null,
    status: baseStatus,
    createdAt: action.event.timestamp || new Date(action.now).toISOString(),
    currentStep: null,
    progress: status.progress ?? null,
    stepHistory: [],
  }
}

function reduceSseEvent(
  state: ParserSyncState,
  action: Extract<ParserSyncAction, { type: "sse_event" }>
): ParserSyncState {
  const current =
    state.task && state.task.id === action.event.taskId
      ? state.task
      : state.task
        ? null
        : synthesizeTaskFromStatus(state, action)
  if (!current) return state

  const event = action.event
  const progress: TaskProgress | null = event.progress
    ? { ...(current.progress ?? {}), ...event.progress }
    : current.progress ?? null

  const task: TaskDetailDto = {
    ...current,
    status: event.status ?? current.status,
    currentStep: event.step ?? current.currentStep ?? null,
    progress,
    error: event.error ?? current.error ?? null,
  }

  const next: ParserSyncState = {
    ...state,
    task,
    lastEventSeq: Math.max(state.lastEventSeq, action.seq),
    // Поток событий идёт от бэкенда: раз событие про эту задачу пришло, она подтверждена,
    // а прошлая пометка потери снимается — задача жива и работает.
    taskConfirmedByUpstream: true,
    lostTaskId: state.lostTaskId === current.id ? null : state.lostTaskId,
    pendingLostTaskId:
      state.pendingLostTaskId === current.id ? null : state.pendingLostTaskId,
    status: state.status
      ? {
          ...state.status,
          state:
            task.status === "running"
              ? "RUNNING"
              : task.status === "initializing" || task.status === "starting"
                ? "INITIALIZING"
                : task.status === "error"
                  ? "ERROR"
                  : "IDLE",
          currentStep: task.currentStep?.step ?? state.status.currentStep,
          progress,
        }
      : state.status,
  }

  return withTerminal(state, next, current, task, task)
}

function reduceTaskStarted(
  state: ParserSyncState,
  action: Extract<ParserSyncAction, { type: "task_started" }>
): ParserSyncState {
  const task: TaskDetailDto = {
    id: action.taskId,
    groupTarget: action.group,
    groupName: action.group,
    status: "initializing",
    createdAt: new Date(action.now).toISOString(),
    currentStep: null,
    progress: null,
    stepHistory: [],
  }

  const status: ViberParserStatus = {
    ...(state.status ?? {
      isDriverActive: true,
      tasks: state.tasks,
      fetchedAt: new Date(action.now).toISOString(),
    } as ViberParserStatus),
    state: "INITIALIZING",
    isDriverActive: true,
    taskId: action.taskId,
    task,
    currentStep: null,
    progress: null,
    groupName: action.group,
  }

  return {
    ...state,
    status,
    task,
    dismissedTaskId: null,
    lostTaskId: null,
    // Задача пока существует только у нас: потерянной её объявлять нельзя, пока
    // бэкенд не покажет её хотя бы в одном ответе.
    taskConfirmedByUpstream: false,
    missingPollCount: 0,
    lastPollSeq: Math.max(state.lastPollSeq, action.seq),
  }
}

export function parserSyncReducer(
  state: ParserSyncState,
  action: ParserSyncAction
): ParserSyncState {
  switch (action.type) {
    case "poll_success":
      return reducePollSuccess(state, action)
    case "poll_failure":
      return reducePollFailure(state, action)
    case "sse_event":
      return reduceSseEvent(state, action)
    case "sse_open":
      return state.sseConnected ? state : { ...state, sseConnected: true }
    case "sse_error":
      return state.sseConnected ? { ...state, sseConnected: false } : state
    case "task_started":
      return reduceTaskStarted(state, action)
    case "visibility":
      return state.hidden === action.hidden ? state : { ...state, hidden: action.hidden }
    case "reset_view":
      return state.task
        ? {
            ...state,
            dismissedTaskId: state.task.id,
            task: null,
            lostTaskId: null,
            taskConfirmedByUpstream: false,
            missingPollCount: 0,
          }
        : state
    case "terminal_handled":
      return state.pendingTerminal?.taskId === action.taskId
        ? { ...state, pendingTerminal: null }
        : state
    case "lost_task_handled":
      return state.pendingLostTaskId === action.taskId
        ? { ...state, pendingLostTaskId: null }
        : state
    default:
      return state
  }
}

/** Карточка задачи осталась на экране, но бэкенд про эту задачу больше ничего не знает. */
export function selectIsTaskLost(state: ParserSyncState): boolean {
  return !!state.task && state.lostTaskId === state.task.id
}

export function selectIsTaskRunning(state: ParserSyncState): boolean {
  if (selectIsTaskLost(state)) return false
  if (state.task) return isActiveTaskStatus(state.task.status)
  if (!state.status) return false
  return (
    !!state.status.taskId &&
    (state.status.state === "RUNNING" || state.status.state === "INITIALIZING")
  )
}

export function selectConnectionState(
  state: ParserSyncState,
  now: number
): ParserConnectionState {
  if (state.consecutiveFailures === 0) return "online"
  if (state.consecutiveFailures >= OFFLINE_FAILURE_THRESHOLD) return "offline"
  if (state.lastSuccessAt !== null && now - state.lastSuccessAt > OFFLINE_STALE_MS) return "offline"
  return "reconnecting"
}

export function selectActiveStepName(state: ParserSyncState): string | null {
  return state.task?.currentStep?.step ?? state.status?.currentStep ?? null
}
