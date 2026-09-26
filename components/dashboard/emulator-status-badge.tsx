import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EmulatorStatusView } from "@/lib/emulator-status"

export interface EmulatorStatusBadgeProps {
  status: EmulatorStatusView
  isStale?: boolean
  className?: string
}

export function EmulatorStatusBadge({
  status,
  isStale = false,
  className,
}: EmulatorStatusBadgeProps) {
  const isStaleSuccess = isStale && status.tone === "success"

  let toneClasses = ""
  switch (status.tone) {
    case "success":
      toneClasses = isStaleSuccess
        ? "bg-muted text-muted-foreground border-amber-500/40 border"
        : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm"
      break
    case "info":
      toneClasses = "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
      break
    case "warning":
      toneClasses =
        "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      break
    case "danger":
      toneClasses = "bg-destructive text-destructive-foreground border-transparent shadow-sm"
      break
    case "neutral":
    default:
      toneClasses = "border-border bg-secondary text-secondary-foreground"
      break
  }

  const displayText = isStaleSuccess ? `${status.label} (устарело)` : status.label

  return (
    <Badge
      variant="outline"
      title={status.description}
      className={cn(
        "transition-colors gap-1.5 font-medium select-none",
        toneClasses,
        status.busy && "animate-pulse",
        className
      )}
    >
      {status.busy && (
        <span
          data-testid="status-busy-indicator"
          className="size-1.5 rounded-full bg-current opacity-75 shrink-0"
        />
      )}
      <span>{displayText}</span>
    </Badge>
  )
}
