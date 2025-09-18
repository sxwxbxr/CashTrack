"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { TransactionStatus, TransactionType } from "@/lib/transactions/types"

export interface TransactionFormValues {
  date: string
  description: string
  category: string
  amount: string
  account: string
  type: TransactionType
  status: TransactionStatus
  notes: string
}

interface TransactionFormDialogProps {
  open: boolean
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TransactionFormValues) => Promise<void>
  initialValues?: TransactionFormValues
}

const categoryOptions = [
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

const accountOptions = ["Checking", "Savings", "Credit Card", "Cash", "Brokerage"]

const statusOptions: TransactionStatus[] = ["completed", "pending", "cleared"]

const createDefaultValues = (): TransactionFormValues => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "",
  amount: "",
  account: "",
  type: "expense",
  status: "completed",
  notes: "",
})

export function TransactionFormDialog({ open, mode, onOpenChange, onSubmit, initialValues }: TransactionFormDialogProps) {
  const [formData, setFormData] = useState<TransactionFormValues>(createDefaultValues)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      if (initialValues) {
        setFormData({ ...initialValues })
      } else {
        setFormData(createDefaultValues())
      }
    }
  }, [open, initialValues])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (!formData.category || !formData.account) {
        throw new Error("Please select a category and account")
      }
      if (!formData.amount) {
        throw new Error("Amount is required")
      }
      await onSubmit(formData)
      setFormData(createDefaultValues())
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save transaction")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Transaction" : "Edit Transaction"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new transaction to your account"
              : "Update the details of your transaction"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-date">Date</Label>
              <Input
                id="transaction-date"
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: TransactionType) => setFormData((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-description">Description</Label>
            <Input
              id="transaction-description"
              placeholder="Enter transaction description"
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="transaction-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-amount">Amount</Label>
              <Input
                id="transaction-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-account">Account</Label>
              <Select
                value={formData.account}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, account: value }))}
              >
                <SelectTrigger id="transaction-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: TransactionStatus) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="transaction-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-notes">Notes (optional)</Label>
            <Textarea
              id="transaction-notes"
              placeholder="Add any additional details"
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Add Transaction" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
