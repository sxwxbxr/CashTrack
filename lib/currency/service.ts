import { setTimeout as delay } from "timers/promises"

export const DEFAULT_BASE_CURRENCY = "USD"

export type CurrencyRates = Record<string, number>

export interface NormalizedCurrencyConfig {
  baseCurrency: string
  rates: CurrencyRates
  knownCurrencies: string[]
}

export interface LiveRatesResponse {
  rates: CurrencyRates
  fetchedAt: string
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return fallback
}

export function normalizeCurrencyCode(code: string): string {
  return code.trim().toUpperCase()
}

export function normalizeRates(baseCurrency: string, rates: CurrencyRates): CurrencyRates {
  const normalizedBase = normalizeCurrencyCode(baseCurrency || DEFAULT_BASE_CURRENCY)
  const normalized: CurrencyRates = {}
  for (const [key, value] of Object.entries(rates)) {
    const normalizedKey = normalizeCurrencyCode(key)
    const numeric = safeNumber(value, Number.NaN)
    if (!Number.isNaN(numeric) && numeric > 0) {
      normalized[normalizedKey] = numeric
    }
  }
  normalized[normalizedBase] = 1
  return normalized
}

export function ensureKnownCurrencies(baseCurrency: string, currencies: string[]): string[] {
  const normalizedBase = normalizeCurrencyCode(baseCurrency || DEFAULT_BASE_CURRENCY)
  const set = new Set<string>([normalizedBase])
  for (const code of currencies) {
    const normalized = normalizeCurrencyCode(code)
    if (normalized) {
      set.add(normalized)
    }
  }
  return Array.from(set)
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: CurrencyRates,
): number {
  const normalizedFrom = normalizeCurrencyCode(fromCurrency)
  const normalizedTo = normalizeCurrencyCode(toCurrency)
  if (!Number.isFinite(amount)) {
    return 0
  }

  if (normalizedFrom === normalizedTo) {
    return amount
  }

  const fromRate = rates[normalizedFrom]
  const toRate = rates[normalizedTo]
  if (!fromRate || !toRate) {
    throw new Error(`Missing exchange rate for ${normalizedFrom} or ${normalizedTo}`)
  }
  const baseAmount = amount * fromRate
  return baseAmount / toRate
}

export function roundAmount(value: number, fractionDigits = 2): number {
  const factor = 10 ** fractionDigits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

export async function fetchLiveRates(
  baseCurrency: string,
  currencies: string[],
  signal?: AbortSignal,
): Promise<LiveRatesResponse> {
  const normalizedBase = normalizeCurrencyCode(baseCurrency || DEFAULT_BASE_CURRENCY)
  const endpoint = `https://open.er-api.com/v6/latest/${normalizedBase}`
  const response = await fetch(endpoint, { signal })
  if (!response.ok) {
    throw new Error(`Unable to retrieve exchange rates (${response.status})`)
  }

  const body = (await response.json()) as { result?: string; rates?: Record<string, unknown>; time_last_update_utc?: string }
  if (body.result !== "success" || !body.rates) {
    throw new Error("Exchange rate provider returned an unexpected response")
  }

  const normalizedRates: CurrencyRates = {}
  const desired = currencies.length > 0 ? currencies.map(normalizeCurrencyCode) : []
  const includeAll = desired.length === 0
  for (const [key, value] of Object.entries(body.rates)) {
    const normalizedKey = normalizeCurrencyCode(key)
    if (!includeAll && !desired.includes(normalizedKey)) {
      continue
    }
    const numeric = safeNumber(value, Number.NaN)
    if (!Number.isNaN(numeric) && numeric > 0) {
      if (normalizedKey === normalizedBase) {
        normalizedRates[normalizedKey] = 1
      } else {
        normalizedRates[normalizedKey] = 1 / numeric
      }
    }
  }

  normalizedRates[normalizedBase] = 1
  const fetchedAt = body.time_last_update_utc
    ? new Date(body.time_last_update_utc).toISOString()
    : new Date().toISOString()

  return { rates: normalizedRates, fetchedAt }
}

export async function retryFetchLiveRates(
  baseCurrency: string,
  currencies: string[],
  attempts = 3,
  signal?: AbortSignal,
): Promise<LiveRatesResponse> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchLiveRates(baseCurrency, currencies, signal)
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await delay(250 * attempt)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to retrieve exchange rates")
}
