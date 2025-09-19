export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD"

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"

export type ThemePreference = "light" | "dark" | "system"

export type StartOfWeek = "Sunday" | "Monday"

export type BackupFrequency = "off" | "daily" | "weekly" | "monthly"

export interface GeneralSettings {
  currency: CurrencyCode
  dateFormat: DateFormat
  theme: ThemePreference
  fiscalYearStartMonth: string
  startOfWeek: StartOfWeek
  language: string
  autoCategorizeTransactions: boolean
  showRoundedTotals: boolean
}

export interface NotificationSettings {
  budgetAlerts: boolean
  weeklyReports: boolean
  monthlyReports: boolean
  transactionReminders: boolean
  securityAlerts: boolean
  productUpdates: boolean
}

export interface PrivacySettings {
  dataEncryption: boolean
  autoBackup: boolean
  shareAnalytics: boolean
  rememberDevices: boolean
  requireMfa: boolean
}

export type AccountType = "Checking" | "Savings" | "Credit Card" | "Investment" | "Loan" | "Cash"

export type AccountStatus = "connected" | "disconnected" | "error"

export interface ConnectedAccount {
  id: string
  name: string
  institution: string
  type: AccountType
  status: AccountStatus
  autoSync: boolean
  balance: number
  currency: CurrencyCode
  lastSyncAt: string
  createdAt: string
  updatedAt: string
}

export interface CsvTemplate {
  id: string
  name: string
  description?: string
  columns: string[]
  delimiter: string
  hasHeaders: boolean
  dateColumn: string
  amountColumn: string
  descriptionColumn: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type BackupType = "automatic" | "manual"

export interface BackupRecord {
  id: string
  createdAt: string
  size: number
  type: BackupType
  notes?: string
}

export interface BackupSettings {
  history: BackupRecord[]
  autoBackupFrequency: BackupFrequency
  retentionDays: number
  lastBackupAt?: string | null
}

export interface SettingsMetadata {
  updatedAt: string
}

export interface SettingsData {
  general: GeneralSettings
  notifications: NotificationSettings
  privacy: PrivacySettings
  dataSources: {
    connectedAccounts: ConnectedAccount[]
    csvTemplates: CsvTemplate[]
  }
  backups: BackupSettings
  metadata: SettingsMetadata
}

export type UpdateSettingsInput = Partial<{
  general: Partial<GeneralSettings>
  notifications: Partial<NotificationSettings>
  privacy: Partial<PrivacySettings>
  backups: Partial<Pick<BackupSettings, "autoBackupFrequency" | "retentionDays">>
}>

export interface CreateConnectedAccountInput {
  name: string
  institution: string
  type: AccountType
  currency: CurrencyCode
  autoSync?: boolean
  balance?: number
}

export interface UpdateConnectedAccountInput {
  name?: string
  institution?: string
  type?: AccountType
  status?: AccountStatus
  autoSync?: boolean
  currency?: CurrencyCode
  balance?: number
}

export interface CreateCsvTemplateInput {
  name: string
  description?: string
  columns: string[]
  delimiter: string
  hasHeaders: boolean
  dateColumn: string
  amountColumn: string
  descriptionColumn: string
  active?: boolean
}

export interface UpdateCsvTemplateInput {
  name?: string
  description?: string
  columns?: string[]
  delimiter?: string
  hasHeaders?: boolean
  dateColumn?: string
  amountColumn?: string
  descriptionColumn?: string
  active?: boolean
}

export interface CreateBackupInput {
  notes?: string
  size?: number
  type: BackupType
}
