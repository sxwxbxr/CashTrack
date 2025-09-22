"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import type { AppSettingsPayload, BackupFrequency } from "@/lib/settings/types"
import type { SessionUser } from "@/lib/auth/session"

interface SettingsResponse {
  settings: AppSettingsPayload
  error?: unknown
}

interface SessionResponse {
  user?: SessionUser
}

function describeRelativeTime(iso: string | null): string {
  if (!iso) return "Never"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "Never"
  }
  return `${formatDistanceToNow(date, { addSuffix: true })}`
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsPayload | null>(null)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [themeReady, setThemeReady] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

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

  useEffect(() => {
    setThemeReady(true)
  }, [])

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
      <AppLayout title="Settings" description="Manage your CashTrack household preferences">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading settings…</div>
      </AppLayout>
    )
  }

  if (!settings) {
    return (
      <AppLayout title="Settings" description="Manage your CashTrack household preferences">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Unable to load settings. Please refresh.
        </div>
      </AppLayout>
    )
  }

  const backupFrequency: BackupFrequency = settings.autoBackupFrequency
  const canToggleTheme = themeReady && typeof resolvedTheme === "string"

  return (
    <AppLayout
      title="Settings"
      description="Manage household access, backups, and LAN sync for CashTrack"
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
