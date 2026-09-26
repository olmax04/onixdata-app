"use client"

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  computePipelineMetrics,
  computePipelineSteps,
} from "@/components/dashboard/viber/pipeline"
import type { ParserConnectionState, TaskDetailDto } from "@/lib/viber-parser/types"

interface PipelineCardProps {
  task: TaskDetailDto
  isTaskRunning: boolean
  /** Бэкенд перезапустился и потерял задачу: карточка осталась, данных больше не будет. */
  isTaskLost: boolean
  connection: ParserConnectionState
  onDismiss: () => void
  onExportTxt: () => void
  onExportCsv: () => void
  onExportJson: () => void
  onCopyPhones: () => void
}

export function PipelineCard({
  task,
  isTaskRunning,
  isTaskLost,
  connection,
  onDismiss,
  onExportTxt,
  onExportCsv,
  onExportJson,
  onCopyPhones,
}: PipelineCardProps) {
  const steps = computePipelineSteps(task)
  const metrics = computePipelineMetrics(task.progress)
  const isReady = task.status === "ready"

  return (
    <Card
      className={`border-border/60 ${
        isTaskRunning
          ? "border-indigo-500/30 bg-indigo-500/[0.02]"
          : isReady
            ? "border-emerald-500/30 bg-emerald-500/[0.02]"
            : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isTaskRunning ? (
              <div className="size-2 animate-ping rounded-full bg-indigo-600" />
            ) : isReady ? (
              <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <div className="size-2 rounded-full bg-muted-foreground" />
            )}
            <CardTitle className="text-sm font-semibold">
              {isTaskRunning
                ? "State Machine: Пайплайн сбора участников"
                : isTaskLost
                  ? `Последняя задача: ${task.groupName || task.groupTarget}`
                  : isReady
                    ? `Сбор участников завершен: ${task.groupName || task.groupTarget}`
                    : "Итоги задачи сбора"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isTaskLost ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
              >
                <AlertCircleIcon className="size-3" />
                Связь с задачей потеряна
              </Badge>
            ) : null}
            {isTaskRunning && connection !== "online" ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
              >
                <Loader2Icon className="size-3 animate-spin" />
                Данные могут отставать
              </Badge>
            ) : null}
            <Badge variant="outline" className="font-mono text-[10px]">
              {task.id}
            </Badge>
            {!isTaskRunning ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={onDismiss}
              >
                Скрыть
              </Button>
            ) : null}
          </div>
        </div>
        <CardDescription className="text-xs">
          {isTaskRunning
            ? "Все этапы жизненного цикла задачи выполняются последовательно с фиксацией длительности и метрик"
            : isTaskLost
              ? "Бэкенд перезапустился и потерял активную задачу вместе с историей. Данные ниже — последнее, что успело прийти."
              : isReady
                ? `Все этапы сбора успешно пройдены за ${task.stepHistory?.length ?? 0} шагов. Результаты готовы к экспорту.`
                : "Выполнение задачи завершено."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className={`relative flex flex-col rounded-lg border p-2.5 text-xs transition-all ${
                step.state === "current"
                  ? "border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30"
                  : step.state === "done"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                    : step.state === "error"
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-border/40 bg-card/40 opacity-60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.state === "current" ? (
                  <Loader2Icon className="size-3.5 animate-spin text-indigo-600" />
                ) : step.state === "done" ? (
                  <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : step.state === "error" ? (
                  <AlertCircleIcon className="size-3.5 text-destructive" />
                ) : (
                  <span className="size-2 rounded-full bg-border" />
                )}
              </div>

              <span className="text-[11px] font-semibold leading-tight text-foreground">
                {step.title}
              </span>
              <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                {step.desc}
              </span>

              {step.durationMs !== null ? (
                <div className="mt-1.5 flex items-center justify-between border-t border-border/30 pt-1 font-mono text-[10px] text-muted-foreground">
                  <span>Время:</span>
                  <span className="font-semibold">{(step.durationMs / 1000).toFixed(1)}с</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {metrics.length > 0 ? (
          <div className="space-y-2 rounded-lg border bg-card/80 p-3 text-xs">
            {metrics.map((metric) => (
              <div key={metric.id} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{metric.label}:</span>
                  <span className="font-mono font-semibold">{metric.detail}</span>
                </div>
                {metric.percent !== null ? (
                  <Progress value={metric.percent} className="h-1.5" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {task.status === "error" && task.error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {task.error}
          </div>
        ) : null}

        {task.result ? (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-emerald-600" />
              <div>
                <span className="font-semibold text-foreground">Сбор успешно завершен!</span>
                <p className="text-[11px] text-muted-foreground">
                  Собрано {task.result.participantsCount} участников (с номерами:{" "}
                  {task.result.participantsWithPhone}) за {task.result.pagesCount} страниц.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onExportTxt}>
                <DownloadIcon className="size-3" />
                TXT
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onExportCsv}>
                <DownloadIcon className="size-3" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={onExportJson}
              >
                <DownloadIcon className="size-3" />
                JSON
              </Button>
              <Button
                size="sm"
                variant="default"
                className="h-7 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                onClick={onCopyPhones}
              >
                <CopyIcon className="size-3" />
                Копировать телефоны
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
