"use client"

import * as React from "react"
import { CheckCircle2Icon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTaskDate, formatTaskDuration } from "@/components/dashboard/viber/format"
import { STEP_LABELS } from "@/components/dashboard/viber/pipeline"
import { taskStatusBadgeOf } from "@/components/dashboard/viber/task-status"
import type { TaskDetailDto, TaskSummaryDto } from "@/lib/viber-parser/types"

interface HistoryTabProps {
  tasks: TaskSummaryDto[]
  loading: boolean
  onRefresh: () => void | Promise<void>
  onOpenDetail: (taskId: string) => Promise<TaskDetailDto | null>
}

export function HistoryTab({ tasks, loading, onRefresh, onOpenDetail }: HistoryTabProps) {
  const [selected, setSelected] = React.useState<TaskDetailDto | null>(null)
  const [open, setOpen] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const refreshBusy = loading || refreshing

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpen = async (taskId: string) => {
    setPendingId(taskId)
    const detail = await onOpenDetail(taskId)
    setPendingId(null)
    if (detail) {
      setSelected(detail)
      setOpen(true)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                История фоновых задач State Machine
              </CardTitle>
              <CardDescription className="text-xs">
                Реестр запущенных задач, их статусы и длительность. Бэкенд хранит список в памяти
                процесса — после его перезапуска история очищается.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => void handleRefresh()}
              disabled={refreshBusy}
              title="Обновить историю задач"
              aria-label="Обновить историю задач"
            >
              <RefreshCwIcon className={`size-3.5 ${refreshBusy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Задачи еще не запускались в этой сессии.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">ID задачи</TableHead>
                    <TableHead>Целевая группа</TableHead>
                    <TableHead className="w-[110px]">Статус</TableHead>
                    <TableHead className="w-[150px]">Создана</TableHead>
                    <TableHead className="w-[140px] text-right">Длительность</TableHead>
                    <TableHead className="w-[90px] text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const badge = taskStatusBadgeOf(task.status)
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs">
                          <span className="font-medium text-foreground">{task.id}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{task.groupName || task.groupTarget}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={badge.variant}
                            className={`text-[10px] font-normal ${badge.className ?? ""}`}
                          >
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {formatTaskDate(task)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatTaskDuration(task)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-primary"
                            disabled={pendingId === task.id}
                            onClick={() => void handleOpen(task.id)}
                          >
                            Детали
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span>Задача {selected?.id}</span>
              {selected ? (
                <Badge variant={taskStatusBadgeOf(selected.status).variant} className="text-xs">
                  {taskStatusBadgeOf(selected.status).label}
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Цель: {selected?.groupName || selected?.groupTarget}
              {selected?.conversationId ? ` (ID ${selected.conversationId})` : ""}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground">Пройденные шаги:</span>
                <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-2.5">
                  {(selected.stepHistory?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">Шаги ещё не зафиксированы.</p>
                  ) : (
                    (selected.stepHistory ?? []).map((step, index) => (
                      <div
                        key={`${step.step}-${index}`}
                        className="flex items-center justify-between border-b py-1 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                          <span className="font-medium text-foreground">
                            {STEP_LABELS[step.step]?.title || step.description || step.step}
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground">
                          {typeof step.durationMs === "number"
                            ? `${(step.durationMs / 1000).toFixed(1)} сек`
                            : "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selected.error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                  {selected.error}
                </div>
              ) : null}

              {selected.result ? (
                <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                  <div className="font-semibold text-foreground">Итоговый отчет:</div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-muted-foreground">
                    <div>
                      Всего участников:{" "}
                      <span className="font-bold text-foreground">
                        {selected.result.participantsCount}
                      </span>
                    </div>
                    <div>
                      С номерами телефонов:{" "}
                      <span className="font-bold text-foreground">
                        {selected.result.participantsWithPhone}
                      </span>
                    </div>
                    <div>
                      Обработано страниц:{" "}
                      <span className="font-bold text-foreground">
                        {selected.result.pagesCount}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
