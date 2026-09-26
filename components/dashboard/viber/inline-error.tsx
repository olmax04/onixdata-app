"use client"

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface InlineErrorProps {
  message: string
  onRetry?: () => void
  className?: string
}

/** Ошибка загрузки показывается рядом с данными, а не вместо них. */
export function InlineError({ message, onRetry, className }: InlineErrorProps) {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs ${className ?? ""}`}
    >
      <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertCircleIcon className="size-3.5 shrink-0" />
        <span>{message}</span>
      </span>
      {onRetry ? (
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onRetry}>
          <RefreshCwIcon className="size-3" />
          Повторить
        </Button>
      ) : null}
    </div>
  )
}
