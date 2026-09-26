import type { TaskDetailDto, TaskProgress } from "@/lib/viber-parser/types"

export const STEP_LABELS: Record<string, { title: string; desc: string }> = {
  initializing: {
    title: "Инициализация",
    desc: "Проверка параметров задачи",
  },
  resolving_group: {
    title: "Определение группы",
    desc: "Поиск ID беседы и параметров в базе",
  },
  attaching_frida: {
    title: "Подключение Frida",
    desc: "Внедрение перехватчика в процесс Viber",
  },
  navigating_viber: {
    title: "Навигация в Viber",
    desc: "Переход к списку участников через AdbUi",
  },
  paging_participants: {
    title: "Сбор участников",
    desc: "Потоковый сбор страниц без скролла",
  },
  syncing_live_db: {
    title: "Запись в БД",
    desc: "Сохранение дешифрованных ID в SQLite",
  },
  restarting_viber: {
    title: "Перезапуск Viber",
    desc: "Сброс WAL журнала и блокировок",
  },
  waiting_numbers_sync: {
    title: "Сетевой синк номеров",
    desc: "Ожидание подтяжки открытых номеров клиентом",
  },
  deduplicating_and_finalizing: {
    title: "Дедупликация и имена",
    desc: "Синхронизация display_name и очистка дублей",
  },
  fetching_online_activity: {
    title: "Сбор активности",
    desc: "Сбор статуса онлайн и даты последнего визита через Frida",
  },
  exporting_results: {
    title: "Экспорт результатов",
    desc: "Формирование итоговых JSON/TXT файлов",
  },
}

export const ALL_STEPS_ORDER = [
  "resolving_group",
  "attaching_frida",
  "navigating_viber",
  "paging_participants",
  "syncing_live_db",
  "restarting_viber",
  "waiting_numbers_sync",
  "deduplicating_and_finalizing",
  "fetching_online_activity",
  "exporting_results",
]

export type PipelineStepState = "pending" | "current" | "done" | "error"

export interface PipelineStep {
  step: string
  title: string
  desc: string
  state: PipelineStepState
  durationMs: number | null
}

const TERMINAL = new Set(["ready", "stopped", "error"])

/**
 * Бэкенд не отдаёт completedAt: шаг попадает в stepHistory ровно в момент,
 * когда задача с него уходит, и уже с durationMs.
 */
export function computePipelineSteps(task: TaskDetailDto | null): PipelineStep[] {
  const history = task?.stepHistory ?? []
  const isTerminal = TERMINAL.has(task?.status ?? "")
  const currentStep = isTerminal ? null : task?.currentStep?.step ?? null
  const lastHistoryStep = history.length > 0 ? history[history.length - 1]?.step ?? null : null

  return ALL_STEPS_ORDER.map((step) => {
    const meta = STEP_LABELS[step] ?? { title: step, desc: "" }
    const entries = history.filter((item) => item.step === step)
    const entry = entries.length > 0 ? entries[entries.length - 1] : undefined
    const isCurrent = currentStep === step
    const isFailedStep = task?.status === "error" && lastHistoryStep === step

    let state: PipelineStepState = "pending"
    if (isFailedStep) state = "error"
    else if (isCurrent) state = "current"
    else if (entry) state = "done"

    return {
      step,
      title: meta.title,
      desc: meta.desc,
      state,
      durationMs: entry?.durationMs ?? null,
    }
  })
}

export interface PipelineMetric {
  id: string
  label: string
  detail: string
  percent: number | null
}

/** Живые метрики строятся по тем ключам прогресса, которые реально шлёт бэкенд. */
export function computePipelineMetrics(progress: TaskProgress | null | undefined): PipelineMetric[] {
  if (!progress) return []
  const metrics: PipelineMetric[] = []

  const headerTotal = typeof progress.headerTotal === "number" ? progress.headerTotal : null
  if (typeof progress.pagesCount === "number") {
    const offset = typeof progress.currentOffset === "number" ? progress.currentOffset : 0
    const pageSize = typeof progress.pageSize === "number" ? progress.pageSize : null
    const details = [
      `Страниц: ${progress.pagesCount}`,
      `Смещение: ${offset}`,
      pageSize ? `Размер страницы: ${pageSize}` : null,
      headerTotal ? `Всего в заголовке: ${headerTotal}` : null,
    ].filter(Boolean) as string[]

    metrics.push({
      id: "paging",
      label: "Прогресс сбора страниц",
      detail: details.join(" · "),
      percent:
        headerTotal && headerTotal > 0
          ? Math.min(100, Math.round((offset / headerTotal) * 100))
          : null,
    })
  } else if (headerTotal && headerTotal > 0) {
    metrics.push({
      id: "header",
      label: "Участников в заголовке группы",
      detail: String(headerTotal),
      percent: null,
    })
  }

  if (typeof progress.syncedPhoneNumbers === "number") {
    metrics.push({
      id: "numbers-sync",
      label: "Сетевой синк номеров",
      detail: `Подтянуто номеров: ${progress.syncedPhoneNumbers}${
        progress.stable ? " · значение стабилизировалось" : ""
      }`,
      percent: null,
    })
  }

  const onlineTotal =
    typeof progress.onlineTotal === "number"
      ? progress.onlineTotal
      : typeof progress.total === "number"
        ? progress.total
        : null
  const onlineDone =
    typeof progress.onlineChecked === "number"
      ? progress.onlineChecked
      : typeof progress.completed === "number"
        ? progress.completed
        : 0

  if (onlineTotal && onlineTotal > 0) {
    metrics.push({
      id: "online",
      label: "Проверка статуса онлайн / активности",
      detail: `Проверено: ${onlineDone} / ${onlineTotal}`,
      percent: Math.min(100, Math.round((onlineDone / onlineTotal) * 100)),
    })
  }

  return metrics
}
