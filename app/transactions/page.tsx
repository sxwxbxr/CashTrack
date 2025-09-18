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

interface Transaction {
  id: string
  date: string
  description: string
  category: string
  amount: number
  account: string
  status: TransactionStatus
  type: TransactionType
  notes?: string
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

const categories = [
  "All Categories",
  "Food & Dining",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Bills & Utilities",
  "Income",
  "Healthcare",
  "Education",
  "Savings",
  "Investments",
]

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
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
      if (selectedCategory !== "All Categories") {
        params.set("category", selectedCategory)
      }

      const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Failed to load transactions"
        throw new Error(message)
      }

      const data = (await response.json()) as TransactionsResponse
      setTransactions(data.transactions)
      setTotalCount(data.total)
      setTotals(data.totals)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load transactions"
      setError(message)
      toast.error("Unable to load transactions", { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, selectedCategory, sortField, sortDirection])

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
      throw new Error("Amount must be a number")
    }

    const payload = {
      date: values.date,
      description: values.description,
      category: values.category,
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
        const message = typeof body.error === "string" ? body.error : "Unable to create transaction"
        throw new Error(message)
      }

      toast.success("Transaction added")
    } else if (selectedTransaction) {
      const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to update transaction"
        throw new Error(message)
      }

      toast.success("Transaction updated")
    }

    await fetchTransactions()
  }

  const handleDelete = async (transaction: Transaction) => {
    const confirmed = window.confirm("Delete this transaction?")
    if (!confirmed) return

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to delete transaction"
        throw new Error(message)
      }

      toast.success("Transaction deleted")
      await fetchTransactions()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete transaction"
      toast.error("Delete failed", { description: message })
    }
  }

  const handleImportComplete = (count: number) => {
    if (count > 0) {
      toast.success(`${count} transactions imported`)
    } else {
      toast.info("No new transactions imported")
    }
    fetchTransactions()
  }

  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      "Food & Dining": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      Transportation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      Entertainment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      Shopping: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      "Bills & Utilities": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      Income: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
      Healthcare: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
      Education: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
      Savings: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
      Investments: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    }
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }, [])

  const selectedTransactionValues = useMemo(() => {
    if (!selectedTransaction) return undefined
    return {
      date: selectedTransaction.date,
      description: selectedTransaction.description,
      category: selectedTransaction.category,
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
              Loading transactions...
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
            No transactions found. Try adjusting your filters.
          </TableCell>
        </TableRow>
      )
    }

    return transactions.map((transaction) => (
      <TableRow key={transaction.id}>
        <TableCell className="font-medium">{new Date(transaction.date).toLocaleDateString()}</TableCell>
        <TableCell>
          <div className="max-w-[300px]">
            <p className="truncate font-medium">{transaction.description}</p>
            {transaction.notes && <p className="truncate text-xs text-muted-foreground">{transaction.notes}</p>}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={getCategoryColor(transaction.category)}>
            {transaction.category}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">{transaction.account}</TableCell>
        <TableCell>
          <span className={`font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
            {transaction.amount > 0 ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
            {transaction.status}
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
      title="Transactions"
      description="Manage and track your financial transactions"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filter Transactions</CardTitle>
            <CardDescription>Search and filter your transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              {`Showing ${transactions.length} of ${totalCount} transactions · Income: $${totals.income.toFixed(2)} · Expenses: -$${totals.expenses.toFixed(2)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("date")} className="h-auto p-0 font-semibold">
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("description")}
                        className="h-auto p-0 font-semibold"
                      >
                        Description
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("amount")} className="h-auto p-0 font-semibold">
                        Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
      />
    </AppLayout>
  )
}
