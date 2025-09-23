import os from "os"
import type Database from "better-sqlite3"

import { withTransaction } from "@/lib/db"
import { listSettingRows, setSettingRow } from "@/lib/settings/repository"
import type {
  AppSettings,
  AppSettingsPayload,
  BackupFrequency,
  CurrencyConversionMode,
  UpdateSettingsInput,
} from "@/lib/settings/types"
import {
  DEFAULT_BASE_CURRENCY,
  convertCurrency,
  ensureKnownCurrencies,
  normalizeCurrencyCode,
  normalizeRates,
  retryFetchLiveRates,
  roundAmount,
} from "@/lib/currency/service"

const DEFAULT_DATE_FORMAT = "yyyy-MM-dd"
const RATE_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6 // 6 hours

const DEFAULT_SETTINGS: AppSettings = {
  allowLanSync: true,
  allowAutomaticBackups: false,
  autoBackupFrequency: "weekly",
  backupRetentionDays: 90,
  lastBackupAt: null,
  lastSuccessfulSyncAt: null,
  baseCurrency: DEFAULT_BASE_CURRENCY,
  dateFormat: DEFAULT_DATE_FORMAT,
  currencyConversionMode: "manual",
  allowCurrencyRateUpdates: false,
  currencyRates: { [DEFAULT_BASE_CURRENCY]: 1 },
  currencyRatesUpdatedAt: null,
  knownCurrencies: [DEFAULT_BASE_CURRENCY],
}

const SETTING_KEYS = {
  allowLanSync: "lan.allow",
  allowAutomaticBackups: "backup.enabled",
  autoBackupFrequency: "backup.frequency",
  backupRetentionDays: "backup.retentionDays",
  lastBackupAt: "backup.lastRunAt",
  lastSuccessfulSyncAt: "sync.lastSuccessfulAt",
  baseCurrency: "currency.base",
  dateFormat: "format.date",
  currencyConversionMode: "currency.mode",
  allowCurrencyRateUpdates: "currency.allowUpdates",
  currencyRates: "currency.rates",
  currencyRatesUpdatedAt: "currency.ratesUpdatedAt",
  knownCurrencies: "currency.known",
} as const

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

type SettingValue = boolean | number | string | null | Record<string, unknown> | unknown[]

function parseJson(value: string): SettingValue {
  try {
    return JSON.parse(value) as SettingValue
  } catch {
    return value as SettingValue
  }
}

function ensureBoolean(value: SettingValue, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }
  if (typeof value === "number") {
    return value !== 0
  }
  return fallback
}

function ensureNumber(value: SettingValue, fallback: number): number {
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

function ensureFrequency(value: SettingValue, fallback: BackupFrequency): BackupFrequency {
  if (typeof value === "string") {
    if (["off", "daily", "weekly", "monthly"].includes(value)) {
      return value as BackupFrequency
    }
  }
  return fallback
}

function ensureIsoString(value: SettingValue): string | null {
  if (typeof value === "string" && !Number.isNaN(new Date(value).getTime())) {
    return value
  }
  return null
}

function ensureString(value: SettingValue, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return fallback
}

function ensureCurrencyMode(value: SettingValue, fallback: CurrencyConversionMode): CurrencyConversionMode {
  if (typeof value === "string") {
    const normalized = value.toLowerCase()
    if (normalized === "manual" || normalized === "automatic") {
      return normalized as CurrencyConversionMode
    }
  }
  return fallback
}

function ensureStringArray(value: SettingValue, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const filtered = value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
    if (filtered.length > 0) {
      return filtered
    }
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  return [...fallback]
}

function ensureCurrencyRates(
  value: SettingValue,
  baseCurrency: string,
  fallback: Record<string, number>,
): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const result: Record<string, number> = {}
    for (const [key, raw] of Object.entries(value)) {
      const numeric = ensureNumber(raw as SettingValue, Number.NaN)
      if (!Number.isNaN(numeric) && numeric > 0) {
        result[key] = numeric
      }
    }
    if (Object.keys(result).length > 0) {
      return normalizeRates(baseCurrency, result)
    }
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>
      return ensureCurrencyRates(parsed, baseCurrency, fallback)
    } catch {
      // ignore parse errors and fall back
    }
  }
  return normalizeRates(baseCurrency, fallback)
}

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (!entry) continue
      if (entry.family === "IPv4" && !entry.internal && entry.address) {
        return entry.address
      }
    }
  }
  return "127.0.0.1"
}

