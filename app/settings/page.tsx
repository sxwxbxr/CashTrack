"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"

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

const activityCurrencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

export default function SettingsPage() {
  const { t } = useTranslations()
  const describeRelativeTime = useCallback(
    (iso: string | null): string => {
      if (!iso) return t("Never")
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) {
        return t("Never")
      }
      return formatDistanceToNow(date, { addSuffix: true })
    },
    [t],
  )
  const formatActionLabel = useCallback(
    (action: string): string => {
      const [entityRaw, verbRaw] = action.split(".")
      if (!entityRaw || !verbRaw) {
        return action.replace(/[_-]/g, " ")
      }

      const verbMap: Record<string, string> = {
        create: t("Created"),
        update: t("Updated"),
        delete: t("Deleted"),
        import: t("Imported"),
      }

      const verb = verbMap[verbRaw] ?? `${verbRaw.charAt(0).toUpperCase()}${verbRaw.slice(1)}`
      const entity = entityRaw
        .split(/[_-]/)
        .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ""))
        .join(" ")
      return `${verb} ${entity}`.trim()
    },
    [t],
  )
  const summarizeActivityDetails = useCallback(
    (details: Record<string, unknown> | null): string[] => {
      if (!details) return []

      const items: string[] = []

      if (typeof details.amount === "number") {
        items.push(
          t("Amount: {{value}}", {
            values: { value: activityCurrencyFormatter.format(details.amount) },
          }),
        )
      }

      if (typeof details.account === "string" && details.account) {
        items.push(t("Account: {{value}}", { values: { value: details.account } }))
      }

      if (typeof details.username === "string" && details.username) {
        items.push(t("Username: {{value}}", { values: { value: details.username } }))
      }

      if (typeof details.mustChangePassword === "boolean") {
        items.push(details.mustChangePassword ? t("Password reset required") : t("Password confirmed"))
      }

      if (typeof details.imported === "number") {
        items.push(t("Imported: {{value}}", { values: { value: details.imported.toString() } }))
      }

      if (typeof details.skipped === "number" && details.skipped > 0) {
        items.push(t("Skipped: {{value}}", { values: { value: details.skipped.toString() } }))
      }

      if (details.changes && typeof details.changes === "object" && details.changes !== null) {
        const changeKeys = Object.keys(details.changes as Record<string, unknown>)
        if (changeKeys.length > 0) {
          items.push(t("Fields: {{value}}", { values: { value: changeKeys.join(", ") } }))
        }
      }

      return items.slice(0, 3)
    },
    [t],
  )
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
  const [newCurrency, setNewCurrency] = useState("")
  const [currencyError, setCurrencyError] = useState<string | null>(null)
  const [savingCurrency, setSavingCurrency] = useState(false)
  const sortedCurrencies = useMemo(() => {
    if (!settings) {
      return [] as string[]
    }
    const entries = [...settings.knownCurrencies]
    entries.sort((a, b) => {
      if (a === settings.baseCurrency) return -1
      if (b === settings.baseCurrency) return 1
      return a.localeCompare(b, undefined, { sensitivity: "base" })
    })
    return entries
  }, [settings])

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
            toast.error(t("Unable to load settings"))
          }

          if (sessionRes.ok) {
            const data = (await sessionRes.json()) as SessionResponse
            setSessionUser(data.user ?? null)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          toast.error(t("Unable to load settings"))
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
  }, [t])

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
        const message = typeof body.error === "string" ? body.error : t("Unable to load accounts")
        throw new Error(message)
      }
      setHouseholdUsers(Array.isArray(body.users) ? body.users : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to load accounts")
      setUsersError(message)
      toast.error(t("Unable to load accounts"), { description: message })
    } finally {
      setUsersLoading(false)
    }
  }, [isHouseholdAdmin, t])

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
        const message = typeof body.error === "string" ? body.error : t("Unable to load activity")
        throw new Error(message)
      }
      setActivity(Array.isArray(body.activities) ? body.activities : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to load activity")
      setActivityError(message)
      toast.error(t("Unable to load activity"), { description: message })
    } finally {
      setActivityLoading(false)
    }
  }, [isHouseholdAdmin, t])

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
        throw new Error(t("Failed to update settings"))
      }
      const data = (await response.json()) as SettingsResponse
      setSettings(data.settings)
      toast.success(t("Settings saved"))
    } catch (error) {
      toast.error(t("Unable to save settings"), {
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
      setNewUserError(t("Provide both a username and password"))
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
        const message = typeof body.error === "string" ? body.error : t("Unable to create account")
        throw new Error(message)
      }

      toast.success(t("Account created"), {
        description: body.user?.username
          ? t("{{username}} can now sign in.", { values: { username: body.user.username } })
          : undefined,
      })
      setNewUserName("")
      setNewUserPassword("")
      setNewUserMustReset(true)
      await fetchHouseholdUsers()
      await fetchHouseholdActivity()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to create account")
      setNewUserError(message)
      toast.error(t("Unable to create account"), { description: message })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch("/api/sync/export", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Unable to export data"))
      }
      const snapshot = await response.json()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `cashtrack-backup-${new Date().toISOString()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(t("Backup exported"))
    } catch (error) {
      toast.error(t("Export failed"), { description: error instanceof Error ? error.message : undefined })
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
        throw new Error(typeof body.error === "string" ? body.error : t("Import failed"))
      }
      const data = (await response.json()) as { settings: AppSettingsPayload }
      toast.success(t("Backup restored"))
      event.target.value = ""
      setSettings(data.settings)
    } catch (error) {
      toast.error(t("Import failed"), { description: error instanceof Error ? error.message : undefined })
    }
  }

  const handleAddCurrency = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!settings || savingCurrency) {
      return
    }

    const code = newCurrency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(code)) {
      setCurrencyError(t("Enter a valid 3-letter currency code"))
      return
    }

    if (settings.knownCurrencies.some((existing) => existing.toUpperCase() === code)) {
      setCurrencyError(t("Currency already added"))
      return
    }

    setSavingCurrency(true)
    setCurrencyError(null)

    try {
      await updateSettings({ knownCurrencies: settings.knownCurrencies.concat(code) })
      setNewCurrency("")
    } finally {
      setSavingCurrency(false)
    }
  }

  const handleRemoveCurrency = async (currency: string) => {
    if (!settings || savingCurrency || currency === settings.baseCurrency) {
      return
    }

    setSavingCurrency(true)
    setCurrencyError(null)

    try {
      const next = settings.knownCurrencies.filter((entry) => entry !== currency)
      await updateSettings({ knownCurrencies: next })
    } finally {
      setSavingCurrency(false)
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
        const message = typeof body.error === "string" ? body.error : t("Unable to update password")
        throw new Error(message)
      }
      setCurrentPassword("")
      setNewPassword("")
      toast.success(t("Password updated"))
      setSessionUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
    } catch (error) {
      toast.error(t("Password update failed"), {
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
            <CardTitle>{t("Appearance")}</CardTitle>
            <CardDescription>{t("Choose between the light and dark interface.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium" htmlFor="dark-mode-toggle">
                {t("Dark mode")}
              </Label>
              <p className="text-sm text-muted-foreground">{t("Switch the dashboard to a darker color palette.")}</p>
            </div>
            <Switch
              id="dark-mode-toggle"
              checked={canToggleTheme && resolvedTheme === "dark"}
              disabled={!canToggleTheme}
              onCheckedChange={(checked) => {
                if (!canToggleTheme) return
                setTheme(checked ? "dark" : "light")
              }}
              aria-label={t("Toggle dark mode")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("Currencies")}</CardTitle>
            <CardDescription>
              {t("Manage additional currencies for multi-currency tracking.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              className="flex flex-col gap-4 md:flex-row md:items-end"
              onSubmit={handleAddCurrency}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-currency">{t("Currency")}</Label>
                <Input
                  id="new-currency"
                  value={newCurrency}
                  maxLength={3}
                  onChange={(event) => {
                    setNewCurrency(event.target.value.toUpperCase())
                    if (currencyError) {
                      setCurrencyError(null)
                    }
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={savingCurrency}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Use a 3-letter currency code (e.g., USD)")}
                </p>
                {currencyError ? <p className="text-xs text-red-500">{currencyError}</p> : null}
              </div>
              <Button type="submit" disabled={savingCurrency}>
                {savingCurrency ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("Add currency")}
              </Button>
            </form>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Known currencies")}</p>
              <div className="flex flex-wrap gap-2">
                {sortedCurrencies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("No additional currencies yet. Add one above to start tracking conversions.")}
                  </p>
                ) : (
                  sortedCurrencies.map((currency) => (
                    <Badge
                      key={currency}
                      variant={currency === settings.baseCurrency ? "secondary" : "outline"}
                      className="flex items-center gap-2"
                    >
                      <span>{currency}</span>
                      {currency === settings.baseCurrency ? (
                        <span className="text-[11px] text-muted-foreground">
                          {t("Base currency")}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleRemoveCurrency(currency)}
                          disabled={savingCurrency}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">
                            {t("Remove {{currency}}", { values: { currency } })}
                          </span>
                        </Button>
                      )}
                    </Badge>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("Base currency cannot be removed.")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("Household Account")}</CardTitle>
            <CardDescription>
              {t("Share these credentials with trusted family members and change the password together.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">{t("Default username")}</Label>
                <p className="font-mono text-lg">household</p>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">{t("Default password")}</Label>
                <p className="font-mono text-lg">cashtrack</p>
              </div>
            </div>
            <Separator />
            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t("Current password")}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("New password")}</Label>
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
                    ? t("A password change is required before accessing all features.")
                    : t("Use a memorable passphrase so the whole household can sign in.")}
                </div>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? t("Updating…") : t("Change password")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        {isHouseholdAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{t("Additional Accounts")}</CardTitle>
              <CardDescription>
                {t("Give household members their own credentials while sharing the same budgets and transactions.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-4" onSubmit={handleCreateHouseholdUser}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-account-username">{t("Username")}</Label>
                    <Input
                      id="new-account-username"
                      value={newUserName}
                      autoComplete="off"
                      onChange={(event) => setNewUserName(event.target.value)}
                      placeholder={t("e.g. alex")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-password">{t("Temporary password")}</Label>
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
                      {t("Require the new account to change its password on first login")}
                    </Label>
                  </div>
                  <Button type="submit" disabled={creatingUser}>
                    {creatingUser ? t("Creating…") : t("Add account")}
                  </Button>
                </div>
                {newUserError && <p className="text-sm text-red-500">{newUserError}</p>}
              </form>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">{t("Existing accounts")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("Everyone listed below can sign in to manage the shared household finances.")}
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
                    {t("Refresh")}
                  </Button>
                </div>
                {usersError && <p className="text-sm text-red-500">{usersError}</p>}
                <div className="space-y-2">
                  {usersLoading && householdUsers.length === 0 ? (
                    <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("Loading accounts…")}
                    </div>
                  ) : householdUsers.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      {t("No additional accounts yet. Create one above to get started.")}
                    </div>
                  ) : (
                    householdUsers.map((user) => {
                      const badgeVariant = user.mustChangePassword ? "outline" : "secondary"
                      const badgeText = user.mustChangePassword ? t("Password reset pending") : t("Active")
                      const entityLabel = user.username === "household" ? t("Shared") : undefined
                      return (
                        <div key={user.id} className="flex flex-col gap-2 rounded-md border bg-card p-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("Updated {{time}}", { values: { time: describeRelativeTime(user.updatedAt) } })}
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
              <CardTitle>{t("Household Activity")}</CardTitle>
              <CardDescription>
                {t("Recent changes recorded for shared budgets, categories, and transactions.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("Audit who imported transactions or tweaked budgets from each account.")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchHouseholdActivity}
                  disabled={activityLoading}
                >
                  {activityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("Refresh")}
                </Button>
              </div>
              {activityError && <p className="text-sm text-red-500">{activityError}</p>}
              {activityLoading && activity.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("Loading activity…")}
                </div>
              ) : activity.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  {t("Actions taken by household members will appear here.")}
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
            <CardTitle>{t("LAN Sync")}</CardTitle>
            <CardDescription>
              {t("Allow trusted devices on your home network to exchange data directly using the sync endpoints.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t("Allow LAN sync requests")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("When enabled, devices that authenticate with this account can pull and push changes over the LAN.")}
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
              <Label className="text-sm font-medium">{t("Discovery address")}</Label>
              <p className="font-mono text-sm">{settings.syncHost}</p>
              <p className="text-sm text-muted-foreground">
                {t("Use this base URL with <code>/api/sync/pull</code> and <code>/api/sync/push</code> when configuring other devices or tools like Syncthing.")}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">{t("Last successful sync")}</Label>
              <p className="text-sm text-muted-foreground">
                {describeRelativeTime(settings.lastSuccessfulSyncAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Backups")}</CardTitle>
            <CardDescription>
              {t("Export encrypted-free JSON backups you can restore on any CashTrack device.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t("Enable automatic backups")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("When enabled, run a scheduled backup on this device and prune old archives after the retention window.")}
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
                <Label className="text-sm font-medium">{t("Automatic backup frequency")}</Label>
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
                    <SelectItem value="off">{t("Off")}</SelectItem>
                    <SelectItem value="daily">{t("Daily")}</SelectItem>
                    <SelectItem value="weekly">{t("Weekly")}</SelectItem>
                    <SelectItem value="monthly">{t("Monthly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("Retention (days)")}</Label>
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
                {t("Export backup")}
              </Button>
              <div>
                <Label className="text-sm font-medium" htmlFor="restore-file">
                  {t("Restore backup")}
                </Label>
                <Input id="restore-file" type="file" accept="application/json" onChange={handleImport} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {t("Last backup: {{time}}", { values: { time: describeRelativeTime(settings.lastBackupAt) } })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
