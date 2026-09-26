import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { usePollLoop } from "@/lib/viber-parser/use-poll-loop"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function setHidden(value: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value })
  document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] })
  Object.defineProperty(document, "hidden", { configurable: true, value: false })
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, "hidden", { configurable: true, value: false })
})

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("usePollLoop", () => {
  it("опрашивает по интервалу, пока включён", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await flush(0)
    expect(onTick).toHaveBeenCalledTimes(0)

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it("не запускает новый запрос, пока не ответил предыдущий", async () => {
    const slow = deferred<void>()
    const onTick = vi.fn().mockImplementation(() => slow.promise)

    renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    // Бэкенд отвечает дольше интервала — очередь параллельных запросов копиться не должна.
    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(1)

    await act(async () => {
      slow.resolve()
      await slow.promise
    })

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it("не опрашивает скрытую вкладку и делает это сразу при возврате", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await act(async () => {
      setHidden(true)
    })

    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(0)

    await act(async () => {
      setHidden(false)
    })
    await flush(0)
    expect(onTick).toHaveBeenCalledTimes(1)

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it("выключенный цикл не опрашивает вовсе", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ enabled }) => usePollLoop({ enabled, intervalMs: 3000, onTick }),
      { initialProps: { enabled: false } }
    )

    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(0)

    rerender({ enabled: true })
    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    rerender({ enabled: false })
    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it("реджект onTick не ломает цикл", async () => {
    const onTick = vi
      .fn()
      .mockRejectedValueOnce(new Error("Бэкенд Viber недоступен"))
      .mockResolvedValue(undefined)

    renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    // Упавший запрос обязан запланировать следующий, иначе цикл встаёт навсегда.
    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(2)

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it("после размонтирования не опрашивает", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    unmount()
    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it("размонтирование во время незавершённого запроса не планирует следующий", async () => {
    const slow = deferred<void>()
    const onTick = vi.fn().mockImplementation(() => slow.promise)
    const { unmount } = renderHook(() => usePollLoop({ enabled: true, intervalMs: 3000, onTick }))

    await flush(3000)
    expect(onTick).toHaveBeenCalledTimes(1)

    // Ответ приходит уже после размонтирования: планировщик в finally обязан промолчать.
    unmount()
    await act(async () => {
      slow.resolve()
      await slow.promise
    })

    await flush(9000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })
})