function resolveSyncHost(): string {
  const configured = process.env.SYNC_HOST?.trim()
  if (configured) {
    return configured
  }
  const ip = getLocalIpAddress()
  const port = process.env.PORT ?? "3000"
  return `http://${ip}:${port}`
}

function mapSettings(rows: Awaited<ReturnType<typeof listSettingRows>>): Record<SettingKey, SettingValue> {
  const map = new Map<string, SettingValue>()
  for (const row of rows) {
    map.set(row.key, parseJson(row.value))
  }
  return {
    [SETTING_KEYS.allowLanSync]: map.get(SETTING_KEYS.allowLanSync) ?? DEFAULT_SETTINGS.allowLanSync,
    [SETTING_KEYS.allowAutomaticBackups]:
      map.get(SETTING_KEYS.allowAutomaticBackups) ?? DEFAULT_SETTINGS.allowAutomaticBackups,
    [SETTING_KEYS.autoBackupFrequency]:
      map.get(SETTING_KEYS.autoBackupFrequency) ?? DEFAULT_SETTINGS.autoBackupFrequency,
    [SETTING_KEYS.backupRetentionDays]:
      map.get(SETTING_KEYS.backupRetentionDays) ?? DEFAULT_SETTINGS.backupRetentionDays,
    [SETTING_KEYS.lastBackupAt]: map.get(SETTING_KEYS.lastBackupAt) ?? DEFAULT_SETTINGS.lastBackupAt,
    [SETTING_KEYS.lastSuccessfulSyncAt]:
      map.get(SETTING_KEYS.lastSuccessfulSyncAt) ?? DEFAULT_SETTINGS.lastSuccessfulSyncAt,
    [SETTING_KEYS.baseCurrency]: map.get(SETTING_KEYS.baseCurrency) ?? DEFAULT_SETTINGS.baseCurrency,
    [SETTING_KEYS.dateFormat]: map.get(SETTING_KEYS.dateFormat) ?? DEFAULT_SETTINGS.dateFormat,
    [SETTING_KEYS.currencyConversionMode]:
      map.get(SETTING_KEYS.currencyConversionMode) ?? DEFAULT_SETTINGS.currencyConversionMode,
    [SETTING_KEYS.allowCurrencyRateUpdates]:
      map.get(SETTING_KEYS.allowCurrencyRateUpdates) ?? DEFAULT_SETTINGS.allowCurrencyRateUpdates,
    [SETTING_KEYS.currencyRates]: map.get(SETTING_KEYS.currencyRates) ?? DEFAULT_SETTINGS.currencyRates,
    [SETTING_KEYS.currencyRatesUpdatedAt]:
      map.get(SETTING_KEYS.currencyRatesUpdatedAt) ?? DEFAULT_SETTINGS.currencyRatesUpdatedAt,
    [SETTING_KEYS.knownCurrencies]: map.get(SETTING_KEYS.knownCurrencies) ?? DEFAULT_SETTINGS.knownCurrencies,
  } as Record<SettingKey, SettingValue>
}

