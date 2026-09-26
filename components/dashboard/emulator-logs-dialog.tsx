"use client"

import * as React from "react"
import { TerminalIcon, RefreshCwIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface EmulatorLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emulatorId: string | null
  emulatorName: string
}

export function EmulatorLogsDialog({
  open,
  onOpenChange,
  emulatorId,
  emulatorName,
}: EmulatorLogsDialogProps) {
  const [logs, setLogs] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)

  const fetchLogs = React.useCallback(async () => {
    if (!emulatorId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/emulators/${encodeURIComponent(emulatorId)}/logs?tail=200`)
      const data = await res.json().catch(() => null)
      setLogs(data?.logs || "Логов пока нет")
    } catch (err: any) {
      setLogs(`Ошибка загрузки логов: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [emulatorId])

  React.useEffect(() => {
    if (open && emulatorId) {
      void fetchLogs()
    } else {
      setLogs("")
    }
  }, [open, emulatorId, fetchLogs])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[75vh] flex flex-col p-4">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <TerminalIcon className="h-5 w-5 text-primary" />
              Логи инстанса: {emulatorName}
            </DialogTitle>
            <DialogDescription>
              Последние 200 строк системных логов
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="mr-6 gap-1.5"
          >
            {loading ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-3.5 w-3.5" />
            )}
            Обновить
          </Button>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full bg-muted/60 p-3 rounded font-mono text-xs overflow-auto whitespace-pre-wrap">
          {logs || "Загрузка..."}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
