"use client"

import { useCallback, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { AppSettingsPayload, BackupFrequency } from "@/lib/settings/types"
import type { SessionUser } from "@/lib/auth/session"
import { useTranslations } from "@/components/language-provider"

interface SettingsResponse {
  settings: AppSettingsPayload
  error?: unknown
}

interface SessionResponse {
  user?: SessionUser
}

interface HouseholdUser {
  id: string
  username: string
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

interface UsersApiResponse {
  users?: HouseholdUser[]
  error?: unknown
}

interface HouseholdActivity {
  id: string
  userId: string
  username: string
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface ActivityResponse {
  activities?: HouseholdActivity[]
  error?: unknown
}

function describeRelativeTime(iso: string | null): string {
  if (!iso) return "Never"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "Never"
  }
  return `${formatDistanceToNow(date, { addSuffix: true })}`
}

const activityCurrencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

function formatActionLabel(action: string): string {
  const [entityRaw, verbRaw] = action.split(".")
  if (!entityRaw || !verbRaw) {
    return action.replace(/[_-]/g, " ")
  }

  const verbMap: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    import: "Imported",
  }

  const verb = verbMap[verbRaw] ?? `${verbRaw.charAt(0).toUpperCase()}${verbRaw.slice(1)}`
  const entity = entityRaw
    .split(/[_-]/)
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
  return `${verb} ${entity}`.trim()
}

function summarizeActivityDetails(details: Record<string, unknown> | null): string[] {
  if (!details) return []

  const items: string[] = []

  if (typeof details.amount === "number") {
    items.push(`Amount: ${activityCurrencyFormatter.format(details.amount)}`)
  }

  if (typeof details.account === "string" && details.account) {
    items.push(`Account: ${details.account}`)
  }

  if (typeof details.username === "string" && details.username) {
    items.push(`Username: ${details.username}`)
  }

  if (typeof details.mustChangePassword === "boolean") {
    items.push(details.mustChangePassword ? "Password reset required" : "Password confirmed")
  }

  if (typeof details.imported === "number") {
    items.push(`Imported: ${details.imported}`)
  }

  if (typeof details.skipped === "number" && details.skipped > 0) {
    items.push(`Skipped: ${details.skipped}`)
  }

  if (details.changes && typeof details.changes === "object" && details.changes !== null) {
    const changeKeys = Object.keys(details.changes as Record<string, unknown>)
    if (changeKeys.length > 0) {
      items.push(`Fields: ${changeKeys.join(", ")}`)
    }
  }

  return items.slice(0, 3)
}

export default function SettingsPage() {
  const { t } = useTranslations()
  const [settings, setSettings] = useState<AppSettingsPayload | null>(null)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [themeReady, setThemeReady] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const [householdUsers, setHouseholdUsers] = useState<HouseholdUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [newUserName, setNewUserName] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserMustReset, setNewUserMustReset] = useState(true)
  const [newUserError, setNewUserError] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [activity, setActivity] = useState<HouseholdActivity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const isHouseholdAdmin = sessionUser?.username === "household"

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [settingsRes, sessionRes] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ])

        if (!cancelled) {
          if (settingsRes.ok) {
            const data = (await settingsRes.json()) as SettingsResponse
            setSettings(data.settings)
          } else {
            toast.error("Unable to load settings")
          }

          if (sessionRes.ok) {
            const data = (await sessionRes.json()) as SessionResponse
            setSessionUser(data.user ?? null)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          toast.error("Unable to load settings")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const fetchHouseholdUsers = useCallback(async () => {
    if (!isHouseholdAdmin) {
      return
    }

    setUsersLoading(true)
    setUsersError(null)
    try {
      const response = await fetch("/api/users", { cache: "no-store" })
      const body = (await response.json().catch(() => ({}))) as UsersApiResponse
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Unable to load accounts"
        throw new Error(message)
      }
      setHouseholdUsers(Array.isArray(body.users) ? body.users : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load accounts"
      setUsersError(message)
      toast.error("Unable to load accounts", { description: message })
    } finally {
      setUsersLoading(false)
    }
  }, [isHouseholdAdmin])

  const fetchHouseholdActivity = useCallback(async () => {
    if (!isHouseholdAdmin) {
      return
    }

    setActivityLoading(true)
    setActivityError(null)
    try {
      const response = await fetch("/api/activity?limit=25", { cache: "no-store" })
      const body = (await response.json().catch(() => ({}))) as ActivityResponse
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Unable to load activity"
        throw new Error(message)
      }
      setActivity(Array.isArray(body.activities) ? body.activities : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load activity"
      setActivityError(message)
      toast.error("Unable to load activity", { description: message })
    } finally {
      setActivityLoading(false)
    }
  }, [isHouseholdAdmin])

  useEffect(() => {
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!isHouseholdAdmin) {
      setHouseholdUsers([])
      setActivity([])
      setUsersError(null)
      setActivityError(null)
      return
    }

    fetchHouseholdUsers()
    fetchHouseholdActivity()
  }, [isHouseholdAdmin, fetchHouseholdUsers, fetchHouseholdActivity])

  const mutateSettings = async (patch: Partial<AppSettingsPayload>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateSettings = async (updates: Partial<AppSettingsPayload>) => {
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        throw new Error("Failed to update settings")
      }
      const data = (await response.json()) as SettingsResponse
      setSettings(data.settings)
      toast.success("Settings saved")
    } catch (error) {
      toast.error("Unable to save settings", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const handleCreateHouseholdUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isHouseholdAdmin || creatingUser) {
      return
    }

    const username = newUserName.trim()
    const password = newUserPassword.trim()

    if (!username || !password) {
      setNewUserError("Provide both a username and password")
      return
    }

    setCreatingUser(true)
    setNewUserError(null)
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          mustChangePassword: newUserMustReset,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { user?: HouseholdUser; error?: unknown }
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Unable to create account"
        throw new Error(message)
      }

      toast.success("Account created", {
        description: body.user?.username ? `${body.user.username} can now sign in.` : undefined,
      })
      setNewUserName("")
      setNewUserPassword("")
      setNewUserMustReset(true)
      await fetchHouseholdUsers()
      await fetchHouseholdActivity()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account"
      setNewUserError(message)
      toast.error("Unable to create account", { description: message })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch("/api/sync/export", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Unable to export data")
      }
      const snapshot = await response.json()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `cashtrack-backup-${new Date().toISOString()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("Backup exported")
    } catch (error) {
      toast.error("Export failed", { description: error instanceof Error ? error.message : undefined })
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/sync/import", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Import failed")
      }
      const data = (await response.json()) as { settings: AppSettingsPayload }
      toast.success("Backup restored")
      event.target.value = ""
      setSettings(data.settings)
    } catch (error) {
      toast.error("Import failed", { description: error instanceof Error ? error.message : undefined })
    }
  }

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordLoading(true)
    try {
      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Unable to update password"
        throw new Error(message)
      }
      setCurrentPassword("")
      setNewPassword("")
      toast.success("Password updated")
      setSessionUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
    } catch (error) {
      toast.error("Password update failed", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title={t("Settings")} description={t("Manage your CashTrack household preferences")}> 
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{t("Loading settings…")}</div>
      </AppLayout>
    )
  }

  if (!settings) {
    return (
      <AppLayout title={t("Settings")} description={t("Manage your CashTrack household preferences")}>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("Unable to load settings. Please refresh.")}
        </div>
      </AppLayout>
    )
  }

  const backupFrequency: BackupFrequency = settings.autoBackupFrequency
  const canToggleTheme = themeReady && typeof resolvedTheme === "string"

  return (
    <AppLayout
      title={t("Settings")}
      description={t("Manage household access, backups, and LAN sync for CashTrack")}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose between the light and dark interface.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium" htmlFor="dark-mode-toggle">
                Dark mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Switch the dashboard to a darker color palette.
              </p>
            </div>
            <Switch
              id="dark-mode-toggle"
              checked={canToggleTheme && resolvedTheme === "dark"}
              disabled={!canToggleTheme}
              onCheckedChange={(checked) => {
                if (!canToggleTheme) return
                setTheme(checked ? "dark" : "light")
              }}
              aria-label="Toggle dark mode"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Household Account</CardTitle>
            <CardDescription>
              Share these credentials with trusted family members and change the password together.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Default username</Label>
                <p className="font-mono text-lg">household</p>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Default password</Label>
                <p className="font-mono text-lg">cashtrack</p>
              </div>
            </div>
            <Separator />
            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {sessionUser?.mustChangePassword
                    ? "A password change is required before accessing all features."
                    : "Use a memorable passphrase so the whole household can sign in."}
                </div>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? "Updating…" : "Change password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        {isHouseholdAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Additional Accounts</CardTitle>
              <CardDescription>
                Give household members their own credentials while sharing the same budgets and transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-4" onSubmit={handleCreateHouseholdUser}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-account-username">Username</Label>
                    <Input
                      id="new-account-username"
                      value={newUserName}
                      autoComplete="off"
                      onChange={(event) => setNewUserName(event.target.value)}
                      placeholder="e.g. alex"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-password">Temporary password</Label>
                    <Input
                      id="new-account-password"
                      type="password"
                      value={newUserPassword}
                      onChange={(event) => setNewUserPassword(event.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="new-account-reset"
                      checked={newUserMustReset}
                      onCheckedChange={(checked) => setNewUserMustReset(checked)}
                    />
                    <Label htmlFor="new-account-reset" className="text-sm text-muted-foreground">
                      Require the new account to change its password on first login
                    </Label>
                  </div>
                  <Button type="submit" disabled={creatingUser}>
                    {creatingUser ? "Creating…" : "Add account"}
                  </Button>
                </div>
                {newUserError && <p className="text-sm text-red-500">{newUserError}</p>}
              </form>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Existing accounts</h3>
                    <p className="text-sm text-muted-foreground">
                      Everyone listed below can sign in to manage the shared household finances.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchHouseholdUsers}
                    disabled={usersLoading}
                  >
                    {usersLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh
                  </Button>
                </div>
                {usersError && <p className="text-sm text-red-500">{usersError}</p>}
                <div className="space-y-2">
                  {usersLoading && householdUsers.length === 0 ? (
                    <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading accounts…
                    </div>
                  ) : householdUsers.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      No additional accounts yet. Create one above to get started.
                    </div>
                  ) : (
                    householdUsers.map((user) => {
                      const badgeVariant = user.mustChangePassword ? "outline" : "secondary"
                      const badgeText = user.mustChangePassword ? "Password reset pending" : "Active"
                      const entityLabel = user.username === "household" ? "Shared" : undefined
                      return (
                        <div key={user.id} className="flex flex-col gap-2 rounded-md border bg-card p-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-muted-foreground">
                              Updated {describeRelativeTime(user.updatedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {entityLabel ? <Badge variant="secondary">{entityLabel}</Badge> : null}
                            <Badge variant={badgeVariant}>{badgeText}</Badge>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {isHouseholdAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Household Activity</CardTitle>
              <CardDescription>Recent changes recorded for shared budgets, categories, and transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Audit who imported transactions or tweaked budgets from each account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchHouseholdActivity}
                  disabled={activityLoading}
                >
                  {activityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh
                </Button>
              </div>
              {activityError && <p className="text-sm text-red-500">{activityError}</p>}
              {activityLoading && activity.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading activity…
                </div>
              ) : activity.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  Actions taken by household members will appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((entry) => {
                    const detailLines = summarizeActivityDetails(entry.details)
                    const entityLabel = entry.entityType.replace(/[_-]/g, " ")
                    return (
                      <div key={entry.id} className="space-y-2 rounded-md border bg-card p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium">{formatActionLabel(entry.action)}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.username} • {describeRelativeTime(entry.createdAt)}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit capitalize">
                            {entityLabel}
                          </Badge>
                        </div>
                        {detailLines.length > 0 && (
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {detailLines.map((line, index) => (
                              <li key={index}>• {line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>LAN Sync</CardTitle>
            <CardDescription>
              Allow trusted devices on your home network to exchange data directly using the sync endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Allow LAN sync requests</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, devices that authenticate with this account can pull and push changes over the LAN.
                </p>
              </div>
              <Switch
                checked={settings.allowLanSync}
                onCheckedChange={(checked) => {
                  mutateSettings({ allowLanSync: checked })
                  updateSettings({ allowLanSync: checked })
                }}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Discovery address</Label>
              <p className="font-mono text-sm">{settings.syncHost}</p>
              <p className="text-sm text-muted-foreground">
                Use this base URL with <code>/api/sync/pull</code> and <code>/api/sync/push</code> when configuring other devices
                or tools like Syncthing.
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Last successful sync</Label>
              <p className="text-sm text-muted-foreground">
                {describeRelativeTime(settings.lastSuccessfulSyncAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backups</CardTitle>
            <CardDescription>Export encrypted-free JSON backups you can restore on any CashTrack device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable automatic backups</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, run a scheduled backup on this device and prune old archives after the retention window.
                </p>
              </div>
              <Switch
                checked={settings.allowAutomaticBackups}
                onCheckedChange={(checked) => {
                  mutateSettings({ allowAutomaticBackups: checked })
                  updateSettings({ allowAutomaticBackups: checked })
                }}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Automatic backup frequency</Label>
                <Select
                  value={backupFrequency}
                  onValueChange={(value: BackupFrequency) => {
                    mutateSettings({ autoBackupFrequency: value })
                    updateSettings({ autoBackupFrequency: value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Retention (days)</Label>
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={settings.backupRetentionDays}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    mutateSettings({ backupRetentionDays: value })
                  }}
                  onBlur={(event) => {
                    const value = Number(event.target.value)
                    updateSettings({ backupRetentionDays: value })
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleExport}>
                Export backup
              </Button>
              <div>
                <Label className="text-sm font-medium" htmlFor="restore-file">
                  Restore backup
                </Label>
                <Input id="restore-file" type="file" accept="application/json" onChange={handleImport} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Last backup: {describeRelativeTime(settings.lastBackupAt)}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