function recalculateTransactionAmounts(
  db: Database,
  baseCurrency: string,
  rates: Record<string, number>,
): void {
  const accounts = db
    .prepare("SELECT name, currency FROM accounts")
    .all() as Array<{ name: string; currency: string | null }>
  const accountCurrencyMap = new Map<string, string>()
  for (const account of accounts) {
    const key = account.name.toLowerCase()
    const currency = normalizeCurrencyCode(account.currency ?? baseCurrency)
    accountCurrencyMap.set(key, currency)
  }

  const transactions = db
    .prepare("SELECT id, originalAmount, currency, account FROM transactions")
    .all() as Array<{ id: string; originalAmount: number | null; currency: string | null; account: string }>

  const updateStatement = db.prepare(
    `UPDATE transactions
       SET amount = @amount,
           exchangeRate = @exchangeRate,
           accountAmount = @accountAmount
     WHERE id = @id`,
  )

  for (const transaction of transactions) {
    const original = Number(transaction.originalAmount ?? 0)
    if (!Number.isFinite(original)) {
      continue
    }
    const transactionCurrency = normalizeCurrencyCode(transaction.currency ?? baseCurrency)

    let exchangeRate = 1
    try {
      exchangeRate = convertCurrency(1, transactionCurrency, baseCurrency, rates)
    } catch {
      exchangeRate = 1
    }
    const amount = roundAmount(original * exchangeRate, 2)

    const accountCurrency = accountCurrencyMap.get(transaction.account.toLowerCase()) ?? baseCurrency
    let accountExchangeRate = 1
    try {
      accountExchangeRate = convertCurrency(1, transactionCurrency, accountCurrency, rates)
    } catch {
      accountExchangeRate = exchangeRate
    }
    const accountAmount = roundAmount(original * accountExchangeRate, 2)

    updateStatement.run({
      id: transaction.id,
      amount,
      exchangeRate,
      accountAmount,
    })
  }
}

export async function getAppSettings(): Promise<AppSettingsPayload> {
  const rows = await listSettingRows()
  const mapped = mapSettings(rows)
  const baseCurrency = normalizeCurrencyCode(
    ensureString(mapped[SETTING_KEYS.baseCurrency], DEFAULT_SETTINGS.baseCurrency) || DEFAULT_BASE_CURRENCY,
  )
  const dateFormat = ensureString(mapped[SETTING_KEYS.dateFormat], DEFAULT_SETTINGS.dateFormat)
  const conversionMode = ensureCurrencyMode(
    mapped[SETTING_KEYS.currencyConversionMode],
    DEFAULT_SETTINGS.currencyConversionMode,
  )
  const allowRateUpdates = ensureBoolean(
    mapped[SETTING_KEYS.allowCurrencyRateUpdates],
    DEFAULT_SETTINGS.allowCurrencyRateUpdates,
  )
  const rates = ensureCurrencyRates(mapped[SETTING_KEYS.currencyRates], baseCurrency, DEFAULT_SETTINGS.currencyRates)
  const knownCurrencies = ensureKnownCurrencies(
    baseCurrency,
    ensureStringArray(mapped[SETTING_KEYS.knownCurrencies], DEFAULT_SETTINGS.knownCurrencies).concat(
      Object.keys(rates),
    ),
  )

  const settings: AppSettings = {
    allowLanSync: ensureBoolean(mapped[SETTING_KEYS.allowLanSync], DEFAULT_SETTINGS.allowLanSync),
    allowAutomaticBackups: ensureBoolean(
      mapped[SETTING_KEYS.allowAutomaticBackups],
      DEFAULT_SETTINGS.allowAutomaticBackups,
    ),
    autoBackupFrequency: ensureFrequency(
      mapped[SETTING_KEYS.autoBackupFrequency],
      DEFAULT_SETTINGS.autoBackupFrequency,
    ),
    backupRetentionDays: ensureNumber(
      mapped[SETTING_KEYS.backupRetentionDays],
      DEFAULT_SETTINGS.backupRetentionDays,
    ),
    lastBackupAt: ensureIsoString(mapped[SETTING_KEYS.lastBackupAt]),
    lastSuccessfulSyncAt: ensureIsoString(mapped[SETTING_KEYS.lastSuccessfulSyncAt]),
    baseCurrency,
    dateFormat,
    currencyConversionMode: conversionMode,
    allowCurrencyRateUpdates: allowRateUpdates,
    currencyRates: rates,
    currencyRatesUpdatedAt: ensureIsoString(mapped[SETTING_KEYS.currencyRatesUpdatedAt]),
    knownCurrencies,
  }

  return { ...settings, syncHost: resolveSyncHost() }
}

