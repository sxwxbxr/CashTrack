
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  ArrowUpDown,
  Loader2,
  ArrowLeftRight,
  Settings,
  RefreshCcw,
  Pause,
  Play,
  SkipForward,
  Repeat,
} from "lucide-react"
import { TransactionImportDialog } from "@/components/transaction-import-dialog"
import { TransactionFormDialog, type TransactionFormValues } from "@/components/transaction-form-dialog"
import { TransferDialog, type TransferFormValues } from "@/components/transfer-dialog"
import { AccountManagerDialog } from "@/components/account-manager-dialog"
import type { AppSettingsPayload } from "@/lib/settings/types"
import type {
  RecurrenceUnit,
  RecurringTransaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/transactions/types"
import { toast } from "sonner"
import { useTranslations } from "@/components/language-provider"

interface Transaction {
  id: string
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  exchangeRate: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string | null
  transferGroupId?: string | null
  transferDirection?: "in" | "out" | null
}

interface TransactionsResponse {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  totals: {
    income: number
    expenses: number
    net: number
  }
}

interface CategoryOption {
  id: string
  name: string
  color: string
}

interface AccountOption {
  id: string
  name: string
  currency: string
}

interface AccountSummary {
  id: string
  name: string
  currency: string
  balance: number
  inflow: number
  outflow: number
  transactions: number
  balanceInBase: number
  inflowInBase: number
  outflowInBase: number
}

interface SettingsResponse {
  settings: AppSettingsPayload
}

interface RecurringResponse {
  schedules: RecurringTransaction[]
}

const DEFAULT_CATEGORY_FILTER = "all"
const RECURRENCE_UNIT_ORDER: RecurrenceUnit[] = ["day", "week", "month", "year"]

function getIntervalLabel(t: (key: string, params?: Record<string, unknown>) => string, unit: RecurrenceUnit, interval: number) {
  if (unit === "day") {
    return interval === 1 ? t("Every day") : t("Every {{count}} days", { values: { count: interval.toString() } })
  }
  if (unit === "week") {
    return interval === 1 ? t("Every week") : t("Every {{count}} weeks", { values: { count: interval.toString() } })
  }
  if (unit === "month") {
    return interval === 1 ? t("Every month") : t("Every {{count}} months", { values: { count: interval.toString() } })
  }
  return interval === 1 ? t("Every year") : t("Every {{count}} years", { values: { count: interval.toString() } })
}

function computeNextRunDate(date: string, interval: number, unit: RecurrenceUnit) {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }
  switch (unit) {
    case "day":
      parsed.setUTCDate(parsed.getUTCDate() + interval)
      break
    case "week":
      parsed.setUTCDate(parsed.getUTCDate() + interval * 7)
      break
    case "month":
      parsed.setUTCMonth(parsed.getUTCMonth() + interval)
      break
    case "year":
      parsed.setUTCFullYear(parsed.getUTCFullYear() + interval)
      break
    default:
      parsed.setUTCDate(parsed.getUTCDate() + interval)
      break
  }
  return parsed.toISOString().slice(0, 10)
}

