import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useViberResource } from "@/lib/viber-parser/use-resource"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useViberResource", () => {
  it("загружает данные и снимает признак загрузки", async () => {
    const loader = vi.fn().mockResolvedValue({ count: 2 })
    const { result } = renderHook(() => useViberResource(loader))
    await flush()

    expect(result.current.data).toEqual({ count: 2 })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.loaded).toBe(true)
  })

  it("при ошибке сохраняет прежние данные и показывает текст ошибки", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockRejectedValue(new Error("Бэкенд Viber недоступен"))

    const { result } = renderHook(() => useViberResource(loader))
    await flush()
    expect(result.current.data).toEqual({ count: 2 })

    await act(async () => {
      result.current.reload()
    })
    await flush()

    expect(result.current.data).toEqual({ count: 2 })
    expect(result.current.error).toBe("Бэкенд Viber недоступен")
    expect(result.current.loading).toBe(false)
  })

  it("успешная перезагрузка убирает ошибку", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("нет связи"))
      .mockResolvedValue({ count: 7 })

    const { result } = renderHook(() => useViberResource(loader))
    await flush()
    expect(result.current.error).toBe("нет связи")

    await act(async () => {
      result.current.reload()
    })
    await flush()

    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({ count: 7 })
  })

  it("смена ключа перезагружает ресурс", async () => {
    const loader = vi.fn().mockImplementation(() => Promise.resolve({ count: loader.mock.calls.length }))
    const { result, rerender } = renderHook(({ key }) => useViberResource(loader, { key }), {
      initialProps: { key: "26" },
    })
    await flush()
    expect(result.current.data).toEqual({ count: 1 })

    rerender({ key: "27" })
    await flush()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ count: 2 })
  })

  it("не загружает, пока ресурс отключён", async () => {
    const loader = vi.fn().mockResolvedValue({ count: 1 })
    renderHook(() => useViberResource(loader, { enabled: false }))
    await flush()
    expect(loader).not.toHaveBeenCalled()
  })

  it("reload() у отключённого ресурса не зовёт загрузчик", async () => {
    const loader = vi.fn().mockResolvedValue({ count: 1 })
    const { result } = renderHook(() => useViberResource(loader, { enabled: false }))
    await flush()

    await act(async () => {
      await result.current.reload()
    })
    await flush()

    expect(loader).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("снимает признак загрузки, когда запрос прерван", async () => {
    const aborted = new Error("The operation was aborted")
    aborted.name = "AbortError"
    const loader = vi.fn().mockRejectedValue(aborted)

    const { result } = renderHook(() => useViberResource(loader))
    await flush()

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("reload() резолвится только после ответа загрузчика", async () => {
    let resolveLoader: ((value: { count: number }) => void) | null = null
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<{ count: number }>((resolve) => {
          resolveLoader = resolve
        })
    )

    const { result } = renderHook(() => useViberResource(loader))
    await flush()

    let settled = false
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.reload().then(() => {
        settled = true
      })
    })
    await flush()
    expect(settled).toBe(false)
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveLoader?.({ count: 5 })
      await pending
    })

    expect(settled).toBe(true)
    expect(result.current.data).toEqual({ count: 5 })
    expect(result.current.loading).toBe(false)
  })
})