export async function updateAppSettings(update: UpdateSettingsInput): Promise<AppSettingsPayload> {
  const current = await getAppSettings()
  const nextBaseCurrency = normalizeCurrencyCode(
    update.baseCurrency ?? current.baseCurrency ?? DEFAULT_BASE_CURRENCY,
  )
  const nextDateFormat = update.dateFormat ? update.dateFormat : current.dateFormat
  const nextConversionMode = update.currencyConversionMode ?? current.currencyConversionMode
  const nextAllowRateUpdates = update.allowCurrencyRateUpdates ?? current.allowCurrencyRateUpdates

  let nextRates: Record<string, number>
  let ratesUpdatedAt = update.currencyRatesUpdatedAt ?? current.currencyRatesUpdatedAt
  let shouldRecalculate = false

  if (update.currencyRates) {
    nextRates = normalizeRates(nextBaseCurrency, update.currencyRates)
    shouldRecalculate = true
    if (update.currencyRatesUpdatedAt === undefined) {
      ratesUpdatedAt = new Date().toISOString()
    }
  } else if (nextBaseCurrency !== current.baseCurrency) {
    const divisor = current.currencyRates[nextBaseCurrency] ?? 1
    const adjusted: Record<string, number> = {}
    for (const [code, value] of Object.entries(current.currencyRates)) {
      adjusted[code] = divisor !== 0 ? value / divisor : value
    }
    nextRates = normalizeRates(nextBaseCurrency, adjusted)
    shouldRecalculate = true
  } else {
    nextRates = normalizeRates(nextBaseCurrency, current.currencyRates)
  }

  const nextKnown = ensureKnownCurrencies(
    nextBaseCurrency,
    (update.knownCurrencies ?? current.knownCurrencies).concat(Object.keys(nextRates)),
  )

  await withTransaction(async (db) => {
    if (update.allowLanSync !== undefined && update.allowLanSync !== current.allowLanSync) {
      await setSettingRow(SETTING_KEYS.allowLanSync, update.allowLanSync, { db })
    }
    if (
      update.allowAutomaticBackups !== undefined &&
      update.allowAutomaticBackups !== current.allowAutomaticBackups
    ) {
      await setSettingRow(SETTING_KEYS.allowAutomaticBackups, update.allowAutomaticBackups, { db })
    }
    if (update.autoBackupFrequency && update.autoBackupFrequency !== current.autoBackupFrequency) {
      await setSettingRow(SETTING_KEYS.autoBackupFrequency, update.autoBackupFrequency, { db })
    }
    if (
      update.backupRetentionDays !== undefined &&
      update.backupRetentionDays !== current.backupRetentionDays
    ) {
      const value = Math.max(7, Math.min(365, Math.round(update.backupRetentionDays)))
      await setSettingRow(SETTING_KEYS.backupRetentionDays, value, { db })
    }
    if (update.lastBackupAt !== undefined) {
      await setSettingRow(SETTING_KEYS.lastBackupAt, update.lastBackupAt, {
        db,
        updatedAt: update.lastBackupAt ?? undefined,
      })
    }
    if (update.lastSuccessfulSyncAt !== undefined) {
      await setSettingRow(SETTING_KEYS.lastSuccessfulSyncAt, update.lastSuccessfulSyncAt, {
        db,
        updatedAt: update.lastSuccessfulSyncAt ?? undefined,
      })
    }

    if (nextBaseCurrency !== current.baseCurrency) {
      await setSettingRow(SETTING_KEYS.baseCurrency, nextBaseCurrency, { db })
    }
    if (nextDateFormat !== current.dateFormat) {
      await setSettingRow(SETTING_KEYS.dateFormat, nextDateFormat, { db })
    }
    if (nextConversionMode !== current.currencyConversionMode) {
      await setSettingRow(SETTING_KEYS.currencyConversionMode, nextConversionMode, { db })
    }
    if (nextAllowRateUpdates !== current.allowCurrencyRateUpdates) {
      await setSettingRow(SETTING_KEYS.allowCurrencyRateUpdates, nextAllowRateUpdates, { db })
    }

    await setSettingRow(SETTING_KEYS.currencyRates, nextRates, { db })
    await setSettingRow(SETTING_KEYS.knownCurrencies, nextKnown, { db })

    if (ratesUpdatedAt !== undefined && ratesUpdatedAt !== current.currencyRatesUpdatedAt) {
      await setSettingRow(SETTING_KEYS.currencyRatesUpdatedAt, ratesUpdatedAt, {
        db,
        updatedAt: ratesUpdatedAt ?? undefined,
      })
    }

    if (shouldRecalculate) {
      recalculateTransactionAmounts(db, nextBaseCurrency, nextRates)
    }
  })

  return getAppSettings()
}