export default function TransactionsPage() {
  const { t } = useTranslations()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>(DEFAULT_CATEGORY_FILTER)
  const [sortField, setSortField] = useState<"date" | "amount" | "description">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totals, setTotals] = useState({ income: 0, expenses: 0, net: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([])
  const [accountCurrencyMap, setAccountCurrencyMap] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<AppSettingsPayload | null>(null)
  const [baseCurrency, setBaseCurrency] = useState<string>("USD")
  const baseCurrencyRef = useRef(baseCurrency)
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({})
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(["USD"])
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringTransaction[]>([])
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isManageAccountsOpen, setIsManageAccountsOpen] = useState(false)

  const currencyFormatters = useRef<Map<string, Intl.NumberFormat>>(new Map())

  const statusLabels = useMemo(
    () => ({
      pending: t("Pending"),
      cleared: t("Cleared"),
      completed: t("Completed"),
    }),
    [t],
  )

  const baseFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: baseCurrency,
        minimumFractionDigits: 2,
      }),
    [baseCurrency],
  )

  useEffect(() => {
    currencyFormatters.current.clear()
  }, [baseCurrency])

  useEffect(() => {
    baseCurrencyRef.current = baseCurrency
  }, [baseCurrency])

  const formatCurrency = useCallback(
    (value: number, currencyCode?: string) => {
      const resolved = (currencyCode || baseCurrency || "USD").toUpperCase()
      if (!currencyFormatters.current.has(resolved)) {
        try {
          currencyFormatters.current.set(
            resolved,
            new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: resolved,
              minimumFractionDigits: 2,
            }),
          )
        } catch {
          currencyFormatters.current.set(
            resolved,
            new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: baseCurrency,
              minimumFractionDigits: 2,
            }),
          )
        }
      }
      return currencyFormatters.current.get(resolved)!.format(value)
    },
    [baseCurrency],
  )

  const totalBalance = useMemo(
    () => accountSummaries.reduce((sum, account) => sum + account.balanceInBase, 0),
    [accountSummaries],
  )

  const formatDateValue = useCallback(
    (value: string) => {
      if (!value) return "-"
      try {
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) {
          return value
        }
        return format(parsed, settings?.dateFormat ?? "yyyy-MM-dd")
      } catch {
        return new Date(value).toLocaleDateString()
      }
    },
    [settings?.dateFormat],
  )

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Unable to load settings"))
      }
      const data = (await response.json()) as SettingsResponse
      setSettings(data.settings)
      setBaseCurrency(data.settings.baseCurrency)
      setCurrencyRates(data.settings.currencyRates)
      setAvailableCurrencies(
        Array.from(new Set([data.settings.baseCurrency, ...data.settings.knownCurrencies])).sort(),
      )
    } catch (loadError) {
      console.error(loadError)
      toast.error(t("Unable to load settings"))
    }
  }, [t])

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Failed to load categories"))
      }
      const data = (await response.json()) as {
        categories: Array<{ id: string; name: string; color: string }>
      }
      setCategories(
        data.categories.map((category) => ({
          id: category.id,
          name: category.name,
          color: category.color,
        })),
      )
    } catch (loadError) {
      console.error(loadError)
      toast.error(t("Unable to load categories"), {
        description: loadError instanceof Error ? loadError.message : undefined,
      })
    }
  }, [t])

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Failed to load accounts"))
      }

      const data = (await response.json()) as {
        accounts: Array<{
          id: string
          name: string
          currency?: string
          balance?: number
          inflow?: number
          outflow?: number
          transactions?: number
          balanceInBase?: number
          inflowInBase?: number
          outflowInBase?: number
        }>
      }

      const summaries = data.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency ? account.currency.toUpperCase() : baseCurrency,
        balance: Number(account.balance ?? 0),
        inflow: Number(account.inflow ?? 0),
        outflow: Number(account.outflow ?? 0),
        transactions: Number(account.transactions ?? 0),
        balanceInBase: Number(account.balanceInBase ?? account.balance ?? 0),
        inflowInBase: Number(account.inflowInBase ?? account.inflow ?? 0),
        outflowInBase: Number(account.outflowInBase ?? account.outflow ?? 0),
      }))

      summaries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      setAccountSummaries(summaries)
      setAccounts(summaries.map(({ id, name, currency }) => ({ id, name, currency })))

      const map: Record<string, string> = {}
      summaries.forEach((account) => {
        map[account.name.toLowerCase()] = account.currency
      })
      setAccountCurrencyMap(map)
    } catch (loadError) {
      console.error(loadError)
      toast.error(t("Unable to load accounts"), {
        description: loadError instanceof Error ? loadError.message : undefined,
      })
    }
  }, [baseCurrency, t])

  const loadRecurringTransactions = useCallback(async () => {
    setRecurringLoading(true)
    try {
      const response = await fetch("/api/transactions/recurring", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Failed to load recurring transactions"))
      }
      const data = (await response.json()) as RecurringResponse
      const sorted = [...data.schedules].sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))
      setRecurringSchedules(sorted)
    } catch (loadError) {
      console.error(loadError)
      toast.error(t("Unable to load recurring transactions"), {
        description: loadError instanceof Error ? loadError.message : undefined,
      })
    } finally {
      setRecurringLoading(false)
    }
  }, [t])

  const fetchTransactions = useCallback(async () => {
      setIsLoading(true)
      setError(null)
    try {
      const params = new URLSearchParams({
        sortField,
        sortDirection,
      })
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim())
      }
      if (categoryFilter === "uncategorized") {
        params.set("categoryName", "Uncategorized")
      } else if (categoryFilter !== DEFAULT_CATEGORY_FILTER) {
        params.set("categoryId", categoryFilter)
      }

      const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : t("Failed to load transactions")
        throw new Error(message)
      }

      const data = (await response.json()) as TransactionsResponse
      setTransactions(
        data.transactions.map((transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
          accountAmount: Number(transaction.accountAmount ?? transaction.amount),
          originalAmount: Number(transaction.originalAmount ?? transaction.amount),
        })),
      )
      setTotalCount(data.total)
      setTotals(data.totals)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : t("Failed to load transactions")
      setError(message)
      toast.error(t("Unable to load transactions"), { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, categoryFilter, sortField, sortDirection, t])

  useEffect(() => {
    loadSettings()
    loadCategories()
    loadAccounts()
    loadRecurringTransactions()
  }, [loadSettings, loadCategories, loadAccounts, loadRecurringTransactions])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTransactions()
    }, 200)

    return () => clearTimeout(timeout)
  }, [fetchTransactions])

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) {
        return
      }
      loadCategories()
      loadAccounts()
      loadRecurringTransactions()
      fetchTransactions()
    }

    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [fetchTransactions, loadAccounts, loadCategories, loadRecurringTransactions])

  useEffect(() => {
    if (!settings) {
      return
    }
    setBaseCurrency(settings.baseCurrency)
    setCurrencyRates(settings.currencyRates)
    setAvailableCurrencies(
      Array.from(new Set([settings.baseCurrency, ...settings.knownCurrencies])).sort(),
    )
  }, [settings])

  const handleSort = (field: "date" | "amount" | "description") => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const openCreateDialog = () => {
    setFormMode("create")
    setSelectedTransaction(null)
    setIsFormOpen(true)
  }

  const openEditDialog = (transaction: Transaction) => {
    if (transaction.type === "transfer") {
      toast.info(t("Transfers cannot be edited. Delete and recreate the transfer instead."))
      return
    }
    setFormMode("edit")
    setSelectedTransaction(transaction)
    setIsFormOpen(true)
  }

  const createAccount = useCallback(
    async ({ name, currency }: { name: string; currency?: string }) => {
      const normalizedCurrency = currency ? currency.toUpperCase() : undefined
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency: normalizedCurrency }),
      })

      const body = (await response.json().catch(() => ({}))) as {
        account?: { id: string; name: string; currency: string }
        error?: unknown
      }

      if (!response.ok || !body.account) {
        const message = typeof body.error === "string" ? body.error : t("Unable to create account")
        toast.error(t("Unable to create account"), { description: message })
        throw new Error(message)
      }

      toast.success(t("Account created"), { description: body.account.name })
      await loadAccounts()
      return body.account
    },
    [loadAccounts, t],
  )

  const handleManagedAccountCreate = useCallback(
    async ({ name, currency }: { name: string; currency: string }) => {
      const normalizedCurrency = currency?.trim().toUpperCase() || baseCurrency
      const account = await createAccount({ name, currency: normalizedCurrency })
      setAvailableCurrencies((previous) =>
        Array.from(new Set([...previous, (account.currency ?? normalizedCurrency).toUpperCase()])).sort(),
      )
    },
    [baseCurrency, createAccount],
  )

  const handleFormAccountCreate = useCallback(
    async ({ name, currency }: { name: string; currency: string }) => {
      const normalizedCurrency = currency?.trim().toUpperCase() || baseCurrency
      const account = await createAccount({ name, currency: normalizedCurrency })
      setAvailableCurrencies((previous) =>
        Array.from(new Set([...previous, (account.currency ?? normalizedCurrency).toUpperCase()])).sort(),
      )
      return {
        id: account.id,
        name: account.name,
        currency: account.currency ?? normalizedCurrency ?? baseCurrency,
      }
    },
    [baseCurrency, createAccount],
  )

  const handleFormSubmit = useCallback(
    async (values: TransactionFormValues) => {
      const originalAmount = Number(values.amount)
      if (!Number.isFinite(originalAmount)) {
        throw new Error(t("Amount must be a number"))
      }

      const accountAmountInput = values.accountAmount ? values.accountAmount.trim() : ""
      const accountAmountValue = accountAmountInput ? Number(accountAmountInput) : undefined
      if (accountAmountInput && !Number.isFinite(accountAmountValue)) {
        throw new Error(t("Account amount must be a number"))
      }

      const currencyCode = values.currency
        ? values.currency.trim().toUpperCase()
        : baseCurrencyRef.current

      const payload: Record<string, unknown> = {
        date: values.date,
        description: values.description,
        categoryId: values.categoryId,
        categoryName: values.categoryName || "Uncategorized",
        amount: Math.abs(originalAmount),
        originalAmount: Math.abs(originalAmount),
        accountAmount: accountAmountValue !== undefined ? Math.abs(accountAmountValue) : undefined,
        currency: currencyCode,
        account: values.account,
        status: values.status,
        type: values.type,
        ...(values.notes ? { notes: values.notes } : {}),
      }

      if (values.isRecurring) {
        payload.recurrence = {
          interval: values.recurrenceInterval,
          unit: values.recurrenceUnit,
          ...(values.recurrenceStartDate
            ? { startDate: values.recurrenceStartDate }
            : {}),
        }
      }

      if (formMode === "create") {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({} as { error?: unknown }))
          const message = typeof body.error === "string" ? body.error : t("Unable to create transaction")
          throw new Error(message)
        }

        toast.success(t("Transaction added"))
      } else if (selectedTransaction) {
        const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({} as { error?: unknown }))
          const message = typeof body.error === "string" ? body.error : t("Unable to update transaction")
          throw new Error(message)
        }

        toast.success(t("Transaction updated"))
      }

      await fetchTransactions()
      await loadAccounts()
      await loadRecurringTransactions()
    },
    [fetchTransactions, formMode, loadAccounts, loadRecurringTransactions, selectedTransaction, t],
  )

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const amountValue = Number(values.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new Error(t("Amount must be greater than zero"))
    }

    const payload = {
      date: values.date,
      description: values.description,
      amount: amountValue,
      fromAccount: values.fromAccount,
      toAccount: values.toAccount,
      status: values.status,
      ...(values.notes ? { notes: values.notes } : {}),
    }

    const response = await fetch("/api/transactions/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const body = (await response.json().catch(() => ({}))) as {
      transferId?: string
      error?: unknown
    }

    if (!response.ok || !body.transferId) {
      const message = typeof body.error === "string" ? body.error : t("Unable to create transfer")
      throw new Error(message)
    }

    toast.success(t("Transfer created"))
    await fetchTransactions()
    await loadAccounts()
  }

  const handleRenameAccount = useCallback(
    async (id: string, name: string) => {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const body = (await response.json().catch(() => ({}))) as {
        account?: { id: string; name: string }
        error?: unknown
      }

      if (!response.ok || !body.account) {
        const message = typeof body.error === "string" ? body.error : t("Unable to update account")
        throw new Error(message)
      }

      toast.success(t("Account renamed"), { description: body.account.name })
      await fetchTransactions()
      await loadAccounts()
    },
    [fetchTransactions, loadAccounts, t],
  )

  const handleChangeAccountCurrency = useCallback(
    async (id: string, currency: string) => {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      })

      const body = (await response.json().catch(() => ({}))) as {
        account?: { id: string; name: string; currency: string }
        error?: unknown
      }

      if (!response.ok || !body.account) {
        const message = typeof body.error === "string" ? body.error : t("Unable to update account")
        throw new Error(message)
      }

      toast.success(t("Account updated"), { description: `${body.account.name} · ${body.account.currency}` })
      setAvailableCurrencies((previous) =>
        Array.from(new Set([...previous, body.account.currency.toUpperCase()])).sort(),
      )
      await fetchTransactions()
      await loadAccounts()
    },
    [fetchTransactions, loadAccounts, t],
  )

  const handleDeleteAccount = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" })
      const body = (await response.json().catch(() => ({}))) as { error?: unknown }

      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : t("Unable to delete account")
        throw new Error(message)
      }

      toast.success(t("Account deleted"))
      await fetchTransactions()
      await loadAccounts()
    },
    [fetchTransactions, loadAccounts, t],
  )

  const handleDelete = async (transaction: Transaction) => {
    const confirmed = window.confirm(
      transaction.type === "transfer"
        ? t("Delete this transfer? Both linked entries will be removed.")
        : t("Delete this transaction?"),
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : t("Unable to delete transaction")
        throw new Error(message)
      }

      toast.success(t("Transaction deleted"))
      await fetchTransactions()
      await loadAccounts()
      await loadRecurringTransactions()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : t("Unable to delete transaction")
      toast.error(t("Delete failed"), { description: message })
    }
  }

  const handleImportComplete = (count: number) => {
    if (count > 0) {
      toast.success(t("{{count}} transactions imported", { values: { count: count.toString() } }))
    } else {
      toast.info(t("No new transactions imported"))
    }
    fetchTransactions()
    loadAccounts()
    loadRecurringTransactions()
  }

  const handleToggleRecurring = useCallback(
    async (schedule: RecurringTransaction, nextActive: boolean) => {
      try {
        const response = await fetch(`/api/transactions/recurring/${schedule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextActive }),
        })
        if (!response.ok) {
          throw new Error()
        }
        toast.success(nextActive ? t("Recurring schedule resumed") : t("Recurring schedule paused"))
        await loadRecurringTransactions()
        await fetchTransactions()
      } catch (toggleError) {
        console.error(toggleError)
        toast.error(t("Unable to update recurring schedule"))
      }
    },
    [fetchTransactions, loadRecurringTransactions, t],
  )

  const handleSkipRecurring = useCallback(
    async (schedule: RecurringTransaction) => {
      try {
        const nextDate = computeNextRunDate(schedule.nextRunDate, schedule.interval, schedule.unit)
        const response = await fetch(`/api/transactions/recurring/${schedule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextRunDate: nextDate }),
        })
        if (!response.ok) {
          throw new Error()
        }
        toast.success(t("Next occurrence skipped"))
        await loadRecurringTransactions()
        await fetchTransactions()
      } catch (skipError) {
        console.error(skipError)
        toast.error(t("Unable to skip recurring transaction"))
      }
    },
    [fetchTransactions, loadRecurringTransactions, t],
  )

  const handleDeleteRecurringSchedule = useCallback(
    async (schedule: RecurringTransaction) => {
      const confirmed = window.confirm(
        t("Delete recurring schedule {{name}}?", { values: { name: schedule.description } }),
      )
      if (!confirmed) {
        return
      }
      try {
        const response = await fetch(`/api/transactions/recurring/${schedule.id}`, {
          method: "DELETE",
        })
        if (!response.ok) {
          throw new Error()
        }
        toast.success(t("Recurring schedule removed"))
        await loadRecurringTransactions()
        await fetchTransactions()
      } catch (deleteError) {
        console.error(deleteError)
        toast.error(t("Unable to delete recurring schedule"))
      }
    },
    [fetchTransactions, loadRecurringTransactions, t],
  )

  const selectedTransactionValues = useMemo(() => {
    if (!selectedTransaction || selectedTransaction.type === "transfer") return undefined
    const original = Math.abs(selectedTransaction.originalAmount ?? selectedTransaction.amount)
    const accountAmt =
      typeof selectedTransaction.accountAmount === "number"
        ? Math.abs(selectedTransaction.accountAmount)
        : null
    return {
      date: selectedTransaction.date,
      description: selectedTransaction.description,
      categoryId: selectedTransaction.categoryId,
      categoryName: selectedTransaction.categoryName,
      amount: Number.isFinite(original) ? original.toString() : "",
      accountAmount: accountAmt !== null && Number.isFinite(accountAmt) ? accountAmt.toString() : "",
      currency: (selectedTransaction.currency || baseCurrency).toUpperCase(),
      account: selectedTransaction.account,
      type: selectedTransaction.type,
      status: selectedTransaction.status,
      notes: selectedTransaction.notes ?? "",
      isRecurring: false,
      recurrenceInterval: 1,
      recurrenceUnit: "month" as RecurrenceUnit,
      recurrenceStartDate: "",
    }
  }, [selectedTransaction, baseCurrency])

  const renderTableBody = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("Loading transactions...")}
            </div>
          </TableCell>
        </TableRow>
      )
    }

    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={8} className="h-24 text-center text-sm text-red-500">
            {error}
          </TableCell>
        </TableRow>
      )
    }

    if (transactions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
            {t("No transactions found. Try adjusting your filters.")}
          </TableCell>
        </TableRow>
      )
    }

    return transactions.map((transaction) => {
      const isTransfer = transaction.type === "transfer"
      const isInboundTransfer = isTransfer && (transaction.transferDirection === "in" || transaction.amount > 0)
      const amountValue = Math.abs(transaction.accountAmount ?? transaction.amount)
      const baseValue = Math.abs(transaction.amount)
      const formattedAccountAmount = formatCurrency(amountValue, transaction.currency)
      const formattedBaseAmount = baseFormatter.format(baseValue)
      const amountClass = isTransfer
        ? isInboundTransfer
          ? "text-sky-600"
          : "text-amber-600"
        : transaction.amount > 0
        ? "text-green-600"
        : "text-red-600"
      const amountPrefix = isTransfer
        ? isInboundTransfer
          ? "+"
          : "-"
        : transaction.amount > 0
        ? "+"
        : "-"

      return (
        <TableRow key={transaction.id}>
          <TableCell className="font-medium">{formatDateValue(transaction.date)}</TableCell>
          <TableCell>
            <div className="max-w-[320px] space-y-1">
              <p className="truncate font-medium">{transaction.description}</p>
              {isTransfer && (
                <Badge variant="outline" className="w-max text-xs">
                  {isInboundTransfer ? t("Transfer in") : t("Transfer out")}
                </Badge>
              )}
              {transaction.notes && <p className="truncate text-xs text-muted-foreground">{transaction.notes}</p>}
            </div>
          </TableCell>
          <TableCell>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
              {transaction.categoryName}
            </span>
          </TableCell>
          <TableCell>{transaction.account}</TableCell>
          <TableCell className={`font-medium ${amountClass}`}>
            {amountPrefix}
            {formattedAccountAmount.replace(/^[+-]/, "")}
          </TableCell>
          <TableCell className="font-medium">{formattedBaseAmount}</TableCell>
          <TableCell>{statusLabels[transaction.status]}</TableCell>
          <TableCell className="flex justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(transaction)} aria-label={t("Edit transaction")}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(transaction)}
              aria-label={t("Delete transaction")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      )
    })
  }

  const renderRecurringSchedules = () => {
    if (recurringLoading) {
      return (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("Loading recurring payments...")}
        </div>
      )
    }

    if (recurringSchedules.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t("No recurring schedules yet. Add one by creating a transaction and enabling recurrence.")}
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {recurringSchedules.map((schedule) => {
          const accountAmount = Math.abs(schedule.accountAmount ?? schedule.originalAmount ?? schedule.amount ?? 0)
          const baseAmount = Math.abs(schedule.amount ?? 0)
          const statusBadge = schedule.isActive ? (
            <Badge variant="secondary" className="text-xs">
              {t("Active")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {t("Paused")}
            </Badge>
          )

          return (
            <div key={schedule.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{schedule.description}</span>
                  {statusBadge}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{t("Account: {{value}}", { values: { value: schedule.account } })}</span>
                  <span>{t("Next run: {{date}}", { values: { date: formatDateValue(schedule.nextRunDate) } })}</span>
                  <span>{getIntervalLabel(t, schedule.unit, schedule.interval)}</span>
                </div>
              </div>
              <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center">
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium">{formatCurrency(accountAmount, schedule.currency)}</p>
                  <p className="text-xs text-muted-foreground">{baseFormatter.format(baseAmount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleRecurring(schedule, !schedule.isActive)}
                    aria-label={schedule.isActive ? t("Pause schedule") : t("Resume schedule")}
                  >
                    {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSkipRecurring(schedule)}
                    aria-label={t("Skip next occurrence")}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRecurringSchedule(schedule)}
                    aria-label={t("Delete schedule")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <AppLayout
      title={t("Transactions")}
      description={t("Track income, expenses, and transfers across your accounts.")}
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsManageAccountsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            {t("Manage accounts")}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("Add transaction")}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("Overview")}</CardTitle>
            <CardDescription>
              {t("Balances converted to {{currency}}", { values: { currency: baseCurrency } })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("Total balance")}</p>
                <p className="text-2xl font-semibold">{baseFormatter.format(totalBalance)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("Income (base currency)")}</p>
                <p className="text-lg font-semibold text-green-600">{baseFormatter.format(totals.income)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("Expenses (base currency)")}</p>
                <p className="text-lg font-semibold text-red-600">{baseFormatter.format(totals.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Filter Transactions")}</CardTitle>
            <CardDescription>{t("Search and filter your transactions")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("Search transactions...")}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_CATEGORY_FILTER}>{t("All Categories")}</SelectItem>
                  <SelectItem value="uncategorized">{t("Uncategorized")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("Import")}
                </Button>
                <Button variant="outline" onClick={() => setIsTransferOpen(true)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {t("New transfer")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("Recurring payments")}</CardTitle>
              <CardDescription>
                {t("Automatically create upcoming transactions for repeating expenses or income.")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadRecurringTransactions}
              aria-label={t("Refresh recurring schedules")}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>{renderRecurringSchedules()}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("All Transactions")}</CardTitle>
            <CardDescription>
              {t("Showing {{visible}} of {{total}} transactions · Income: {{income}} · Expenses: {{expenses}}", {
                values: {
                  visible: transactions.length.toString(),
                  total: totalCount.toString(),
                  income: baseFormatter.format(totals.income),
                  expenses: baseFormatter.format(totals.expenses),
                },
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("date")} className="h-auto p-0 font-semibold">
                        {t("Date")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("description")}
                        className="h-auto p-0 font-semibold"
                      >
                        {t("Description")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>{t("Category")}</TableHead>
                    <TableHead>{t("Account")}</TableHead>
                    <TableHead>{t("Account amount")}</TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("amount")} className="h-auto p-0 font-semibold">
                        {t("Base amount")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableBody()}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onComplete={handleImportComplete} />
      <TransactionFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        onSubmit={handleFormSubmit}
        initialValues={selectedTransactionValues}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        accounts={accounts}
        baseCurrency={baseCurrency}
        availableCurrencies={availableCurrencies}
        currencyRates={currencyRates}
        accountCurrencyMap={accountCurrencyMap}
        onCreateAccount={handleFormAccountCreate}
      />
      <TransferDialog
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        accounts={accounts}
        onSubmit={handleTransferSubmit}
        onCreateAccount={handleFormAccountCreate}
        baseCurrency={baseCurrency}
        availableCurrencies={availableCurrencies}
      />
      <AccountManagerDialog
        open={isManageAccountsOpen}
        onOpenChange={setIsManageAccountsOpen}
        accounts={accountSummaries}
        baseCurrency={baseCurrency}
        availableCurrencies={availableCurrencies}
        onCreate={handleManagedAccountCreate}
        onRename={handleRenameAccount}
        onChangeCurrency={handleChangeAccountCurrency}
        onDelete={handleDeleteAccount}
      />
    </AppLayout>
  )
}
