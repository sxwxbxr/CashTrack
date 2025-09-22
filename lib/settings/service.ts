import os from "os"

import { listSettingRows, setSettingRow } from "@/lib/settings/repository"
import type {
  AppSettings,
  AppSettingsPayload,
  BackupFrequency,
  CurrencyCode,
  DateFormat,
  UpdateSettingsInput,
} from "@/lib/settings/types"
import { DATE_FORMATS } from "@/lib/settings/types"
import { withTransaction } from "@/lib/db"

const DEFAULT_SETTINGS: AppSettings = {
  allowLanSync: true,
  allowAutomaticBackups: false,
  autoBackupFrequency: "weekly",
  backupRetentionDays: 90,
  lastBackupAt: null,
  lastSuccessfulSyncAt: null,
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
}

const SETTING_KEYS = {
  allowLanSync: "lan.allow",
  allowAutomaticBackups: "backup.enabled",
  autoBackupFrequency: "backup.frequency",
  backupRetentionDays: "backup.retentionDays",
  lastBackupAt: "backup.lastRunAt",
  lastSuccessfulSyncAt: "sync.lastSuccessfulAt",
  currency: "general.currency",
  dateFormat: "general.dateFormat",
} as const

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

type SettingValue = boolean | number | string | null

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

function ensureCurrency(value: SettingValue, fallback: CurrencyCode): CurrencyCode {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(normalized)) {
      return normalized
    }
  }
  return fallback
}

function ensureDateFormat(value: SettingValue, fallback: DateFormat): DateFormat {
  if (typeof value === "string") {
    const normalized = value.trim() as DateFormat
    if ((DATE_FORMATS as readonly string[]).includes(normalized)) {
      return normalized
    }
  }
  return fallback
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
    [SETTING_KEYS.currency]: map.get(SETTING_KEYS.currency) ?? DEFAULT_SETTINGS.currency,
    [SETTING_KEYS.dateFormat]: map.get(SETTING_KEYS.dateFormat) ?? DEFAULT_SETTINGS.dateFormat,
  } as Record<SettingKey, SettingValue>
}

export async function getAppSettings(): Promise<AppSettingsPayload> {
  const rows = await listSettingRows()
  const mapped = mapSettings(rows)
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
    currency: ensureCurrency(mapped[SETTING_KEYS.currency], DEFAULT_SETTINGS.currency),
    dateFormat: ensureDateFormat(mapped[SETTING_KEYS.dateFormat], DEFAULT_SETTINGS.dateFormat),
  }

  return { ...settings, syncHost: resolveSyncHost() }
}

export async function updateAppSettings(update: UpdateSettingsInput): Promise<AppSettingsPayload> {
  await withTransaction(async (db) => {
    if (update.allowLanSync !== undefined) {
      await setSettingRow(SETTING_KEYS.allowLanSync, update.allowLanSync, { db })
    }
    if (update.allowAutomaticBackups !== undefined) {
      await setSettingRow(SETTING_KEYS.allowAutomaticBackups, update.allowAutomaticBackups, { db })
    }
    if (update.autoBackupFrequency) {
      await setSettingRow(SETTING_KEYS.autoBackupFrequency, update.autoBackupFrequency, { db })
    }
    if (update.backupRetentionDays !== undefined) {
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
    if (update.currency !== undefined) {
      const value = update.currency.trim().toUpperCase()
      await setSettingRow(SETTING_KEYS.currency, value, { db })
    }
    if (update.dateFormat) {
      await setSettingRow(SETTING_KEYS.dateFormat, update.dateFormat, { db })
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

export const SETTINGS_KEYS_MAP = SETTING_KEYS
