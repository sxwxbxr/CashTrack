"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Search, Filter, Plus, Edit, Trash2, ArrowUpDown, Loader2, ArrowLeftRight, Settings } from "lucide-react"
import { TransactionImportDialog } from "@/components/transaction-import-dialog"
import { TransactionFormDialog, type TransactionFormValues } from "@/components/transaction-form-dialog"
import { TransferDialog, type TransferFormValues } from "@/components/transfer-dialog"
import { AccountManagerDialog } from "@/components/account-manager-dialog"
import type { TransactionStatus, TransactionType } from "@/lib/transactions/types"
import { toast } from "sonner"
import { useTranslations } from "@/components/language-provider"
import { useAppSettings } from "@/components/settings-provider"
import { formatDateWithPattern } from "@/lib/formatting/dates"

interface Transaction {
  id: string
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: number
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
}

interface AccountSummary {
  id: string
  name: string
  balance: number
  inflow: number
  outflow: number
  transactions: number
}

const DEFAULT_CATEGORY_FILTER = "all"

export default function TransactionsPage() {
  const { t, language } = useTranslations()
  const { settings } = useAppSettings()
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: settings?.currency ?? "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [settings?.currency],
  )
  const dateFormat = settings?.dateFormat ?? "MM/DD/YYYY"
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
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isManageAccountsOpen, setIsManageAccountsOpen] = useState(false)
  const statusLabels = useMemo(
    () => ({
      pending: t("Pending"),
      cleared: t("Cleared"),
      completed: t("Completed"),
    }),
    [t],
  )
  const totalBalance = useMemo(
    () => accountSummaries.reduce((sum, account) => sum + account.balance, 0),
    [accountSummaries],
  )

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(t("Failed to load categories"))
      }
      const data = (await response.json()) as { categories: Array<{ id: string; name: string; color: string }> }
      setCategories(data.categories.map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
      })))
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
          balance?: number
          inflow?: number
          outflow?: number
          transactions?: number
        }>
      }

      const summaries = data.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: Number(account.balance ?? 0),
        inflow: Number(account.inflow ?? 0),
        outflow: Number(account.outflow ?? 0),
        transactions: Number(account.transactions ?? 0),
      }))

      summaries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      setAccountSummaries(summaries)
      setAccounts(summaries.map(({ id, name }) => ({ id, name })))
    } catch (loadError) {
      console.error(loadError)
      toast.error(t("Unable to load accounts"), {
        description: loadError instanceof Error ? loadError.message : undefined,
      })
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
      setTransactions(data.transactions)
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
    loadCategories()
    loadAccounts()
  }, [loadCategories, loadAccounts])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTransactions()
    }, 200)

    return () => clearTimeout(timeout)
  }, [fetchTransactions])

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

  const handleFormSubmit = async (values: TransactionFormValues) => {
    const amount = Number(values.amount)
    if (Number.isNaN(amount)) {
      throw new Error(t("Amount must be a number"))
    }

    const parsedInterval = Number.parseInt(values.recurrenceInterval, 10)
    const recurrence =
      values.recurrenceType === "recurring" && Number.isFinite(parsedInterval) && parsedInterval > 0
        ? {
            frequency: "monthly" as const,
            interval: Math.max(1, parsedInterval),
            startDate: values.date,
          }
        : undefined

    const payload = {
      date: values.date,
      description: values.description,
      categoryId: values.categoryId,
      categoryName: values.categoryName || "Uncategorized",
      amount: Math.abs(amount),
      account: values.account,
      status: values.status,
      type: values.type,
      ...(values.notes ? { notes: values.notes } : {}),
      ...(formMode === "create" && recurrence ? { recurrence } : {}),
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
  }

  const handleCreateAccount = useCallback(
    async (name: string) => {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const body = (await response.json().catch(() => ({}))) as {
        account?: { id: string; name: string }
        error?: unknown
      }

      if (!response.ok || !body.account) {
        const message = typeof body.error === "string" ? body.error : t("Unable to create account")
        toast.error(t("Unable to create account"), { description: message })
        throw new Error(message)
      }

      const account = { id: body.account.id, name: body.account.name }
      toast.success(t("Account created"), { description: account.name })
      await loadAccounts()
      return account
    },
    [loadAccounts, t],
  )

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const amount = Number(values.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(t("Amount must be greater than zero"))
    }

    const payload = {
      date: values.date,
      description: values.description,
      amount,
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
  }

  const selectedTransactionValues = useMemo(() => {
    if (!selectedTransaction || selectedTransaction.type === "transfer") return undefined
    return {
      date: selectedTransaction.date,
      description: selectedTransaction.description,
      categoryId: selectedTransaction.categoryId,
      categoryName: selectedTransaction.categoryName,
      amount: Math.abs(selectedTransaction.amount).toString(),
      account: selectedTransaction.account,
      type: selectedTransaction.type,
      status: selectedTransaction.status,
      notes: selectedTransaction.notes ?? "",
      recurrenceType: "one-time",
      recurrenceInterval: "1",
    }
  }, [selectedTransaction])

  const renderTableBody = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
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
          <TableCell colSpan={7} className="h-24 text-center text-sm text-red-500">
            {error}
          </TableCell>
        </TableRow>
      )
    }

    if (transactions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
            {t("No transactions found. Try adjusting your filters.")}
          </TableCell>
        </TableRow>
      )
    }

    return transactions.map((transaction) => {
      const isTransfer = transaction.type === "transfer"
      const isInboundTransfer = isTransfer && (transaction.transferDirection === "in" || transaction.amount > 0)
      const amountValue = Math.abs(transaction.amount)
      const formattedAmount = currencyFormatter.format(amountValue)
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
      const formattedDate =
        formatDateWithPattern(transaction.date, dateFormat, language) || transaction.date

      return (
        <TableRow key={transaction.id}>
          <TableCell className="font-medium">{formattedDate}</TableCell>
          <TableCell>
            <div className="max-w-[300px] space-y-1">
              <p className="truncate font-medium">{transaction.description}</p>
              {isTransfer ? (
                <Badge variant="outline" className="w-max text-xs">
                  {isInboundTransfer ? t("Transfer in") : t("Transfer out")}
                </Badge>
              ) : null}
              {transaction.notes ? (
                <p className="truncate text-xs text-muted-foreground">{transaction.notes}</p>
              ) : null}
            </div>
          </TableCell>
          <TableCell>
            {isTransfer ? (
              <Badge variant="outline">{t("Transfer")}</Badge>
            ) : (
              <Badge variant="secondary">{transaction.categoryName || t("Uncategorized")}</Badge>
            )}
          </TableCell>
          <TableCell className="text-muted-foreground">{transaction.account}</TableCell>
          <TableCell>
            <span className={`font-medium ${amountClass}`}>
              {amountPrefix}
              {formattedAmount}
            </span>
          </TableCell>
          <TableCell>
            <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
              {statusLabels[transaction.status] ?? transaction.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(transaction)}
                disabled={isTransfer}
                title={isTransfer ? t("Transfers cannot be edited") : undefined}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(transaction)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <AppLayout
      title={t("Transactions")}
      description={t("Manage and track your financial transactions")}
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsManageAccountsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            {t("Manage Accounts")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTransferOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {t("Transfer")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t("Import CSV")}
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("Add Transaction")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{t("Accounts overview")}</CardTitle>
              <CardDescription>{t("Monitor balances across your accounts")}</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("Total balance")}</p>
                <p className={`text-lg font-semibold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {currencyFormatter.format(totalBalance)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsManageAccountsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                {t("Manage")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accountSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("No accounts yet. Create one when logging a transaction or transfer.")}
              </p>
            ) : (
              <div className="space-y-3">
                {accountSummaries.map((account) => (
                  <div key={account.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("Transactions: {{count}}", { values: { count: account.transactions.toString() } })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-green-600">
                          {t("In: {{value}}", { values: { value: currencyFormatter.format(account.inflow) } })}
                        </span>
                        <span className="text-red-600">
                          {t("Out: {{value}}", { values: { value: currencyFormatter.format(account.outflow) } })}
                        </span>
                        <span
                          className={
                            account.balance >= 0
                              ? "font-semibold text-green-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {t("Balance: {{value}}", { values: { value: currencyFormatter.format(account.balance) } })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("All Transactions")}</CardTitle>
            <CardDescription>
              {t(
                "Showing {{visible}} of {{total}} transactions · Income: {{income}} · Expenses: {{expenses}}",
                {
                  values: {
                    visible: transactions.length.toString(),
                    total: totalCount.toString(),
                    income: currencyFormatter.format(totals.income),
                    expenses: `-${currencyFormatter.format(totals.expenses)}`,
                  },
                },
              )}
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
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("amount")} className="h-auto p-0 font-semibold">
                        {t("Amount")}
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
        onCreateAccount={handleCreateAccount}
      />
      <TransferDialog
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        accounts={accounts}
        onSubmit={handleTransferSubmit}
        onCreateAccount={handleCreateAccount}
      />
      <AccountManagerDialog
        open={isManageAccountsOpen}
        onOpenChange={setIsManageAccountsOpen}
        accounts={accountSummaries}
        onCreate={async (name) => {
          await handleCreateAccount(name)
        }}
        onRename={handleRenameAccount}
        onDelete={handleDeleteAccount}
      />
    </AppLayout>
  )
}
