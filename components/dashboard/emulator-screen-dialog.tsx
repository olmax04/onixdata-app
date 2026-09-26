"use client"

import * as React from "react"
import { AlertTriangleIcon, ExternalLinkIcon, RefreshCwIcon, SmartphoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function formatScrcpyStreamUrl(
  rawUrl: string | null | undefined,
  adbPort?: number | null
): string | null {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    // If it already has stream hash, return as is
    if (url.hash.includes("action=stream")) {
      return rawUrl
    }
    const port = adbPort || 5555
    const udid = `host.docker.internal:${port}`
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${wsProto}//${url.host}/`
    url.hash = `!action=stream&udid=${encodeURIComponent(udid)}&player=mse&ws=${encodeURIComponent(wsUrl)}`
    url.search = ""
    return url.toString()
  } catch {
    return rawUrl
  }
}

interface EmulatorScreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emulatorName: string
  scrcpyUrl: string | null
  adbPort?: number | null
}

export function EmulatorScreenDialog({
  open,
  onOpenChange,
  emulatorName,
  scrcpyUrl,
  adbPort,
}: EmulatorScreenDialogProps) {
  const streamUrl = React.useMemo(
    () => formatScrcpyStreamUrl(scrcpyUrl, adbPort),
    [scrcpyUrl, adbPort]
  )

  const [isHttps, setIsHttps] = React.useState(false)
  const [forceIframe, setForceIframe] = React.useState(false)

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      setIsHttps(true)
    }
  }, [])

  const isMixedContent = isHttps && !!streamUrl?.startsWith("http:")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <SmartphoneIcon className="h-5 w-5 text-primary" />
              Экран устройства: {emulatorName}
            </DialogTitle>
            <DialogDescription>
              Интерактивное управление экраном устройства.
            </DialogDescription>
          </div>
          {streamUrl && (
            <Button
              variant="default"
              size="sm"
              asChild
              className="mr-6 gap-1.5"
            >
              <a href={streamUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                В новой вкладке
              </a>
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 w-full bg-black/95 rounded-md overflow-hidden relative flex items-center justify-center">
          {!streamUrl ? (
            <div className="text-center p-6 text-muted-foreground">
              <p>Трансляция экрана недоступна.</p>
              <p className="text-xs mt-1">Убедитесь, что устройство запущено и подключено.</p>
            </div>
          ) : isMixedContent && !forceIframe ? (
            <div className="max-w-md p-6 bg-card border rounded-xl shadow-xl text-center space-y-4 m-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                <AlertTriangleIcon className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-base">Блокировка Mixed Content в браузере</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Панель открыта по безопасному протоколу <strong>HTTPS</strong>, а трансляция экрана работает по <strong>HTTP</strong>. Браузер запрещает встраивание незащищенных страниц в iframe.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button asChild size="default" className="w-full gap-2 font-medium">
                  <a href={streamUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="h-4 w-4" />
                    Открыть экран в новой вкладке
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForceIframe(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Попробовать загрузить в окне
                </Button>
              </div>
            </div>
          ) : (
            <iframe
              src={streamUrl}
              className="w-full h-full border-0"
              title={`Экран ${emulatorName}`}
              allow="camera; microphone; clipboard-read; clipboard-write"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
