"use client"

import * as React from "react"

import type { EmulatorItem } from "./emulator-status"

export type { EmulatorItem } from "./emulator-status"

interface EmulatorsContextValue {
  emulators: EmulatorItem[]
  loading: boolean
  error: string | null
  kvmAvailable: boolean | null
  vpsHost: string | null
  refresh: () => Promise<void>
  lastSuccessAt: number | null
  isStale: boolean
}

const EmulatorsContext = React.createContext<EmulatorsContextValue | undefined>(undefined)

export function EmulatorsProvider({ children }: { children: React.ReactNode }) {
  const [emulators, setEmulators] = React.useState<EmulatorItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [kvmAvailable, setKvmAvailable] = React.useState<boolean | null>(null)
  const [vpsHost, setVpsHost] = React.useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = React.useState<number | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/emulators", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Ошибка загрузки (${res.status})`)
      }
      const data = await res.json()
      setEmulators((data.emulators || []) as EmulatorItem[])
      setKvmAvailable(data.kvmAvailable ?? false)
      setVpsHost(data.vpsHost || null)
      setLastSuccessAt(Date.now())
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Не удалось связаться с сервисом управления")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
    const interval = setInterval(refresh, 20_000)
    return () => clearInterval(interval)
  }, [refresh])

  const isStale = Boolean(error && lastSuccessAt !== null)

  return (
    <EmulatorsContext.Provider
      value={{
        emulators,
        loading,
        error,
        kvmAvailable,
        vpsHost,
        refresh,
        lastSuccessAt,
        isStale,
      }}
    >
      {children}
    </EmulatorsContext.Provider>
  )
}

export function useEmulators() {
  const ctx = React.useContext(EmulatorsContext)
  return (
    ctx || {
      emulators: [],
      loading: false,
      error: null,
      kvmAvailable: null,
      vpsHost: null,
      refresh: async () => {},
      lastSuccessAt: null,
      isStale: false,
    }
  )
}
