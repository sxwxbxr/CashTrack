import { promises as fs } from "fs"
import path from "path"
import type {
  ConnectedAccount,
  CsvTemplate,
  SettingsData,
  BackupRecord,
} from "@/lib/settings/types"

const DATA_DIRECTORY = path.join(process.cwd(), "data")
const SETTINGS_FILE = path.join(DATA_DIRECTORY, "settings.json")

const DEFAULT_SETTINGS = JSON.stringify(
  {
    general: {
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      theme: "system",
      fiscalYearStartMonth: "January",
      startOfWeek: "Sunday",
      language: "en-US",
      autoCategorizeTransactions: true,
      showRoundedTotals: false,
    },
    notifications: {
      budgetAlerts: true,
      weeklyReports: true,
      monthlyReports: true,
      transactionReminders: false,
      securityAlerts: true,
      productUpdates: false,
    },
    privacy: {
      dataEncryption: true,
      autoBackup: true,
      shareAnalytics: false,
      rememberDevices: true,
      requireMfa: true,
    },
    dataSources: {
      connectedAccounts: [],
      csvTemplates: [],
    },
    backups: {
      history: [],
      autoBackupFrequency: "weekly",
      retentionDays: 90,
      lastBackupAt: null,
    },
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  },
  null,
  2,
)

async function ensureSettingsFile() {
  try {
    await fs.access(SETTINGS_FILE)
  } catch {
    await fs.mkdir(DATA_DIRECTORY, { recursive: true })
    await fs.writeFile(SETTINGS_FILE, DEFAULT_SETTINGS, "utf8")
  }
}

function sanitizeAccount(account: ConnectedAccount): ConnectedAccount {
  return {
    ...account,
    balance: Number(account.balance) || 0,
    autoSync: Boolean(account.autoSync),
    lastSyncAt: account.lastSyncAt ?? new Date().toISOString(),
    createdAt: account.createdAt ?? new Date().toISOString(),
    updatedAt: account.updatedAt ?? new Date().toISOString(),
  }
}

function sanitizeTemplate(template: CsvTemplate): CsvTemplate {
  return {
    ...template,
    columns: Array.isArray(template.columns) ? template.columns : [],
    delimiter: template.delimiter ?? ",",
    hasHeaders: Boolean(template.hasHeaders ?? true),
    active: Boolean(template.active ?? true),
    createdAt: template.createdAt ?? new Date().toISOString(),
    updatedAt: template.updatedAt ?? new Date().toISOString(),
  }
}

function sanitizeBackup(backup: BackupRecord): BackupRecord {
  return {
    ...backup,
    size: Number(backup.size) || 0,
    createdAt: backup.createdAt ?? new Date().toISOString(),
  }
}

export async function readSettings(): Promise<SettingsData> {
  await ensureSettingsFile()
  const contents = await fs.readFile(SETTINGS_FILE, "utf8")
  const parsed = JSON.parse(contents) as SettingsData
  return {
    ...parsed,
    dataSources: {
      connectedAccounts: Array.isArray(parsed.dataSources?.connectedAccounts)
        ? parsed.dataSources.connectedAccounts.map(sanitizeAccount)
        : [],
      csvTemplates: Array.isArray(parsed.dataSources?.csvTemplates)
        ? parsed.dataSources.csvTemplates.map(sanitizeTemplate)
        : [],
    },
    backups: {
      history: Array.isArray(parsed.backups?.history)
        ? parsed.backups.history.map(sanitizeBackup)
        : [],
      autoBackupFrequency: parsed.backups?.autoBackupFrequency ?? "weekly",
      retentionDays: Number(parsed.backups?.retentionDays) || 90,
      lastBackupAt: parsed.backups?.lastBackupAt ?? null,
    },
    metadata: {
      updatedAt: parsed.metadata?.updatedAt ?? new Date().toISOString(),
    },
  }
}

export async function writeSettings(settings: SettingsData) {
  await ensureSettingsFile()
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8")
}
