import { randomUUID } from "crypto"
import {
  readSettings,
  writeSettings,
} from "@/lib/settings/storage"
import type {
  ConnectedAccount,
  CsvTemplate,
  SettingsData,
  UpdateSettingsInput,
  CreateConnectedAccountInput,
  UpdateConnectedAccountInput,
  CreateCsvTemplateInput,
  UpdateCsvTemplateInput,
  CreateBackupInput,
  BackupRecord,
} from "@/lib/settings/types"

function updateMetadata(settings: SettingsData): SettingsData {
  return {
    ...settings,
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  }
}

function sanitizeBalance(value?: number): number {
  if (value === undefined || value === null) {
    return 0
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.round(numeric * 100) / 100
}

function sanitizeColumns(columns: string[]): string[] {
  return columns.map((column) => column.trim()).filter((column) => column.length > 0)
}

function clampRetentionDays(value?: number): number {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return 90
  }
  const numeric = Math.round(Number(value))
  return Math.min(365, Math.max(7, numeric))
}

function sortAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return [...accounts].sort((a, b) => a.name.localeCompare(b.name))
}

function sortTemplates(templates: CsvTemplate[]): CsvTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name))
}

function sortBackups(backups: BackupRecord[]): BackupRecord[] {
  return [...backups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getSettings(): Promise<SettingsData> {
  return readSettings()
}

export async function updateSettingsSections(input: UpdateSettingsInput): Promise<SettingsData> {
  const settings = await readSettings()

  const next: SettingsData = {
    ...settings,
    general: input.general ? { ...settings.general, ...input.general } : settings.general,
    notifications: input.notifications
      ? { ...settings.notifications, ...input.notifications }
      : settings.notifications,
    privacy: input.privacy ? { ...settings.privacy, ...input.privacy } : settings.privacy,
    backups: input.backups
      ? {
          ...settings.backups,
          ...input.backups,
          ...(input.backups.retentionDays !== undefined
            ? { retentionDays: clampRetentionDays(input.backups.retentionDays) }
            : {}),
        }
      : settings.backups,
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return updated
}

export async function createConnectedAccount(
  input: CreateConnectedAccountInput,
): Promise<{ account: ConnectedAccount; settings: SettingsData }> {
  const settings = await readSettings()

  const name = input.name.trim()
  const institution = input.institution.trim()

  if (!name) {
    throw new Error("Account name is required")
  }

  if (!institution) {
    throw new Error("Institution is required")
  }

  const now = new Date().toISOString()

  const account: ConnectedAccount = {
    id: `acct_${randomUUID()}`,
    name,
    institution,
    type: input.type,
    status: "connected",
    autoSync: input.autoSync ?? true,
    balance: sanitizeBalance(input.balance),
    currency: input.currency,
    lastSyncAt: now,
    createdAt: now,
    updatedAt: now,
  }

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: sortAccounts([...settings.dataSources.connectedAccounts, account]),
      csvTemplates: settings.dataSources.csvTemplates,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { account, settings: updated }
}

export async function updateConnectedAccount(
  id: string,
  updates: UpdateConnectedAccountInput,
): Promise<{ account: ConnectedAccount; settings: SettingsData }> {
  const settings = await readSettings()
  const index = settings.dataSources.connectedAccounts.findIndex((account) => account.id === id)

  if (index === -1) {
    throw new Error("Account not found")
  }

  const existing = settings.dataSources.connectedAccounts[index]

  const name = typeof updates.name === "string" ? updates.name.trim() : existing.name
  const institution =
    typeof updates.institution === "string" ? updates.institution.trim() : existing.institution

  if (!name) {
    throw new Error("Account name is required")
  }

  if (!institution) {
    throw new Error("Institution is required")
  }

  const updatedAccount: ConnectedAccount = {
    ...existing,
    ...updates,
    name,
    institution,
    balance:
      updates.balance !== undefined ? sanitizeBalance(updates.balance) : existing.balance,
    autoSync: updates.autoSync ?? existing.autoSync,
    updatedAt: new Date().toISOString(),
  }

  const nextAccounts = [...settings.dataSources.connectedAccounts]
  nextAccounts[index] = updatedAccount

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: sortAccounts(nextAccounts),
      csvTemplates: settings.dataSources.csvTemplates,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { account: updatedAccount, settings: updated }
}

export async function removeConnectedAccount(
  id: string,
): Promise<{ settings: SettingsData }> {
  const settings = await readSettings()
  const accounts = settings.dataSources.connectedAccounts.filter((account) => account.id !== id)

  if (accounts.length === settings.dataSources.connectedAccounts.length) {
    throw new Error("Account not found")
  }

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: sortAccounts(accounts),
      csvTemplates: settings.dataSources.csvTemplates,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { settings: updated }
}

export async function syncConnectedAccount(
  id: string,
): Promise<{ account: ConnectedAccount; settings: SettingsData }> {
  const settings = await readSettings()
  const account = settings.dataSources.connectedAccounts.find((item) => item.id === id)

  if (!account) {
    throw new Error("Account not found")
  }

  const updatedAccount: ConnectedAccount = {
    ...account,
    status: "connected",
    lastSyncAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const accounts = settings.dataSources.connectedAccounts.map((item) =>
    item.id === id ? updatedAccount : item,
  )

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: sortAccounts(accounts),
      csvTemplates: settings.dataSources.csvTemplates,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { account: updatedAccount, settings: updated }
}

export async function createCsvTemplate(
  input: CreateCsvTemplateInput,
): Promise<{ template: CsvTemplate; settings: SettingsData }> {
  const settings = await readSettings()
  const name = input.name.trim()

  if (!name) {
    throw new Error("Template name is required")
  }

  const now = new Date().toISOString()

  const template: CsvTemplate = {
    id: `tmpl_${randomUUID()}`,
    name,
    description: input.description?.trim() || undefined,
    columns: sanitizeColumns(input.columns),
    delimiter: input.delimiter || ",",
    hasHeaders: input.hasHeaders,
    dateColumn: input.dateColumn.trim(),
    amountColumn: input.amountColumn.trim(),
    descriptionColumn: input.descriptionColumn.trim(),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  }

  if (!template.columns.length) {
    throw new Error("At least one column is required")
  }

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: settings.dataSources.connectedAccounts,
      csvTemplates: sortTemplates([...settings.dataSources.csvTemplates, template]),
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { template, settings: updated }
}

export async function updateCsvTemplate(
  id: string,
  updates: UpdateCsvTemplateInput,
): Promise<{ template: CsvTemplate; settings: SettingsData }> {
  const settings = await readSettings()
  const index = settings.dataSources.csvTemplates.findIndex((template) => template.id === id)

  if (index === -1) {
    throw new Error("Template not found")
  }

  const existing = settings.dataSources.csvTemplates[index]

  const updatedTemplate: CsvTemplate = {
    ...existing,
    ...updates,
    name: updates.name ? updates.name.trim() : existing.name,
    description: updates.description
      ? updates.description.trim() || undefined
      : existing.description,
    columns: updates.columns ? sanitizeColumns(updates.columns) : existing.columns,
    dateColumn: updates.dateColumn ? updates.dateColumn.trim() : existing.dateColumn,
    amountColumn: updates.amountColumn ? updates.amountColumn.trim() : existing.amountColumn,
    descriptionColumn: updates.descriptionColumn
      ? updates.descriptionColumn.trim()
      : existing.descriptionColumn,
    updatedAt: new Date().toISOString(),
  }

  if (!updatedTemplate.name) {
    throw new Error("Template name is required")
  }

  if (!updatedTemplate.columns.length) {
    throw new Error("At least one column is required")
  }

  const nextTemplates = [...settings.dataSources.csvTemplates]
  nextTemplates[index] = updatedTemplate

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: settings.dataSources.connectedAccounts,
      csvTemplates: sortTemplates(nextTemplates),
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { template: updatedTemplate, settings: updated }
}

export async function removeCsvTemplate(
  id: string,
): Promise<{ settings: SettingsData }> {
  const settings = await readSettings()
  const templates = settings.dataSources.csvTemplates.filter((template) => template.id !== id)

  if (templates.length === settings.dataSources.csvTemplates.length) {
    throw new Error("Template not found")
  }

  const next: SettingsData = {
    ...settings,
    dataSources: {
      ...settings.dataSources,
      connectedAccounts: settings.dataSources.connectedAccounts,
      csvTemplates: sortTemplates(templates),
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { settings: updated }
}

export async function createBackup(
  input: Omit<CreateBackupInput, "type"> & { type?: CreateBackupInput["type"] },
): Promise<{ backup: BackupRecord; settings: SettingsData }> {
  const settings = await readSettings()
  const now = new Date().toISOString()
  const size = sanitizeBalance(input.size ?? 0) || Number((Math.random() * 0.8 + 1.8).toFixed(2))

  const backup: BackupRecord = {
    id: `bkp_${randomUUID()}`,
    createdAt: now,
    size,
    type: input.type ?? "manual",
    notes: input.notes?.trim() || undefined,
  }

  const nextHistory = sortBackups([backup, ...settings.backups.history])

  const next: SettingsData = {
    ...settings,
    backups: {
      ...settings.backups,
      history: nextHistory,
      lastBackupAt: now,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { backup, settings: updated }
}

export async function removeBackup(id: string): Promise<{ settings: SettingsData }> {
  const settings = await readSettings()
  const history = settings.backups.history.filter((backup) => backup.id !== id)

  if (history.length === settings.backups.history.length) {
    throw new Error("Backup not found")
  }

  const next: SettingsData = {
    ...settings,
    backups: {
      ...settings.backups,
      history,
    },
  }

  const updated = updateMetadata(next)
  await writeSettings(updated)
  return { settings: updated }
}
