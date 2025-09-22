"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import type { AppSettingsPayload } from "@/lib/settings/types"

interface SettingsContextValue {
  settings: AppSettingsPayload | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  setSettings: (settings: AppSettingsPayload | null) => void
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

interface SettingsProviderProps {
  children: ReactNode
  initialSettings?: AppSettingsPayload
}

export function SettingsProvider({ children, initialSettings }: SettingsProviderProps) {
  const [settings, setSettingsState] = useState<AppSettingsPayload | null>(initialSettings ?? null)
  const [loading, setLoading] = useState(!initialSettings)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/settings", { cache: "no-store" })
      const body = (await response.json().catch(() => ({}))) as {
        settings?: AppSettingsPayload
        error?: unknown
      }
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Unable to load settings"
        throw new Error(message)
      }
      if (body.settings) {
        setSettingsState(body.settings)
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialSettings) {
      void fetchSettings()
    }
  }, [initialSettings, fetchSettings])

  useEffect(() => {
    if (initialSettings) {
      setSettingsState(initialSettings)
    }
  }, [initialSettings])

  const setSettings = useCallback((value: AppSettingsPayload | null) => {
    setSettingsState(value)
  }, [])

  const refresh = useCallback(async () => {
    await fetchSettings()
  }, [fetchSettings])

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, error, refresh, setSettings }),
    [settings, loading, error, refresh, setSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useAppSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useAppSettings must be used within a SettingsProvider")
  }
  return context
}
