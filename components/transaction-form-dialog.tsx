"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { TransactionStatus, TransactionType } from "@/lib/transactions/types"
import { useTranslations } from "@/components/language-provider"

interface CategoryOption {
  id: string
  name: string
}

interface AccountOption {
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
  accounts: AccountOption[]
  onCreateAccount: (name: string) => Promise<AccountOption>
}

const statusOptions: TransactionStatus[] = ["completed", "pending", "cleared"]

const NEW_ACCOUNT_VALUE = "__create_account__"

const createDefaultValues = (defaultAccount = ""): TransactionFormValues => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  categoryId: null,
  categoryName: "Uncategorized",
  amount: "",
  account: defaultAccount,
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
  accounts,
  onCreateAccount,
}: TransactionFormDialogProps) {
  const { t } = useTranslations()
  const [formData, setFormData] = useState<TransactionFormValues>(createDefaultValues)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [accountError, setAccountError] = useState<string | null>(null)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const accountsRef = useRef<AccountOption[]>(accounts)

  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    if (initialValues) {
      setFormData({ ...initialValues })
      return
    }

    const defaultAccount = accountsRef.current[0]?.name ?? ""
    setFormData(createDefaultValues(defaultAccount))
  }, [open, initialValues])

  const accountOptions = useMemo(() => {
    const byName = new Map<string, AccountOption>()
    accounts.forEach((account) => {
      byName.set(account.name.toLowerCase(), account)
    })

    if (formData.account) {
      const key = formData.account.toLowerCase()
      if (!byName.has(key)) {
        byName.set(key, { id: `local:${key}`, name: formData.account })
      }
    }

    return Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
  }, [accounts, formData.account])

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
      const defaultAccount = accountsRef.current[0]?.name ?? ""
      setFormData(createDefaultValues(defaultAccount))
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Failed to save transaction"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAccountSelect = (value: string) => {
    if (value === NEW_ACCOUNT_VALUE) {
      setAccountError(null)
      setNewAccountName("")
      setIsAccountDialogOpen(true)
      return
    }
    setFormData((prev) => ({ ...prev, account: value }))
  }

  const handleAccountDialogChange = (nextOpen: boolean) => {
    setIsAccountDialogOpen(nextOpen)
    if (!nextOpen) {
      setAccountError(null)
      setNewAccountName("")
    }
  }

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newAccountName.trim()
    if (!trimmed) {
      setAccountError(t("Account name is required"))
      return
    }

    setAccountError(null)
    setIsCreatingAccount(true)
    try {
      const account = await onCreateAccount(trimmed)
      setFormData((prev) => ({ ...prev, account: account.name }))
      handleAccountDialogChange(false)
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : t("Unable to create account")
      setAccountError(message)
    } finally {
      setIsCreatingAccount(false)
    }
  }

  return (
    <>
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
                <Select value={formData.account} onValueChange={handleAccountSelect}>
                  <SelectTrigger id="transaction-account">
                    <SelectValue placeholder={t("Select account") ?? undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.name}>
                        {account.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_ACCOUNT_VALUE} className="font-medium text-primary">
                      {t("Create new account")}
                    </SelectItem>
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

      <Dialog open={isAccountDialogOpen} onOpenChange={handleAccountDialogChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("Create account")}</DialogTitle>
            <DialogDescription>
              {t("Add a new account to keep transactions organized by where money is stored or spent.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-account-name">{t("Account name")}</Label>
              <Input
                id="new-account-name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder={t("e.g. Checking, Savings, Credit Card") ?? undefined}
                autoFocus
              />
            </div>
            {accountError && <p className="text-sm text-red-500">{accountError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAccountDialogChange(false)}
                disabled={isCreatingAccount}
              >
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={isCreatingAccount}>
                {isCreatingAccount ? t("Saving…") : t("Create account")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
