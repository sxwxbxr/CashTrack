"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  type Language,
  type TranslateOptions,
  isSupportedLanguage,
  translate,
} from "@/lib/i18n/translations"

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, options?: TranslateOptions) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function detectBrowserLanguage(): Language | null {
  if (typeof navigator === "undefined") {
    return null
  }

  const languages = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : []

  for (const entry of languages) {
    if (!entry) continue
    const normalized = entry.toLowerCase()
    if (isSupportedLanguage(normalized)) {
      return normalized
    }
    const base = normalized.split("-")[0]
    if (isSupportedLanguage(base)) {
      return base
    }
  }

  return null
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null
  }
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`)
  const match = document.cookie.match(pattern)
  return match ? decodeURIComponent(match[1]) : null
}

interface LanguageProviderProps {
  children: React.ReactNode
  initialLanguage?: Language
}

export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? DEFAULT_LANGUAGE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated) {
      return
    }

    let resolved: Language | null = null
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
    if (stored && isSupportedLanguage(stored)) {
      resolved = stored
    }

    if (!resolved) {
      const cookieLanguage = readCookie(LANGUAGE_COOKIE_NAME)
      if (cookieLanguage && isSupportedLanguage(cookieLanguage)) {
        resolved = cookieLanguage
      }
    }

    if (!resolved) {
      resolved = detectBrowserLanguage()
    }

    if (resolved && resolved !== language) {
      setLanguageState(resolved)
    }

    setHydrated(true)
  }, [hydrated, language])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language
      document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
  }, [language])

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
  }, [])

  const translateValue = useCallback(
    (key: string, options?: TranslateOptions) => translate(language, key, options),
    [language],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: translateValue }),
    [language, setLanguage, translateValue],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

export function useTranslations() {
  const context = useLanguage()
  return {
    language: context.language,
    setLanguage: context.setLanguage,
    t: context.t,
    options: LANGUAGE_OPTIONS,
  }
}
