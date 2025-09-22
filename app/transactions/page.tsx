"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Search, Filter, Plus, Edit, Trash2, ArrowUpDown, Loader2 } from "lucide-react"
import { TransactionImportDialog } from "@/components/transaction-import-dialog"
import { TransactionFormDialog, type TransactionFormValues } from "@/components/transaction-form-dialog"
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
  const statusLabels = useMemo(
    () => ({
      pending: t("Pending"),
      cleared: t("Cleared"),
      completed: t("Completed"),
    }),
    [t],
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
  }, [loadCategories])

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
    setFormMode("edit")
    setSelectedTransaction(transaction)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (values: TransactionFormValues) => {
    const amount = Number(values.amount)
    if (Number.isNaN(amount)) {
      throw new Error(t("Amount must be a number"))
    }

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
  }

  const handleDelete = async (transaction: Transaction) => {
    const confirmed = window.confirm(t("Delete this transaction?"))
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
  }

  const selectedTransactionValues = useMemo(() => {
    if (!selectedTransaction) return undefined
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

    return transactions.map((transaction) => (
      <TableRow key={transaction.id}>
        <TableCell className="font-medium">
          {formatDateWithPattern(transaction.date, dateFormat, language)}
        </TableCell>
        <TableCell>
          <div className="max-w-[300px]">
            <p className="truncate font-medium">{transaction.description}</p>
            {transaction.notes && <p className="truncate text-xs text-muted-foreground">{transaction.notes}</p>}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{transaction.categoryName || t("Uncategorized")}</Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">{transaction.account}</TableCell>
        <TableCell>
          <span className={`font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
            {transaction.amount > 0 ? "+" : "-"}
            {currencyFormatter.format(Math.abs(transaction.amount))}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
            {statusLabels[transaction.status] ?? transaction.status}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEditDialog(transaction)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(transaction)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <AppLayout
      title={t("Transactions")}
      description={t("Manage and track your financial transactions")}
      action={
        <div className="flex gap-2">
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
      />
    </AppLayout>
  )
}