export async function markBackupCompleted(timestamp = new Date().toISOString()): Promise<void> {
  await setSettingRow(SETTING_KEYS.lastBackupAt, timestamp, { updatedAt: timestamp })
}

export async function markSyncCompleted(timestamp = new Date().toISOString()): Promise<void> {
  await setSettingRow(SETTING_KEYS.lastSuccessfulSyncAt, timestamp, { updatedAt: timestamp })
}

interface RefreshOptions {
  currencies?: string[]
  force?: boolean
}

function shouldAttemptRateRefresh(settings: AppSettings, desiredCurrencies: string[], force?: boolean): boolean {
  if (!settings.allowCurrencyRateUpdates || settings.currencyConversionMode !== "automatic") {
    return false
  }

  if (force) {
    return true
  }

  const lastUpdated = settings.currencyRatesUpdatedAt
    ? new Date(settings.currencyRatesUpdatedAt).getTime()
    : 0
  const age = lastUpdated > 0 ? Date.now() - lastUpdated : Number.POSITIVE_INFINITY
  if (Number.isNaN(age) || age > RATE_REFRESH_INTERVAL_MS) {
    return true
  }

  for (const currency of desiredCurrencies) {
    if (!settings.currencyRates[currency]) {
      return true
    }
  }

  return false
}

export async function ensureFreshCurrencyRates(options: RefreshOptions = {}): Promise<AppSettingsPayload> {
  const current = await getAppSettings()
  const desired = ensureKnownCurrencies(
    current.baseCurrency,
    current.knownCurrencies.concat(options.currencies ?? []),
  )

  if (!shouldAttemptRateRefresh(current, desired, options.force)) {
    if (desired.length !== current.knownCurrencies.length) {
      return updateAppSettings({ knownCurrencies: desired })
    }
    return current
  }

  try {
    const { rates, fetchedAt } = await retryFetchLiveRates(current.baseCurrency, desired)
    return updateAppSettings({
      currencyRates: rates,
      currencyRatesUpdatedAt: fetchedAt,
      knownCurrencies: desired,
    })
  } catch (error) {
    console.warn("Unable to refresh exchange rates", error)
    if (desired.length !== current.knownCurrencies.length) {
      return updateAppSettings({ knownCurrencies: desired })
    }
    return current
  }
}

export const SETTINGS_KEYS_MAP = SETTING_KEYS

export async function ensureCurrencyTracked(currency: string): Promise<void> {
  const normalized = normalizeCurrencyCode(currency)
  if (!normalized) {
    return
  }
  const settings = await getAppSettings()
  if (settings.knownCurrencies.includes(normalized)) {
    if (!settings.currencyRates[normalized]) {
      await ensureFreshCurrencyRates({ currencies: [normalized], force: true })
    }
    return
  }
  const updatedKnown = ensureKnownCurrencies(settings.baseCurrency, [
    ...settings.knownCurrencies,
    normalized,
  ])
  await updateAppSettings({ knownCurrencies: updatedKnown })
  await ensureFreshCurrencyRates({ currencies: [normalized], force: true })
}
