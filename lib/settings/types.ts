export type BackupFrequency = "off" | "daily" | "weekly" | "monthly"

export interface AppSettings {
  /** Whether LAN sync endpoints should accept authenticated requests from the household */
  allowLanSync: boolean
  /** Whether automatic backups are enabled on this device */
  allowAutomaticBackups: boolean
  /** How often automatic backups should run */
  autoBackupFrequency: BackupFrequency
  /** Number of days to keep automatic backups before pruning */
  backupRetentionDays: number
  /** Timestamp of the most recent automatic or manual backup */
  lastBackupAt: string | null
  /** Timestamp of the most recent successful pull/push sync */
  lastSuccessfulSyncAt: string | null
  /** Preferred base currency used for reports and conversions */
  baseCurrency: string
  /** Preferred display format for dates */
  dateFormat: string
  /** Whether conversion rates should be handled manually or automatically */
  currencyConversionMode: CurrencyConversionMode
  /** Whether the household allows live exchange rate updates */
  allowCurrencyRateUpdates: boolean
  /** Cached exchange rates keyed by currency code */
  currencyRates: Record<string, number>
  /** Timestamp of the most recent exchange rate refresh */
  currencyRatesUpdatedAt: string | null
  /** Known currencies referenced by accounts or transactions */
  knownCurrencies: string[]
}

export interface AppSettingsPayload extends AppSettings {
  /** Resolved LAN discovery host shown in the UI */
  syncHost: string
}

export type UpdateSettingsInput = Partial<{
  allowLanSync: boolean
  allowAutomaticBackups: boolean
  autoBackupFrequency: BackupFrequency
  backupRetentionDays: number
  lastBackupAt: string | null
  lastSuccessfulSyncAt: string | null
  baseCurrency: string
  dateFormat: string
  currencyConversionMode: CurrencyConversionMode
  allowCurrencyRateUpdates: boolean
  currencyRates: Record<string, number>
  currencyRatesUpdatedAt: string | null
  knownCurrencies: string[]
}>

export type CurrencyConversionMode = "manual" | "automatic"
