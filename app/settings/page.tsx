"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNowStrict } from "date-fns"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Save,
  Download,
  Upload,
  Trash2,
  Plus,
  Database,
  Shield,
  Bell,
  Palette,
  Globe,
  CreditCard,
  FileText,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Pencil,
  Calendar,
  CloudUpload,
  FileSpreadsheet,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  SettingsData,
  ConnectedAccount,
  CsvTemplate,
  BackupRecord,
  CurrencyCode,
  DateFormat,
  ThemePreference,
  StartOfWeek,
  BackupFrequency,
  AccountType,
  CreateCsvTemplateInput,
} from "@/lib/settings/types"

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
] satisfies { value: CurrencyCode; label: string }[]

const dateFormatOptions = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
] satisfies { value: DateFormat; label: string }[]

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] satisfies { value: ThemePreference; label: string }[]

const startOfWeekOptions = [
  { value: "Sunday", label: "Sunday" },
  { value: "Monday", label: "Monday" },
] satisfies { value: StartOfWeek; label: string }[]

const fiscalMonthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const languageOptions = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
]

const backupFrequencyOptions = [
  { value: "off", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] satisfies { value: BackupFrequency; label: string }[]

const accountTypeOptions = [
  { value: "Checking", label: "Checking" },
  { value: "Savings", label: "Savings" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "Investment", label: "Investment" },
  { value: "Loan", label: "Loan" },
  { value: "Cash", label: "Cash" },
] satisfies { value: AccountType; label: string }[]

const delimiterOptions = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
]

type AccountFormState = {
  name: string
  institution: string
  type: AccountType
  currency: CurrencyCode
  balance: string
  autoSync: boolean
}

type TemplateFormState = {
  name: string
  description: string
  columns: string
  delimiter: string
  hasHeaders: boolean
  dateColumn: string
  amountColumn: string
  descriptionColumn: string
  active: boolean
}

const defaultAccountForm: AccountFormState = {
  name: "",
  institution: "",
  type: "Checking",
  currency: "USD",
  balance: "",
  autoSync: true,
}

const defaultTemplateForm: TemplateFormState = {
  name: "",
  description: "",
  columns: "Date, Description, Amount",
  delimiter: ",",
  hasHeaders: true,
  dateColumn: "Date",
  amountColumn: "Amount",
  descriptionColumn: "Description",
  active: true,
}

function cloneSettings(data: SettingsData): SettingsData {
  return JSON.parse(JSON.stringify(data)) as SettingsData
}

function extractErrorMessage(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return value
  }

  if (value instanceof Error) {
    return value.message
  }

  if (typeof value === "object") {
    const maybeMessage = (value as { message?: unknown }).message
    if (typeof maybeMessage === "string") {
      return maybeMessage
    }

    const maybeError = value as { error?: unknown }
    if (maybeError.error) {
      return extractErrorMessage(maybeError.error)
    }

    const maybeFormErrors = value as { formErrors?: unknown; fieldErrors?: Record<string, unknown> }
    if (Array.isArray(maybeFormErrors.formErrors) && maybeFormErrors.formErrors.length > 0) {
      const candidate = maybeFormErrors.formErrors.find((item) => typeof item === "string")
      if (typeof candidate === "string") {
        return candidate
      }
    }

    if (maybeFormErrors.fieldErrors) {
      for (const field of Object.values(maybeFormErrors.fieldErrors)) {
        if (Array.isArray(field)) {
          const candidate = field.find((item) => typeof item === "string")
          if (typeof candidate === "string") {
            return candidate
          }
        }
      }
    }
  }

  return null
}

async function handleApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T
  }

  let message = fallbackMessage
  try {
    const body = await response.json()
    const extracted = extractErrorMessage(body)
    if (extracted) {
      message = extracted
    }
  } catch (error) {
    const extracted = extractErrorMessage(error)
    if (extracted) {
      message = extracted
    }
  }

  throw new Error(message)
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Never"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Not available"
  }
  return format(date, "PPpp")
}

function formatBackupSize(size: number) {
  return `${size.toFixed(2)} MB`
}

function formatAccountBalance(balance: number, currency: CurrencyCode) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(balance)
  } catch {
    return `$${balance.toFixed(2)}`
  }
}

function titleCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function parseColumns(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function formatColumnsText(columns: string[]) {
  return columns.join(", ")
}

function delimiterLabel(value: string) {
  if (value === "\t") {
    return "Tab"
  }
  if (value === ",") {
    return "Comma"
  }
  if (value === ";") {
    return "Semicolon"
  }
  if (value === "|") {
    return "Pipe"
  }
  return value
}
export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [draft, setDraft] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [accountDialogMode, setAccountDialogMode] = useState<"create" | "edit">("create")
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [autoSyncOverrides, setAutoSyncOverrides] = useState<Record<string, boolean | undefined>>({})
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null)

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateDialogMode, setTemplateDialogMode] = useState<"create" | "edit">("create")
  const [templateSubmitting, setTemplateSubmitting] = useState(false)
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(defaultTemplateForm)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [importingTemplates, setImportingTemplates] = useState(false)

  const templateImportInputRef = useRef<HTMLInputElement | null>(null)

  const [creatingBackup, setCreatingBackup] = useState(false)
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/settings", { cache: "no-store" })
      const data = await handleApiResponse<{ settings: SettingsData }>(response, "Unable to load settings")
      setSettings(data.settings)
      setDraft(cloneSettings(data.settings))
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load settings"
      setError(message)
      toast.error("Failed to load settings", { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const hasUnsavedChanges = useMemo(() => {
    if (!settings || !draft) {
      return false
    }
    return (
      JSON.stringify({
        general: settings.general,
        notifications: settings.notifications,
        privacy: settings.privacy,
        backups: {
          autoBackupFrequency: settings.backups.autoBackupFrequency,
          retentionDays: settings.backups.retentionDays,
        },
      }) !==
      JSON.stringify({
        general: draft.general,
        notifications: draft.notifications,
        privacy: draft.privacy,
        backups: {
          autoBackupFrequency: draft.backups.autoBackupFrequency,
          retentionDays: draft.backups.retentionDays,
        },
      })
    )
  }, [settings, draft])

  const updateGeneral = <K extends keyof SettingsData["general"]>(key: K, value: SettingsData["general"][K]) => {
    setDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        general: {
          ...previous.general,
          [key]: value,
        },
      }
    })
  }

  const updateNotifications = <K extends keyof SettingsData["notifications"]>(
    key: K,
    value: SettingsData["notifications"][K],
  ) => {
    setDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        notifications: {
          ...previous.notifications,
          [key]: value,
        },
      }
    })
  }

  const updatePrivacy = <K extends keyof SettingsData["privacy"]>(key: K, value: SettingsData["privacy"][K]) => {
    setDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        privacy: {
          ...previous.privacy,
          [key]: value,
        },
      }
    })
  }

  const updateBackupSettings = <K extends keyof SettingsData["backups"]>(
    key: K,
    value: SettingsData["backups"][K],
  ) => {
    setDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        backups: {
          ...previous.backups,
          [key]: value,
        },
      }
    })
  }

  const handleSave = async () => {
    if (!draft) {
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        general: draft.general,
        notifications: draft.notifications,
        privacy: draft.privacy,
        backups: {
          autoBackupFrequency: draft.backups.autoBackupFrequency,
          retentionDays: draft.backups.retentionDays,
        },
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await handleApiResponse<{ settings: SettingsData }>(response, "Unable to save settings")
      setSettings(data.settings)
      setDraft(cloneSettings(data.settings))
      toast.success("Settings updated", {
        description: "Your preferences have been saved.",
      })
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings"
      toast.error("Save failed", { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const openCreateAccountDialog = () => {
    setAccountDialogMode("create")
    setSelectedAccountId(null)
    setAccountForm(defaultAccountForm)
    setAccountDialogOpen(true)
  }

  const openEditAccountDialog = (account: ConnectedAccount) => {
    setAccountDialogMode("edit")
    setSelectedAccountId(account.id)
    setAccountForm({
      name: account.name,
      institution: account.institution,
      type: account.type,
      currency: account.currency,
      balance: account.balance ? account.balance.toString() : "",
      autoSync: account.autoSync,
    })
    setAccountDialogOpen(true)
  }

  const handleAccountDialogOpenChange = (open: boolean) => {
    if (!open && accountSubmitting) {
      return
    }
    setAccountDialogOpen(open)
    if (!open) {
      setAccountForm(defaultAccountForm)
      setSelectedAccountId(null)
    }
  }

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = accountForm.name.trim()
    const institution = accountForm.institution.trim()

    if (!name || !institution) {
      toast.error("Name and institution are required")
      return
    }

    const payload = {
      name,
      institution,
      type: accountForm.type,
      currency: accountForm.currency,
      autoSync: accountForm.autoSync,
      ...(accountForm.balance.trim().length
        ? { balance: Number(accountForm.balance) }
        : {}),
    }

    setAccountSubmitting(true)
    try {
      if (accountDialogMode === "create") {
        const response = await fetch("/api/settings/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const result = await handleApiResponse<{ account: ConnectedAccount; settings: SettingsData }>(
          response,
          "Unable to connect account",
        )

        setSettings(result.settings)
        toast.success("Account connected", {
          description: `${result.account.name} will begin syncing shortly.`,
        })
      } else if (selectedAccountId) {
        const response = await fetch(`/api/settings/accounts/${selectedAccountId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const result = await handleApiResponse<{ account: ConnectedAccount; settings: SettingsData }>(
          response,
          "Unable to update account",
        )

        setSettings(result.settings)
        toast.success("Account updated", {
          description: `${result.account.name} has been updated.`,
        })
      }

      setAccountDialogOpen(false)
      setAccountForm(defaultAccountForm)
      setSelectedAccountId(null)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save account"
      toast.error(message)
    } finally {
      setAccountSubmitting(false)
    }
  }

  const handleAccountAutoSyncChange = async (account: ConnectedAccount, value: boolean) => {
    setAutoSyncOverrides((previous) => ({ ...previous, [account.id]: value }))
    setUpdatingAccountId(account.id)

    try {
      const response = await fetch(`/api/settings/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync: value }),
      })

      const result = await handleApiResponse<{ account: ConnectedAccount; settings: SettingsData }>(
        response,
        "Unable to update account",
      )

      setSettings(result.settings)
      setAutoSyncOverrides((previous) => {
        const next = { ...previous }
        delete next[account.id]
        return next
      })
      toast.success(`Auto-sync ${value ? "enabled" : "disabled"}`, {
        description: `${result.account.name} ${value ? "will" : "will not"} sync automatically.`,
      })
    } catch (toggleError) {
      setAutoSyncOverrides((previous) => {
        const next = { ...previous }
        delete next[account.id]
        return next
      })
      const message = toggleError instanceof Error ? toggleError.message : "Unable to update account"
      toast.error(message)
    } finally {
      setUpdatingAccountId(null)
    }
  }

  const handleSyncAccount = async (account: ConnectedAccount) => {
    setSyncingAccountId(account.id)
    try {
      const response = await fetch(`/api/settings/accounts/${account.id}/sync`, {
        method: "POST",
      })

      const result = await handleApiResponse<{ account: ConnectedAccount; settings: SettingsData }>(
        response,
        "Unable to sync account",
      )

      setSettings(result.settings)
      toast.success("Sync complete", {
        description: `${result.account.name} synced just now.`,
      })
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Unable to sync account"
      toast.error(message)
    } finally {
      setSyncingAccountId(null)
    }
  }

  const handleDeleteAccount = async (account: ConnectedAccount) => {
    const confirmed = window.confirm(
      `Disconnect ${account.name}? This will stop importing transactions from ${account.institution}.`,
    )
    if (!confirmed) {
      return
    }

    setDeletingAccountId(account.id)
    try {
      const response = await fetch(`/api/settings/accounts/${account.id}`, {
        method: "DELETE",
      })

      const result = await handleApiResponse<{ settings: SettingsData }>(
        response,
        "Unable to remove account",
      )

      setSettings(result.settings)
      toast.success("Account removed", {
        description: `${account.name} has been disconnected.`,
      })
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to remove account"
      toast.error(message)
    } finally {
      setDeletingAccountId(null)
    }
  }

  const openCreateTemplateDialog = () => {
    setTemplateDialogMode("create")
    setSelectedTemplateId(null)
    setTemplateForm(defaultTemplateForm)
    setTemplateDialogOpen(true)
  }

  const openEditTemplateDialog = (template: CsvTemplate) => {
    setTemplateDialogMode("edit")
    setSelectedTemplateId(template.id)
    setTemplateForm({
      name: template.name,
      description: template.description ?? "",
      columns: formatColumnsText(template.columns),
      delimiter: template.delimiter,
      hasHeaders: template.hasHeaders,
      dateColumn: template.dateColumn,
      amountColumn: template.amountColumn,
      descriptionColumn: template.descriptionColumn,
      active: template.active,
    })
    setTemplateDialogOpen(true)
  }

  const handleTemplateDialogOpenChange = (open: boolean) => {
    if (!open && templateSubmitting) {
      return
    }
    setTemplateDialogOpen(open)
    if (!open) {
      setTemplateForm(defaultTemplateForm)
      setSelectedTemplateId(null)
    }
  }

  const handleTemplateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = templateForm.name.trim()
    if (!name) {
      toast.error("Template name is required")
      return
    }

    const columns = parseColumns(templateForm.columns)
    if (!columns.length) {
      toast.error("At least one column is required")
      return
    }

    const payload = {
      name,
      description: templateForm.description.trim() || undefined,
      columns,
      delimiter: templateForm.delimiter,
      hasHeaders: templateForm.hasHeaders,
      dateColumn: templateForm.dateColumn.trim(),
      amountColumn: templateForm.amountColumn.trim(),
      descriptionColumn: templateForm.descriptionColumn.trim(),
      active: templateForm.active,
    }

    setTemplateSubmitting(true)
    try {
      if (templateDialogMode === "create") {
        const response = await fetch("/api/settings/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const result = await handleApiResponse<{ template: CsvTemplate; settings: SettingsData }>(
          response,
          "Unable to create template",
        )

        setSettings(result.settings)
        toast.success("Template created", {
          description: `${result.template.name} is ready for imports.`,
        })
      } else if (selectedTemplateId) {
        const response = await fetch(`/api/settings/templates/${selectedTemplateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const result = await handleApiResponse<{ template: CsvTemplate; settings: SettingsData }>(
          response,
          "Unable to update template",
        )

        setSettings(result.settings)
        toast.success("Template updated", {
          description: `${result.template.name} has been updated.`,
        })
      }

      setTemplateDialogOpen(false)
      setTemplateForm(defaultTemplateForm)
      setSelectedTemplateId(null)
    } catch (templateError) {
      const message = templateError instanceof Error ? templateError.message : "Unable to save template"
      toast.error(message)
    } finally {
      setTemplateSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (template: CsvTemplate) => {
    const confirmed = window.confirm(`Delete ${template.name}? This action cannot be undone.`)
    if (!confirmed) {
      return
    }

    setDeletingTemplateId(template.id)
    try {
      const response = await fetch(`/api/settings/templates/${template.id}`, {
        method: "DELETE",
      })

      const result = await handleApiResponse<{ settings: SettingsData }>(
        response,
        "Unable to delete template",
      )

      setSettings(result.settings)
      toast.success("Template deleted", {
        description: `${template.name} was removed.`,
      })
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete template"
      toast.error(message)
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const handleExportTemplates = () => {
    const currentTemplates = settings?.dataSources.csvTemplates ?? []
    if (currentTemplates.length === 0) {
      toast.info("No templates to export", {
        description: "Add a template before exporting.",
      })
      return
    }

    let objectUrl: string | null = null
    let link: HTMLAnchorElement | null = null

    try {
      const exportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: currentTemplates.map(({ id, createdAt, updatedAt, ...template }) => template),
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      })
      objectUrl = URL.createObjectURL(blob)
      link = document.createElement("a")
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      link.href = objectUrl
      link.download = `cashtrack-templates-${timestamp}.json`
      document.body.appendChild(link)
      link.click()

      toast.success("Templates exported", {
        description: `${currentTemplates.length} template${currentTemplates.length === 1 ? "" : "s"} downloaded.`,
      })
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Unable to export templates"
      toast.error(message)
    } finally {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link)
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }

  const handleImportTemplates = () => {
    if (importingTemplates) {
      return
    }

    templateImportInputRef.current?.click()
  }

  const handleTemplateFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) {
      input.value = ""
      return
    }

    setImportingTemplates(true)

    try {
      const fileContents = await file.text()

      let parsed: unknown
      try {
        parsed = JSON.parse(fileContents)
      } catch {
        throw new Error("Import file is not valid JSON")
      }

      const rawTemplates = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" &&
            parsed !== null &&
            Array.isArray((parsed as { templates?: unknown }).templates)
          ? ((parsed as { templates: unknown[] }).templates)
          : null

      if (!rawTemplates || rawTemplates.length === 0) {
        toast.error("No templates found", {
          description: "The selected file does not contain any templates to import.",
        })
        return
      }

      const normalized = rawTemplates
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null
          }

          const template = item as Partial<CsvTemplate> & Partial<CreateCsvTemplateInput>

          const name = typeof template.name === "string" ? template.name.trim() : ""
          const columns = Array.isArray(template.columns)
            ? template.columns
                .map((column) =>
                  typeof column === "string" ? column.trim() : String(column).trim(),
                )
                .filter((column) => column.length > 0)
            : typeof template.columns === "string"
              ? parseColumns(template.columns)
              : []
          const delimiter =
            typeof template.delimiter === "string" && template.delimiter.length > 0
              ? template.delimiter
              : ","
          const hasHeaders =
            typeof template.hasHeaders === "boolean" ? template.hasHeaders : true
          const dateColumn =
            typeof template.dateColumn === "string" ? template.dateColumn.trim() : ""
          const amountColumn =
            typeof template.amountColumn === "string" ? template.amountColumn.trim() : ""
          const descriptionColumn =
            typeof template.descriptionColumn === "string"
              ? template.descriptionColumn.trim()
              : ""
          const description =
            typeof template.description === "string"
              ? template.description.trim() || undefined
              : undefined
          const active =
            typeof template.active === "boolean" ? template.active : undefined

          if (!name || !columns.length || !dateColumn || !amountColumn || !descriptionColumn) {
            return null
          }

          const payload: CreateCsvTemplateInput = {
            name,
            columns,
            delimiter,
            hasHeaders,
            dateColumn,
            amountColumn,
            descriptionColumn,
          }

          if (description) {
            payload.description = description
          }

          if (active !== undefined) {
            payload.active = active
          }

          return payload
        })
        .filter((value): value is CreateCsvTemplateInput => value !== null)

      if (!normalized.length) {
        toast.error("No templates could be imported", {
          description: "None of the templates in the file were valid.",
        })
        return
      }

      let latestSettingsData: SettingsData | null = null
      let successCount = 0
      const failures: Array<{ name: string; message: string }> = []

      for (const template of normalized) {
        try {
          const response = await fetch("/api/settings/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(template),
          })

          const result = await handleApiResponse<{ template: CsvTemplate; settings: SettingsData }>(
            response,
            "Unable to import template",
          )

          latestSettingsData = result.settings
          successCount += 1
        } catch (templateError) {
          const message =
            templateError instanceof Error ? templateError.message : "Unable to import template"
          failures.push({ name: template.name, message })
        }
      }

      if (latestSettingsData) {
        setSettings(latestSettingsData)
      }

      if (successCount > 0) {
        const skippedSummary =
          failures.length > 0
            ? `Skipped ${failures.length} template${failures.length === 1 ? "" : "s"} (${failures
                .map((failure) => failure.name)
                .join(", ")}).`
            : ""

        toast.success("Templates imported", {
          description: `${successCount} template${successCount === 1 ? "" : "s"} imported successfully.${
            skippedSummary ? ` ${skippedSummary}` : ""
          }`,
        })
      } else {
        const description =
          failures.length > 0
            ? failures
                .map((failure) =>
                  failure.name ? `${failure.name}: ${failure.message}` : failure.message,
                )
                .join("\n")
            : "The selected file did not contain any valid templates."

        toast.error("Unable to import templates", { description })
      }
    } catch (importError) {
      const message =
        importError instanceof Error ? importError.message : "Unable to import templates"
      toast.error(message)
    } finally {
      setImportingTemplates(false)
      input.value = ""
    }
  }

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      const response = await fetch("/api/settings/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual", notes: "Manual backup created from settings" }),
      })

      const result = await handleApiResponse<{ backup: BackupRecord; settings: SettingsData }>(
        response,
        "Unable to create backup",
      )

      setSettings(result.settings)
      toast.success("Backup created", {
        description: `Snapshot saved at ${formatDateTime(result.backup.createdAt)}.`,
      })
    } catch (backupError) {
      const message = backupError instanceof Error ? backupError.message : "Unable to create backup"
      toast.error(message)
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDeleteBackup = async (backup: BackupRecord) => {
    const confirmed = window.confirm("Delete this backup? This action cannot be undone.")
    if (!confirmed) {
      return
    }

    setDeletingBackupId(backup.id)
    try {
      const response = await fetch(`/api/settings/backups/${backup.id}`, {
        method: "DELETE",
      })

      const result = await handleApiResponse<{ settings: SettingsData }>(
        response,
        "Unable to delete backup",
      )

      setSettings(result.settings)
      toast.success("Backup deleted")
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete backup"
      toast.error(message)
    } finally {
      setDeletingBackupId(null)
    }
  }

  const handleDownloadBackup = (backup: BackupRecord) => {
    toast.success("Download starting", {
      description: `Preparing backup from ${formatDateTime(backup.createdAt)} (${formatBackupSize(backup.size)}).`,
    })
  }

  const handleExportData = () => {
    toast.success("Export queued", {
      description: "A complete dataset export will be prepared and emailed to you shortly.",
    })
  }

  const handleImportData = () => {
    toast.info("Import coming soon", {
      description: "Upload support will guide you through mapping your CSV columns.",
    })
  }
  const accounts = settings?.dataSources.connectedAccounts ?? []
  const templates = settings?.dataSources.csvTemplates ?? []
  const backupHistory = settings?.backups.history ?? []
  const lastBackupAt = settings?.backups.lastBackupAt ?? null

  const notificationToggles: { key: keyof SettingsData["notifications"]; title: string; description: string }[] = [
    {
      key: "budgetAlerts",
      title: "Budget alerts",
      description: "Get notified when you exceed category budgets.",
    },
    {
      key: "weeklyReports",
      title: "Weekly report",
      description: "Receive a summary of your spending every Monday morning.",
    },
    {
      key: "monthlyReports",
      title: "Monthly report",
      description: "Detailed breakdown delivered on the first business day of the month.",
    },
    {
      key: "transactionReminders",
      title: "Transaction reminders",
      description: "Reminders to categorize uncategorized transactions.",
    },
    {
      key: "securityAlerts",
      title: "Security alerts",
      description: "Immediate alerts for suspicious sign-ins or failed sync attempts.",
    },
    {
      key: "productUpdates",
      title: "Product updates",
      description: "Occasional announcements about new features and improvements.",
    },
  ]

  const privacyToggles: { key: keyof SettingsData["privacy"]; title: string; description: string }[] = [
    {
      key: "dataEncryption",
      title: "Data encryption",
      description: "Encrypt financial data at rest using industry best practices.",
    },
    {
      key: "autoBackup",
      title: "Automatic backups",
      description: "Create secure backups on the schedule you configure below.",
    },
    {
      key: "shareAnalytics",
      title: "Share anonymous analytics",
      description: "Help improve CashTrack by sharing anonymized usage insights.",
    },
    {
      key: "rememberDevices",
      title: "Remember trusted devices",
      description: "Skip MFA on devices you use frequently for faster access.",
    },
    {
      key: "requireMfa",
      title: "Require two-factor authentication",
      description: "Always require a secondary factor when signing in.",
    },
  ]

  return (
    <AppLayout
      title="Settings"
      description="Manage your account and application preferences"
      action={
        <Button
          onClick={handleSave}
          disabled={isLoading || isSaving || !draft || !hasUnsavedChanges}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Unable to load settings
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button variant="outline" onClick={fetchSettings}>
                Retry
              </Button>
              <span className="text-sm text-muted-foreground">
                Please check your connection and try again.
              </span>
            </CardContent>
          </Card>
        ) : draft && settings ? (
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Regional preferences
                  </CardTitle>
                  <CardDescription>Set your default currency, date, and locale preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={draft.general.currency}
                        onValueChange={(value) => updateGeneral("currency", value as CurrencyCode)}
                      >
                        <SelectTrigger id="currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={draft.general.language}
                        onValueChange={(value) => updateGeneral("language", value)}
                      >
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="date-format">Date format</Label>
                      <Select
                        value={draft.general.dateFormat}
                        onValueChange={(value) => updateGeneral("dateFormat", value as DateFormat)}
                      >
                        <SelectTrigger id="date-format">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                        <SelectContent>
                          {dateFormatOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start-of-week">Start of week</Label>
                      <Select
                        value={draft.general.startOfWeek}
                        onValueChange={(value) => updateGeneral("startOfWeek", value as StartOfWeek)}
                      >
                        <SelectTrigger id="start-of-week">
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                          {startOfWeekOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance & automation
                  </CardTitle>
                  <CardDescription>Customize how CashTrack looks and how new data is handled.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                        value={draft.general.theme}
                        onValueChange={(value) => updateGeneral("theme", value as ThemePreference)}
                      >
                        <SelectTrigger id="theme">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          {themeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fiscal-year">Fiscal year starts</Label>
                      <Select
                        value={draft.general.fiscalYearStartMonth}
                        onValueChange={(value) => updateGeneral("fiscalYearStartMonth", value)}
                      >
                        <SelectTrigger id="fiscal-year">
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {fiscalMonthOptions.map((month) => (
                            <SelectItem key={month} value={month}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Auto-categorize transactions</p>
                        <p className="text-sm text-muted-foreground">
                          Apply existing rules to new transactions automatically.
                        </p>
                      </div>
                      <Switch
                        checked={draft.general.autoCategorizeTransactions}
                        onCheckedChange={(checked) => updateGeneral("autoCategorizeTransactions", checked)}
                        aria-label="Toggle automatic categorization"
                      />
                    </div>
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Show rounded totals</p>
                        <p className="text-sm text-muted-foreground">
                          Display dashboards with rounded amounts for quick glances.
                        </p>
                      </div>
                      <Switch
                        checked={draft.general.showRoundedTotals}
                        onCheckedChange={(checked) => updateGeneral("showRoundedTotals", checked)}
                        aria-label="Toggle rounded totals"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data-sources" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Connected accounts
                  </CardTitle>
                  <CardDescription>Manage the financial institutions linked to CashTrack.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {accounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No accounts connected yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map((account) => {
                        const autoSyncValue = autoSyncOverrides[account.id] ?? account.autoSync
                        const statusVariant =
                          account.status === "connected"
                            ? "default"
                            : account.status === "error"
                            ? "destructive"
                            : "secondary"
                        return (
                          <div
                            key={account.id}
                            className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{account.name}</span>
                                <Badge variant={statusVariant as never}>{titleCase(account.status)}</Badge>
                                {!account.autoSync && (
                                  <Badge variant="outline">Manual sync</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {account.institution} • Last sync {formatRelativeTime(account.lastSyncAt)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {account.type} • Balance {formatAccountBalance(account.balance, account.currency)}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 lg:w-80">
                              <div className="flex items-center justify-between rounded-lg border p-3">
                                <div className="space-y-1">
                                  <p className="text-xs font-medium uppercase text-muted-foreground">
                                    Automatic sync
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Keep this account up to date automatically.
                                  </p>
                                </div>
                                <Switch
                                  checked={autoSyncValue}
                                  onCheckedChange={(checked) => handleAccountAutoSyncChange(account, checked)}
                                  disabled={updatingAccountId === account.id}
                                  aria-label="Toggle automatic sync"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSyncAccount(account)}
                                  disabled={
                                    syncingAccountId === account.id ||
                                    deletingAccountId === account.id ||
                                    updatingAccountId === account.id
                                  }
                                >
                                  {syncingAccountId === account.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                  )}
                                  {syncingAccountId === account.id ? "Syncing..." : "Sync now"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditAccountDialog(account)}
                                  disabled={
                                    syncingAccountId === account.id ||
                                    deletingAccountId === account.id ||
                                    updatingAccountId === account.id
                                  }
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAccount(account)}
                                  disabled={
                                    deletingAccountId === account.id || syncingAccountId === account.id
                                  }
                                  aria-label="Remove account"
                                >
                                  {deletingAccountId === account.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <Button onClick={openCreateAccountDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Connect new account
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    CSV import templates
                  </CardTitle>
                  <CardDescription>Define reusable mappings for CSV uploads.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {templates.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No templates configured yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{template.name}</span>
                              {!template.active ? <Badge variant="outline">Inactive</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Columns: {template.columns.join(", ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditTemplateDialog(template)}
                              disabled={deletingTemplateId === template.id}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template)}
                              disabled={deletingTemplateId === template.id}
                              aria-label="Delete template"
                            >
                              {deletingTemplateId === template.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={openCreateTemplateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleExportTemplates}
                      disabled={templates.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export templates
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleImportTemplates}
                      disabled={importingTemplates}
                    >
                      {importingTemplates ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {importingTemplates ? "Importing..." : "Import templates"}
                    </Button>
                    <input
                      ref={templateImportInputRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={handleTemplateFileChange}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Email & push notifications
                  </CardTitle>
                  <CardDescription>Choose how you want to be informed about account activity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {notificationGroups.map((group) => (
                      <div key={group.key} className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{group.title}</p>
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        </div>
                        <div className="space-y-2">
                          {group.options.map((option) => (
                            <div key={option.key} className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-1">
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                  {option.title}
                                </p>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              </div>
                              <Switch
                                checked={draft.notifications[option.key]}
                                onCheckedChange={(checked) => updateNotifications(option.key, checked)}
                                aria-label={`Toggle ${option.title}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Stay in the loop</AlertTitle>
                    <AlertDescription>
                      Customize alerts so you only receive the updates that matter. You can change these
                      preferences at any time and the changes will apply immediately.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacy & security
                  </CardTitle>
                  <CardDescription>Control how your data is protected and shared.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {privacyToggles.map((toggle) => (
                      <div
                        key={toggle.key}
                        className="flex items-start justify-between gap-4 rounded-lg border p-4"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{toggle.title}</p>
                          <p className="text-sm text-muted-foreground">{toggle.description}</p>
                        </div>
                        <Switch
                          checked={draft.privacy[toggle.key]}
                          onCheckedChange={(checked) => updatePrivacy(toggle.key, checked)}
                          aria-label={`Toggle ${toggle.title}`}
                        />
                      </div>
                    ))}
                  </div>
                  {!draft.privacy.requireMfa ? (
                    <Alert variant="destructive">
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Protect your account</AlertTitle>
                      <AlertDescription>
                        Enable two-factor authentication to add an extra layer of protection. We strongly
                        recommend keeping this setting on for all financial accounts.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Two-factor authentication enabled</AlertTitle>
                      <AlertDescription>
                        We&apos;ll remember trusted devices for faster access, but we may still prompt for
                        verification when something looks unusual.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CloudUpload className="h-5 w-5" />
                    Backup configuration
                  </CardTitle>
                  <CardDescription>
                    Manage automatic backups and export your data whenever you need a snapshot.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="backup-frequency">Automatic backup frequency</Label>
                      <Select
                        value={draft.backups.autoBackupFrequency}
                        onValueChange={(value) => updateBackupSettings("autoBackupFrequency", value as BackupFrequency)}
                      >
                        <SelectTrigger id="backup-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {backupFrequencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backup-retention">Retention (days)</Label>
                      <Input
                        id="backup-retention"
                        type="number"
                        min={7}
                        value={draft.backups.retentionDays}
                        onChange={(event) =>
                          updateBackupSettings("retentionDays", Number(event.target.value) || 0)
                        }
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleCreateBackup} disabled={creatingBackup}>
                      {creatingBackup ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CloudUpload className="mr-2 h-4 w-4" />
                      )}
                      {creatingBackup ? "Creating backup..." : "Create manual backup"}
                    </Button>
                    <Button variant="outline" onClick={handleExportData}>
                      <Download className="mr-2 h-4 w-4" />
                      Export data
                    </Button>
                    <Button variant="outline" onClick={handleImportData}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import data
                    </Button>
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Automatic cleanup</AlertTitle>
                    <AlertDescription>
                      Backups older than {draft.backups.retentionDays} days are automatically removed to help
                      manage storage. Adjust the retention window above to keep snapshots longer.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Backup history
                  </CardTitle>
                  <CardDescription>
                    {lastBackupAt
                      ? `Last backup ${formatRelativeTime(lastBackupAt)}.`
                      : "No backups have been created yet."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {backupHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      There are no backups yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {backupHistory.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 text-sm font-medium">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDateTime(backup.createdAt)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {titleCase(backup.type)} backup • {formatBackupSize(backup.size)}
                            </p>
                            {backup.notes ? (
                              <p className="text-xs text-muted-foreground">{backup.notes}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadBackup(backup)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBackup(backup)}
                              disabled={deletingBackupId === backup.id}
                              aria-label="Delete backup"
                            >
                              {deletingBackupId === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={handleAccountDialogOpenChange}>
        <DialogContent>
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {accountDialogMode === "create" ? "Connect account" : "Edit account"}
              </DialogTitle>
              <DialogDescription>
                Link a financial institution to automatically import transactions into CashTrack.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account name</Label>
                <Input
                  id="account-name"
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                  placeholder="Ex. Everyday Checking"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-institution">Institution</Label>
                <Input
                  id="account-institution"
                  value={accountForm.institution}
                  onChange={(event) =>
                    setAccountForm((previous) => ({ ...previous, institution: event.target.value }))
                  }
                  placeholder="Ex. Community Credit Union"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-type">Account type</Label>
                <Select
                  value={accountForm.type}
                  onValueChange={(value) =>
                    setAccountForm((previous) => ({ ...previous, type: value as AccountType }))
                  }
                >
                  <SelectTrigger id="account-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-currency">Currency</Label>
                <Select
                  value={accountForm.currency}
                  onValueChange={(value) =>
                    setAccountForm((previous) => ({ ...previous, currency: value as CurrencyCode }))
                  }
                >
                  <SelectTrigger id="account-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-balance">Current balance</Label>
                <Input
                  id="account-balance"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={accountForm.balance}
                  onChange={(event) =>
                    setAccountForm((previous) => ({ ...previous, balance: event.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the balance reported by your institution.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Enable automatic sync</p>
                  <p className="text-sm text-muted-foreground">
                    Fetch new transactions from this institution every day.
                  </p>
                </div>
                <Switch
                  checked={accountForm.autoSync}
                  onCheckedChange={(checked) =>
                    setAccountForm((previous) => ({ ...previous, autoSync: checked }))
                  }
                  aria-label="Toggle automatic sync"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAccountDialogOpenChange(false)}
                disabled={accountSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={accountSubmitting}>
                {accountSubmitting
                  ? "Saving..."
                  : accountDialogMode === "create"
                  ? "Connect account"
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={handleTemplateDialogOpenChange}>
        <DialogContent>
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {templateDialogMode === "create" ? "Add CSV template" : "Edit CSV template"}
              </DialogTitle>
              <DialogDescription>
                Define how CashTrack should read and map columns from imported CSV files.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template name</Label>
                <Input
                  id="template-name"
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                  placeholder="Ex. Downtown Bank"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-delimiter">Delimiter</Label>
                <Select
                  value={templateForm.delimiter}
                  onValueChange={(value) =>
                    setTemplateForm((previous) => ({ ...previous, delimiter: value }))
                  }
                >
                  <SelectTrigger id="template-delimiter">
                    <SelectValue placeholder="Select delimiter" />
                  </SelectTrigger>
                  <SelectContent>
                    {delimiterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={templateForm.description}
                onChange={(event) =>
                  setTemplateForm((previous) => ({ ...previous, description: event.target.value }))
                }
                placeholder="Optional notes about this template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-columns">Columns</Label>
              <Textarea
                id="template-columns"
                value={templateForm.columns}
                onChange={(event) =>
                  setTemplateForm((previous) => ({ ...previous, columns: event.target.value }))
                }
                placeholder="Date, Description, Amount"
              />
              <p className="text-xs text-muted-foreground">
                Enter column names separated by commas or line breaks.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-date-column">Date column</Label>
                <Input
                  id="template-date-column"
                  value={templateForm.dateColumn}
                  onChange={(event) =>
                    setTemplateForm((previous) => ({ ...previous, dateColumn: event.target.value }))
                  }
                  placeholder="Date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-amount-column">Amount column</Label>
                <Input
                  id="template-amount-column"
                  value={templateForm.amountColumn}
                  onChange={(event) =>
                    setTemplateForm((previous) => ({ ...previous, amountColumn: event.target.value }))
                  }
                  placeholder="Amount"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description-column">Description column</Label>
              <Input
                id="template-description-column"
                value={templateForm.descriptionColumn}
                onChange={(event) =>
                  setTemplateForm((previous) => ({ ...previous, descriptionColumn: event.target.value }))
                }
                placeholder="Description"
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">File includes header row</p>
                  <p className="text-sm text-muted-foreground">
                    Skip the first row when importing transactions.
                  </p>
                </div>
                <Switch
                  checked={templateForm.hasHeaders}
                  onCheckedChange={(checked) =>
                    setTemplateForm((previous) => ({ ...previous, hasHeaders: checked }))
                  }
                  aria-label="Toggle header row"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Template active</p>
                  <p className="text-sm text-muted-foreground">
                    Inactive templates remain saved but hidden during import.
                  </p>
                </div>
                <Switch
                  checked={templateForm.active}
                  onCheckedChange={(checked) =>
                    setTemplateForm((previous) => ({ ...previous, active: checked }))
                  }
                  aria-label="Toggle template activity"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTemplateDialogOpenChange(false)}
                disabled={templateSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={templateSubmitting}>
                {templateSubmitting
                  ? "Saving..."
                  : templateDialogMode === "create"
                  ? "Create template"
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
