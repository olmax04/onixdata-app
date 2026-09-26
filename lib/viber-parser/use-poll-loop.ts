"use client"

import * as React from "react"

export interface UsePollLoopOptions {
  enabled: boolean
  intervalMs: number
  onTick: () => Promise<void> | void
}

/**
 * Цикл опроса «следующий тик планируется только после ответа предыдущего».
 * Фиксированный setInterval на медленном бэкенде порождает очередь запросов,
 * каждый из которых отменяет предыдущий: данные не обновляются, спиннер висит.
 * Скрытая вкладка не опрашивается, возврат к ней даёт немедленный запрос.
 */
export function usePollLoop({ enabled, intervalMs, onTick }: UsePollLoopOptions): void {
  const onTickRef = React.useRef(onTick)
  onTickRef.current = onTick

  React.useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let running = false
    let timer: number | undefined

    const schedule = () => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        void tick()
      }, intervalMs)
    }

    const tick = async () => {
      // Пока предыдущий запрос в полёте, новый не стартует: он сам запланирует следующий.
      if (cancelled || running) return
      if (document.hidden) {
        schedule()
        return
      }

      running = true
      try {
        await onTickRef.current()
      } catch {
        // Упавший запрос не должен останавливать цикл: следующий тик планируется всегда.
      } finally {
        running = false
        schedule()
      }
    }

    const handleVisibility = () => {
      if (document.hidden) return
      if (timer !== undefined) window.clearTimeout(timer)
      void tick()
    }

    schedule()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [enabled, intervalMs])
}
