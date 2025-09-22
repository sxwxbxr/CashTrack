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
import { useTranslations } from "@/components/language-provider"

interface CategoryOption {
  id: string
  name: string
}

export interface TransactionFormValues {
  date: string
  description: string
  categoryId: string | null
  categoryName: string
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
  categories: CategoryOption[]
}

const accountOptions = ["Checking", "Savings", "Credit Card", "Cash", "Brokerage"]

const statusOptions: TransactionStatus[] = ["completed", "pending", "cleared"]

const createDefaultValues = (): TransactionFormValues => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  categoryId: null,
  categoryName: "Uncategorized",
  amount: "",
  account: "",
  type: "expense",
  status: "completed",
  notes: "",
})

export function TransactionFormDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  initialValues,
  categories,
}: TransactionFormDialogProps) {
  const { t } = useTranslations()
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
      if (!formData.categoryName || !formData.account) {
        throw new Error(t("Please select a category and account"))
      }
      if (!formData.amount) {
        throw new Error(t("Amount is required"))
      }

      const payload: TransactionFormValues = {
        ...formData,
        categoryName: formData.categoryName || "Uncategorized",
        categoryId: formData.categoryId ?? null,
      }

      await onSubmit(payload)
      setFormData(createDefaultValues())
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Failed to save transaction"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Add Transaction") : t("Edit Transaction")}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("Add a new transaction to your account")
              : t("Update the details of your transaction")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-date">{t("Date")}</Label>
              <Input
                id="transaction-date"
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-type">{t("Type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: TransactionType) => setFormData((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t("Expense")}</SelectItem>
                  <SelectItem value="income">{t("Income")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-description">{t("Description")}</Label>
            <Input
              id="transaction-description"
              placeholder={t("Enter transaction description")}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-category">{t("Category")}</Label>
              <Select
                value={formData.categoryId ?? formData.categoryName ?? "uncategorized"}
                onValueChange={(value) => {
                  if (value === "uncategorized") {
                    setFormData((prev) => ({ ...prev, categoryId: null, categoryName: "Uncategorized" }))
                  } else {
                    const option = categories.find((category) => category.id === value)
                    setFormData((prev) => ({
                      ...prev,
                      categoryId: option?.id ?? null,
                      categoryName: option?.name ?? "Uncategorized",
                    }))
                  }
                }}
              >
                <SelectTrigger id="transaction-category">
                  <SelectValue placeholder={t("Select category") ?? undefined} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">{t("Uncategorized")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-amount">{t("Amount")}</Label>
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
              <Label htmlFor="transaction-account">{t("Account")}</Label>
              <Select
                value={formData.account}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, account: value }))}
              >
                <SelectTrigger id="transaction-account">
                  <SelectValue placeholder={t("Select account") ?? undefined} />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account} value={account}>
                      {t(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-status">{t("Status")}</Label>
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
                      {t(status.charAt(0).toUpperCase() + status.slice(1))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-notes">{t("Notes (optional)")}</Label>
            <Textarea
              id="transaction-notes"
              placeholder={t("Add any additional details")}
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Saving…") : mode === "create" ? t("Add Transaction") : t("Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
