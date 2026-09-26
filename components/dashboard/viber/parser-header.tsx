"use client"

import * as React from "react"
import { Loader2Icon, RadioIcon, RefreshCwIcon, SquareIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ParserConnectionState } from "@/lib/viber-parser/types"

interface ParserHeaderProps {
  connection: ParserConnectionState
  initialLoadDone: boolean
  consecutiveFailures: number
  lastError: string | null
  isTaskRunning: boolean
  currentStepLabel: string
  isStopping: boolean
  /** Первая загрузка: кнопка обновления занята до первого ответа бэкенда. */
  isRefreshing: boolean
  onStop: () => void
  onRefresh: () => void | Promise<void>
}

export function ParserHeader({
  connection,
  initialLoadDone,
  consecutiveFailures,
  lastError,
  isTaskRunning,
  currentStepLabel,
  isStopping,
  isRefreshing,
  onStop,
  onRefresh,
}: ParserHeaderProps) {
  const isOnline = initialLoadDone && connection === "online"
  const isReconnecting = initialLoadDone && connection === "reconnecting"
  const isOffline = initialLoadDone && connection === "offline"

  const [manualRefreshing, setManualRefreshing] = React.useState(false)
  const refreshBusy = isRefreshing || manualRefreshing

  const handleRefresh = async () => {
    if (manualRefreshing) return
    setManualRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setManualRefreshing(false)
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-lg ${
                isOnline
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : isReconnecting
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              <RadioIcon className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Viber Automation Engine</h2>
                {!initialLoadDone ? (
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <Loader2Icon className="size-3 animate-spin" />
                    Проверка связи…
                  </Badge>
                ) : isOnline ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Онлайн
                  </Badge>
                ) : isReconnecting ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/30 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <Loader2Icon className="size-3 animate-spin" />
                    Переподключение… ({consecutiveFailures})
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Офлайн
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isOffline && lastError
                  ? lastError
                  : "LDPlayer 9 + AdbUi + Frida перехватчик + SQLite /data/data"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isTaskRunning ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="animate-pulse gap-1.5 border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-medium text-indigo-700 dark:text-indigo-300"
                >
                  <Loader2Icon className="size-3 animate-spin text-indigo-600" />
                  <span>{currentStepLabel}</span>
                </Badge>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1 text-xs"
                  onClick={onStop}
                  disabled={isStopping}
                >
                  <SquareIcon className="size-3" />
                  Остановить
                </Button>
              </div>
            ) : isOnline ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Мьютекс эмулятора свободен
              </Badge>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => void handleRefresh()}
              disabled={refreshBusy}
              title="Обновить данные"
              aria-label="Обновить данные"
            >
              <RefreshCwIcon className={`size-4 ${refreshBusy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
