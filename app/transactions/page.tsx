"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Search, Filter, Plus, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { TransactionImportDialog } from "@/components/transaction-import-dialog"
import { AddTransactionDialog } from "@/components/add-transaction-dialog"

// Mock data
const mockTransactions = [
  {
    id: "1",
    date: "2024-01-15",
    description: "Grocery Store - Weekly Shopping",
    category: "Food & Dining",
    amount: -85.5,
    account: "Checking",
    status: "completed",
  },
  {
    id: "2",
    date: "2024-01-14",
    description: "Salary Deposit",
    category: "Income",
    amount: 2100.0,
    account: "Checking",
    status: "completed",
  },
  {
    id: "3",
    date: "2024-01-13",
    description: "Gas Station - Shell",
    category: "Transportation",
    amount: -45.2,
    account: "Credit Card",
    status: "completed",
  },
  {
    id: "4",
    date: "2024-01-12",
    description: "Coffee Shop - Morning Coffee",
    category: "Food & Dining",
    amount: -12.5,
    account: "Checking",
    status: "completed",
  },
  {
    id: "5",
    date: "2024-01-11",
    description: "Netflix Subscription",
    category: "Entertainment",
    amount: -15.99,
    account: "Credit Card",
    status: "completed",
  },
  {
    id: "6",
    date: "2024-01-10",
    description: "Amazon Purchase",
    category: "Shopping",
    amount: -89.99,
    account: "Credit Card",
    status: "pending",
  },
  {
    id: "7",
    date: "2024-01-09",
    description: "Freelance Payment",
    category: "Income",
    amount: 450.0,
    account: "Checking",
    status: "completed",
  },
  {
    id: "8",
    date: "2024-01-08",
    description: "Electric Bill",
    category: "Bills & Utilities",
    amount: -125.3,
    account: "Checking",
    status: "completed",
  },
]

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
]

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [sortField, setSortField] = useState<"date" | "amount" | "description">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredTransactions = mockTransactions
    .filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "All Categories" || transaction.category === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === "date") {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const handleSort = (field: "date" | "amount" | "description") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      "Food & Dining": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      Transportation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      Entertainment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      Shopping: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      "Bills & Utilities": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      Income: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
      Healthcare: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
      Education: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    }
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }

  return (
    <AppLayout
      title="Transactions"
      description="Manage and track your financial transactions"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-[200px]">
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

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              Showing {filteredTransactions.length} of {mockTransactions.length} transactions
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
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{new Date(transaction.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="truncate font-medium">{transaction.description}</p>
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
                          {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                          {transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <TransactionImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
      <AddTransactionDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </AppLayout>
  )
}
