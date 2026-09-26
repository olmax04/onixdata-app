import type {
  TaskDetailDto,
  TaskProgress,
  TaskStatus,
  TaskStepDto,
} from "@/lib/viber-parser/types"

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["ready", "error", "stopped"]

export function isTerminalTaskStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status)
}

/** Имя шага из строки, из TaskStepDto или из записи истории. */
export function extractStepName(step: unknown): string {
  if (!step) return ""
  if (typeof step === "string") return step
  if (typeof step === "object" && step !== null && "step" in step) {
    return String((step as { step: unknown }).step ?? "")
  }
  return ""
}

export function extractStepDescription(step: unknown): string {
  if (!step || typeof step !== "object") return ""
  if (!("description" in step)) return ""
  const value = (step as { description: unknown }).description
  return value === null || value === undefined ? "" : String(value)
}

export type StepViewState = "pending" | "current" | "completed" | "error" | "stopped"

export interface StepView {
  step: string
  description: string
  startedAt: string | null
  /** Суммарная длительность всех прохождений шага (шаг может повторяться). */
  durationMs: number | null
  /** Сколько раз шаг встречался в истории. */
  occurrences: number
  state: StepViewState
}

export interface StepTimeline {
  byStep: Record<string, StepView>
  /** Шаги в порядке первого прохождения. */
  visitedSteps: string[]
  currentStep: string | null
  isTerminal: boolean
}

export type TaskProgressSource = Pick<TaskDetailDto, "status" | "stepHistory" | "currentStep">

/**
 * Собирает состояние всех этапов задачи из stepHistory + currentStep.
 *
 * Бэкенд кладёт шаг в stepHistory только когда шаг закончился, поэтому
 * «есть в истории» == «пройден». Шаги могут повторяться (exporting_results
 * выполняется дважды) — длительности повторов суммируются.
 */
export function buildStepTimeline(
  detail: TaskProgressSource | null | undefined,
  fallbackCurrentStep?: string | null
): StepTimeline {
  const byStep: Record<string, StepView> = {}
  const visitedSteps: string[] = []
  const status = detail?.status ?? null
  const isTerminal = isTerminalTaskStatus(status)

  const history = Array.isArray(detail?.stepHistory) ? (detail?.stepHistory as TaskStepDto[]) : []

  for (const entry of history) {
    const name = extractStepName(entry?.step ?? entry)
    if (!name) continue

    const duration = typeof entry?.durationMs === "number" ? entry.durationMs : null
    const existing = byStep[name]

    if (!existing) {
      visitedSteps.push(name)
      byStep[name] = {
        step: name,
        description: extractStepDescription(entry),
        startedAt: entry?.startedAt ?? null,
        durationMs: duration,
        occurrences: 1,
        state: "completed",
      }
      continue
    }

    existing.occurrences += 1
    if (duration !== null) {
      existing.durationMs = (existing.durationMs ?? 0) + duration
    }
    const description = extractStepDescription(entry)
    if (description) existing.description = description
  }

  const detailCurrent = extractStepName(detail?.currentStep)
  const currentStep = isTerminal ? "" : detailCurrent || (fallbackCurrentStep ?? "")

  if (currentStep) {
    const existing = byStep[currentStep]
    if (existing) {
      existing.state = "current"
    } else {
      visitedSteps.push(currentStep)
      byStep[currentStep] = {
        step: currentStep,
        description: extractStepDescription(detail?.currentStep),
        startedAt:
          detail?.currentStep && typeof detail.currentStep === "object"
            ? (detail.currentStep.startedAt ?? null)
            : null,
        durationMs: null,
        occurrences: 0,
        state: "current",
      }
    }
  }

  // Прерванный или упавший шаг бэкенд тоже кладёт в историю, но отмечать его
  // «пройденным» нечестно: показываем, на чём именно всё оборвалось.
  if (status === "error" || status === "stopped") {
    const lastStep = detailCurrent || visitedSteps[visitedSteps.length - 1] || ""
    const interruptedState: StepViewState = status === "error" ? "error" : "stopped"
    const interrupted = lastStep ? byStep[lastStep] : undefined

    if (interrupted) {
      interrupted.state = interruptedState
    } else if (lastStep) {
      // Шаг оборвался, не успев попасть в историю — всё равно показываем, где встали
      visitedSteps.push(lastStep)
      byStep[lastStep] = {
        step: lastStep,
        description: extractStepDescription(detail?.currentStep),
        startedAt:
          detail?.currentStep && typeof detail.currentStep === "object"
            ? (detail.currentStep.startedAt ?? null)
            : null,
        durationMs: null,
        occurrences: 0,
        state: interruptedState,
      }
    }
  }

  return {
    byStep,
    visitedSteps,
    currentStep: currentStep || null,
    isTerminal,
  }
}

