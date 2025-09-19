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
}>
