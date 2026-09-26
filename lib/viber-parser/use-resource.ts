"use client"

import * as React from "react"

import { errorMessage, isAbortError } from "@/lib/viber-parser/client"

export interface ViberResourceState<T> {
  data: T | null
  error: string | null
  loading: boolean
  loaded: boolean
}

export interface ViberResource<T> extends ViberResourceState<T> {
  /** Промис резолвится, когда ответ получен (или запрос прерван) — по нему строят циклы опроса. */
  reload: () => Promise<void>
}

export interface UseViberResourceOptions {
  /** Смена ключа перезагружает ресурс с нуля (например, выбрана другая группа). */
  key?: string | null
  enabled?: boolean
}

/**
 * Загрузчик данных, который при ошибке НЕ обнуляет уже показанные данные:
 * панель остаётся заполненной, а рядом появляется inline-ошибка с «Повторить».
 */
export function useViberResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  options: UseViberResourceOptions = {}
): ViberResource<T> {
  const { key = "", enabled = true } = options

  const loaderRef = React.useRef(loader)
  loaderRef.current = loader

  const [state, setState] = React.useState<ViberResourceState<T>>({
    data: null,
    error: null,
    loading: false,
    loaded: false,
  })

  const runIdRef = React.useRef(0)
  const abortRef = React.useRef<AbortController | null>(null)

  // Отключённый ресурс не грузится и по ручному reload(): иначе выбранная «нигде»
  // группа даёт запрос groups/null/members и ложную inline-ошибку.
  const enabledRef = React.useRef(enabled)
  enabledRef.current = enabled

  const reload = React.useCallback(async () => {
    if (!enabledRef.current) return

    const myRun = ++runIdRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const data = await loaderRef.current(controller.signal)
      if (myRun !== runIdRef.current) return
      setState({ data, error: null, loading: false, loaded: true })
    } catch (error) {
      if (myRun !== runIdRef.current) return
      if (isAbortError(error)) {
        // Запрос прерван — спиннер снимаем, данные и текст ошибки не трогаем.
        setState((prev) => ({ ...prev, loading: false }))
        return
      }
      // Данные не трогаем — пользователь продолжает видеть последний успешный ответ.
      setState((prev) => ({
        ...prev,
        error: errorMessage(error),
        loading: false,
        loaded: true,
      }))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!enabled) return
    setState({ data: null, error: null, loading: true, loaded: false })
    void reload()
    return () => {
      runIdRef.current += 1
      abortRef.current?.abort()
    }
  }, [key, enabled, reload])

  return { ...state, reload }
}