function stepStartedMs(step: TaskDetailDto["currentStep"]): number {
  const parsed = Date.parse(asStepDto(step)?.startedAt ?? "")
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Выбирает более полный снимок задачи.
 *
 * Ответы опроса, SSE и «дотягивания» финального состояния могут приходить
 * не по порядку — более старый снимок не должен затирать более свежий.
 *
 * `expectedTaskId` защищает от позднего ответа по уже неактуальной задаче:
 * пока летел запрос по задаче A, пользователь мог запустить задачу B.
 */
export function mergeTaskDetail(
  prev: TaskDetailDto | null,
  next: TaskDetailDto | null,
  expectedTaskId?: string | null
): TaskDetailDto | null {
  if (!next) return prev
  if (expectedTaskId && next.id !== expectedTaskId) return prev
  if (!prev || prev.id !== next.id) return next

  const prevTerminal = isTerminalTaskStatus(prev.status)
  const nextTerminal = isTerminalTaskStatus(next.status)
  if (prevTerminal && !nextTerminal) return prev

  const prevSteps = prev.stepHistory?.length ?? 0
  const nextSteps = next.stepHistory?.length ?? 0
  if (nextSteps < prevSteps && prevTerminal === nextTerminal) return prev

  // Равная полнота, но текущий шаг у нового снимка старее — это отставший ответ
  if (prevTerminal === nextTerminal && prevSteps === nextSteps) {
    const prevStarted = stepStartedMs(prev.currentStep)
    const nextStarted = stepStartedMs(next.currentStep)
    if (!Number.isNaN(prevStarted) && !Number.isNaN(nextStarted) && nextStarted < prevStarted) {
      return prev
    }
  }

  if (!next.result && prev.result && prevTerminal && nextTerminal) {
    return { ...next, result: prev.result }
  }

  return next
}

export interface TaskCompletionNotice {
  kind: "success" | "info" | "error"
  title: string
  description?: string
}

/**
 * Снимок терминальной задачи ещё может быть «черновым»: события SSE не несут
 * итогового результата, и у только что завершившейся задачи `result` в таком
 * снимке пустой. Объявлять о завершении можно, только когда результат уже есть
 * либо детали действительно дотянуты запросом (`fetched`).
 */
export function isCompletionAnnounceable(
  detail: Pick<TaskDetailDto, "status" | "result"> | null | undefined,
  fetched: boolean
): boolean {
  if (!detail || !isTerminalTaskStatus(detail.status)) return false
  if (detail.status !== "ready") return true
  return fetched || !!detail.result
}

export function describeTaskCompletion(
  detail: Pick<TaskDetailDto, "status" | "result" | "error">
): TaskCompletionNotice | null {
  if (!isTerminalTaskStatus(detail.status)) return null

  if (detail.status === "ready") {
    return {
      kind: "success",
      title: "Сбор участников успешно завершен!",
      description: `Собрано: ${detail.result?.participantsCount ?? 0}, с номерами: ${detail.result?.participantsWithPhone ?? 0}`,
    }
  }

  if (detail.status === "stopped") {
    return { kind: "info", title: "Сбор остановлен" }
  }

  return {
    kind: "error",
    title: "Ошибка при выполнении задачи",
    ...(detail.error ? { description: detail.error } : {}),
  }
}

/** Полезная нагрузка SSE-события задачи (`TaskEvent` на бэкенде). */
export interface TaskEventPayload {
  taskId?: string
  status?: TaskStatus
  step?: TaskStepDto | null
  progress?: TaskProgress | null
  error?: string | null
  timestamp?: string
}

function asStepDto(step: TaskDetailDto["currentStep"]): TaskStepDto | null {
  if (!step || typeof step !== "object") return null
  return step
}

/**
 * Накатывает SSE-событие на локальный снимок задачи, чтобы этапы двигались
 * между запросами деталей. Событие не содержит полной задачи, поэтому без
 * уже загруженного снимка применять его некуда.
 */
export function applyTaskEvent(
  prev: TaskDetailDto | null,
  event: TaskEventPayload | null | undefined
): TaskDetailDto | null {
  if (!prev || !event) return prev
  if (event.taskId && event.taskId !== prev.id) return prev

  const status = event.status ?? prev.status
  const terminal = isTerminalTaskStatus(status)
  const stepHistory: TaskStepDto[] = [...(prev.stepHistory ?? [])]

  const prevCurrent = asStepDto(prev.currentStep)
  const nextStep = event.step ?? null
  const prevName = extractStepName(prevCurrent)
  const nextName = extractStepName(nextStep)

  const stepChanged =
    !!prevCurrent &&
    (nextName !== prevName ||
      (!!nextStep?.startedAt && nextStep.startedAt !== prevCurrent.startedAt))

  if (prevCurrent && (stepChanged || terminal)) {
    const last = stepHistory[stepHistory.length - 1]
    const alreadyRecorded =
      !!last && extractStepName(last.step) === prevName && last.startedAt === prevCurrent.startedAt

    if (!alreadyRecorded) {
      const startedMs = Date.parse(prevCurrent.startedAt ?? "")
      const endedMs = Date.parse(nextStep?.startedAt ?? event.timestamp ?? "")
      const durationMs =
        typeof prevCurrent.durationMs === "number"
          ? prevCurrent.durationMs
          : Number.isFinite(startedMs) && Number.isFinite(endedMs) && endedMs >= startedMs
            ? endedMs - startedMs
            : null
      stepHistory.push({ ...prevCurrent, durationMs })
    }
  }

  const progress = event.progress
    ? { ...(prev.progress ?? {}), ...event.progress }
    : (prev.progress ?? null)

  return {
    ...prev,
    status,
    stepHistory,
    currentStep: terminal ? null : (nextStep ?? prev.currentStep ?? null),
    progress,
    error: event.error ?? prev.error ?? null,
    completedAt: terminal ? (prev.completedAt ?? event.timestamp ?? null) : prev.completedAt,
  }
}
