import type { TerminalTaskInfo } from "@/lib/viber-parser/parser-sync"
import type { TaskStatus } from "@/lib/viber-parser/types"

export interface TaskStatusBadge {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className?: string
}

export const taskStatusBadge: Record<TaskStatus, TaskStatusBadge> = {
  ready: {
    label: "Завершено",
    variant: "outline",
    className:
      "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  running: {
    label: "В процессе",
    variant: "default",
    className: "bg-indigo-600 text-white animate-pulse",
  },
  initializing: { label: "Подготовка", variant: "secondary" },
  starting: { label: "Запуск", variant: "secondary" },
  stopped: {
    label: "Остановлено",
    variant: "secondary",
    className: "text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  error: { label: "Ошибка", variant: "destructive" },
}

export function taskStatusBadgeOf(status: TaskStatus | string): TaskStatusBadge {
  return (
    taskStatusBadge[status as TaskStatus] ?? {
      label: String(status),
      variant: "secondary" as const,
    }
  )
}

export interface TerminalToast {
  kind: "success" | "info" | "error"
  title: string
  description?: string
}

/**
 * Итоги сбора лежат только в detail задачи, а SSE-событие их не несёт. Поэтому
 * терминал по потоку приходит без `result`: показывать вместо чисел нули нельзя —
 * настоящие итоги появятся в карточке после ближайшего опроса.
 */
export function terminalToastOf(info: TerminalTaskInfo): TerminalToast {
  if (info.status === "ready") {
    if (!info.result) {
      return {
        kind: "success",
        title: "Сбор участников завершён",
        description: "Итоги появятся в карточке задачи после обновления",
      }
    }
    return {
      kind: "success",
      title: "Сбор участников успешно завершен!",
      description: `Собрано: ${info.result.participantsCount}, с номерами: ${info.result.participantsWithPhone}`,
    }
  }

  if (info.status === "stopped") {
    return { kind: "info", title: "Сбор остановлен пользователем" }
  }

  return {
    kind: "error",
    title: "Ошибка при выполнении задачи",
    description: info.error ?? undefined,
  }
}
