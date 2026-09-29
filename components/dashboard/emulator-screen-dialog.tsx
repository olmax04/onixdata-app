"use client"

import * as React from "react"
import { ExternalLinkIcon, Loader2Icon, RefreshCwIcon, SmartphoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatScrcpyStreamUrl, panelScrcpyStreamUrl } from "@/lib/scrcpy"

export interface ScrcpyStreamUrls {
  /**
   * Адрес для iframe и ссылок. На HTTPS — через прокси панели (`/scrcpy/`),
   * иначе браузер заблокирует HTTP-трансляцию как Mixed Content. На HTTP
   * (локальная разработка) — напрямую: там блокировки нет, а WebSocket-прокси
   * есть только в продакшен-сервере (server/start.cjs).
   * `null`, пока компонент не смонтирован.
   */
  screenUrl: string | null
  /** Напрямую в scrcpy-web на VPS — запасной вариант, если прокси недоступен. */
  directUrl: string | null
}

/**
 * Адрес трансляции для ссылок и iframe.
 *
 * Прокси-ссылка строится от `window.location`, поэтому до монтирования
 * (SSR, первый рендер) известна только прямая ссылка — без расхождения при гидратации.
 */
export function useScrcpyStreamUrls(
  scrcpyUrl: string | null | undefined,
  adbPort?: number | null
): ScrcpyStreamUrls {
  const [location, setLocation] = React.useState<{ origin: string; secure: boolean } | null>(null)

  React.useEffect(() => {
    setLocation({
      origin: window.location.origin,
      secure: window.location.protocol === "https:",
    })
  }, [])

  return React.useMemo(() => {
    const directUrl = formatScrcpyStreamUrl(scrcpyUrl, adbPort)
    if (!location) return { screenUrl: null, directUrl }
    const screenUrl = location.secure
      ? panelScrcpyStreamUrl(location.origin, scrcpyUrl, adbPort)
      : directUrl
    return { screenUrl, directUrl }
  }, [location, scrcpyUrl, adbPort])
}

interface ScrcpyStreamLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  scrcpyUrl: string | null | undefined
  adbPort?: number | null
}

/** Ссылка «открыть экран в новой вкладке»: до монтирования — прямая, затем как в iframe. */
export const ScrcpyStreamLink = React.forwardRef<HTMLAnchorElement, ScrcpyStreamLinkProps>(
  function ScrcpyStreamLink({ scrcpyUrl, adbPort, children, ...props }, ref) {
    const { screenUrl, directUrl } = useScrcpyStreamUrls(scrcpyUrl, adbPort)
    const href = screenUrl ?? directUrl
    if (!href) return null
    return (
      <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }
)

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
  const { screenUrl, directUrl } = useScrcpyStreamUrls(scrcpyUrl, adbPort)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    setLoaded(false)
  }, [screenUrl, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

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
          {screenUrl && (
            <div className="mr-6 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={reload}
                className="gap-1.5"
                title="Переподключить трансляцию"
              >
                <RefreshCwIcon className="h-3.5 w-3.5" />
                Обновить
              </Button>
              <Button variant="default" size="sm" asChild className="gap-1.5">
                <a href={screenUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  В новой вкладке
                </a>
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 w-full bg-black/95 rounded-md overflow-hidden relative flex items-center justify-center">
          {!scrcpyUrl ? (
            <div className="text-center p-6 text-muted-foreground">
              <p>Трансляция экрана недоступна.</p>
              <p className="text-xs mt-1">Убедитесь, что устройство запущено и подключено.</p>
            </div>
          ) : !screenUrl ? (
            <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <iframe
                key={`${screenUrl}#${reloadKey}`}
                src={screenUrl}
                onLoad={() => setLoaded(true)}
                className="w-full h-full border-0"
                title={`Экран ${emulatorName}`}
                allow="clipboard-read; clipboard-write"
              />
              {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="h-8 w-8 animate-spin" />
                  <span>Подключение к экрану устройства…</span>
                </div>
              )}
            </>
          )}
        </div>

        {directUrl && directUrl !== screenUrl && (
          <p className="pt-2 text-[11px] text-muted-foreground">
            Экран не появился? Нажмите «Обновить» или откройте{" "}
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              прямую ссылку на scrcpy-web
            </a>
            .
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
