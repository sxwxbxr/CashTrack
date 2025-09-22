import { cookies, headers } from "next/headers"

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  Language,
  TranslateOptions,
  isSupportedLanguage,
  translate,
} from "./translations"

const SUPPORTED_LANGUAGES: Language[] = ["en", "de", "it", "fr"]

function resolveLanguageTag(tag: string | null | undefined): Language | null {
  if (!tag) {
    return null
  }
  const normalized = tag.toLowerCase()
  if (isSupportedLanguage(normalized)) {
    return normalized
  }
  const base = normalized.split("-")[0]
  if (isSupportedLanguage(base)) {
    return base
  }
  return null
}

function detectFromHeaders(): Language | null {
  const header = headers().get("accept-language")
  if (!header) {
    return null
  }

  for (const part of header.split(",")) {
    const [languagePart] = part.split(";")
    const resolved = resolveLanguageTag(languagePart?.trim())
    if (resolved) {
      return resolved
    }
  }

  return null
}

export function getUserLanguage(): Language {
  const cookieStore = cookies()
  const cookieLanguage = resolveLanguageTag(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value)
  if (cookieLanguage) {
    return cookieLanguage
  }

  const headerLanguage = detectFromHeaders()
  if (headerLanguage) {
    return headerLanguage
  }

  return DEFAULT_LANGUAGE
}

export type Translator = (key: string, options?: TranslateOptions) => string

export function getTranslator(language?: Language): Translator {
  const resolved = language ?? getUserLanguage()
  return (key, options) => translate(resolved, key, options)
}

export function listSupportedLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES]
}
