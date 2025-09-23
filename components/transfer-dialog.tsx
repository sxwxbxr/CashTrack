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
import type { TransactionStatus } from "@/lib/transactions/types"
import { useTranslations } from "@/components/language-provider"

interface AccountOption {
  id: string
  name: string
  currency?: string
}

export interface TransferFormValues {
  date: string
  description: string
  amount: string
  fromAccount: string
  toAccount: string
  status: TransactionStatus
  notes: string
}

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountOption[]
  onSubmit: (values: TransferFormValues) => Promise<void>
  onCreateAccount: (input: { name: string; currency: string }) => Promise<AccountOption>
  baseCurrency: string
  availableCurrencies: string[]
}

const statusOptions: TransactionStatus[] = ["completed", "pending", "cleared"]
const NEW_ACCOUNT_VALUE = "__create_account__"

export function TransferDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
  onCreateAccount,
  baseCurrency,
  availableCurrencies,
}: TransferDialogProps) {
  const { t } = useTranslations()
  const normalizedBaseCurrency = baseCurrency.toUpperCase()
  const [formData, setFormData] = useState<TransferFormValues>({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    fromAccount: "",
    toAccount: "",
    status: "completed",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountCurrency, setNewAccountCurrency] = useState(normalizedBaseCurrency)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [accountDialogTarget, setAccountDialogTarget] = useState<"from" | "to" | null>(null)
  const accountsRef = useRef<AccountOption[]>(accounts)

  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    if (!open) {
      return
    }
    setError(null)
    const defaultAccount = accountsRef.current[0]?.name ?? ""
    setFormData((previous) => ({
      ...previous,
      date: new Date().toISOString().split("T")[0],
      fromAccount: previous.fromAccount || defaultAccount,
      toAccount: previous.toAccount && previous.toAccount !== previous.fromAccount ? previous.toAccount : "",
      amount: "",
    }))
  }, [open])

  useEffect(() => {
    if (!isAccountDialogOpen) {
      setAccountError(null)
      setNewAccountName("")
      setNewAccountCurrency(normalizedBaseCurrency)
    }
  }, [isAccountDialogOpen, normalizedBaseCurrency])

  const accountOptions = useMemo(() => {
    const unique = new Map<string, AccountOption>()
    accounts.forEach((account) => {
      const normalizedCurrency = account.currency?.toUpperCase()
      unique.set(account.name.toLowerCase(), {
        ...account,
        currency: normalizedCurrency,
      })
    })
    if (formData.fromAccount) {
      const key = formData.fromAccount.toLowerCase()
      if (!unique.has(key)) {
        unique.set(key, { id: `local:${key}`, name: formData.fromAccount })
      }
    }
    if (formData.toAccount) {
      const key = formData.toAccount.toLowerCase()
      if (!unique.has(key)) {
        unique.set(key, { id: `local:${key}`, name: formData.toAccount })
      }
    }
    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
  }, [accounts, formData.fromAccount, formData.toAccount])

  const currencyOptions = useMemo(() => {
    const set = new Set<string>()
    availableCurrencies.forEach((code) => {
      if (typeof code === "string" && code.trim()) {
        set.add(code.trim().toUpperCase())
      }
    })
    accounts.forEach((account) => {
      if (account.currency) {
        set.add(account.currency.toUpperCase())
      }
    })
    set.add(normalizedBaseCurrency)
    return Array.from(set).sort()
  }, [availableCurrencies, accounts, normalizedBaseCurrency])

  const resetAccountDialog = () => {
    setAccountError(null)
    setNewAccountName("")
    setNewAccountCurrency(normalizedBaseCurrency)
    setAccountDialogTarget(null)
  }

  const handleAccountSelect = (value: string, target: "from" | "to") => {
    if (value === NEW_ACCOUNT_VALUE) {
      setAccountDialogTarget(target)
      setIsAccountDialogOpen(true)
      setAccountError(null)
      setNewAccountName("")
      setNewAccountCurrency(normalizedBaseCurrency)
      return
    }
    setFormData((prev) => ({ ...prev, [target === "from" ? "fromAccount" : "toAccount"]: value }))
  }

  const handleAccountDialogChange = (nextOpen: boolean) => {
    setIsAccountDialogOpen(nextOpen)
    if (!nextOpen) {
      resetAccountDialog()
    }
  }

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newAccountName.trim()
    if (!trimmed) {
      setAccountError(t("Account name is required"))
      return
    }
    const currencyCode = newAccountCurrency.trim().toUpperCase() || normalizedBaseCurrency
    setAccountError(null)
    setIsCreatingAccount(true)
    try {
      const account = await onCreateAccount({ name: trimmed, currency: currencyCode })
      setFormData((prev) => ({
        ...prev,
        [accountDialogTarget === "to" ? "toAccount" : "fromAccount"]: account.name,
      }))
      handleAccountDialogChange(false)
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : t("Unable to create account")
      setAccountError(message)
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!formData.fromAccount || !formData.toAccount) {
      setError(t("Select both source and destination accounts"))
      return
    }
    if (formData.fromAccount.trim().toLowerCase() === formData.toAccount.trim().toLowerCase()) {
      setError(t("Choose two different accounts for a transfer"))
      return
    }
    if (!formData.amount) {
      setError(t("Amount is required"))
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      setFormData({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        fromAccount: formData.fromAccount,
        toAccount: "",
        status: formData.status,
        notes: "",
      })
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("Unable to create transfer")
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("New transfer")}</DialogTitle>
            <DialogDescription>
              {t("Move funds between your accounts. Amounts will be converted using current exchange rates if needed.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer-date">{t("Date")}</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-amount">{t("Amount")}</Label>
                <Input
                  id="transfer-amount"
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
                <Label htmlFor="transfer-from">{t("From account")}</Label>
                <Select
                  value={formData.fromAccount}
                  onValueChange={(value) => handleAccountSelect(value, "from")}
                >
                  <SelectTrigger id="transfer-from">
                    <SelectValue placeholder={t("Select account") ?? undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.name}>
                        {account.currency ? `${account.name} · ${account.currency.toUpperCase()}` : account.name}
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
                <Label htmlFor="transfer-to">{t("To account")}</Label>
                <Select value={formData.toAccount} onValueChange={(value) => handleAccountSelect(value, "to")}>
                  <SelectTrigger id="transfer-to">
                    <SelectValue placeholder={t("Select account") ?? undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.name}>
                        {account.currency ? `${account.name} · ${account.currency.toUpperCase()}` : account.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_ACCOUNT_VALUE} className="font-medium text-primary">
                      {t("Create new account")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer-status">{t("Status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TransactionStatus) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="transfer-status">
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
              <div className="space-y-2">
                <Label htmlFor="transfer-notes">{t("Notes (optional)")}</Label>
                <Textarea
                  id="transfer-notes"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("Saving…") : t("Create transfer")}
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
              <Label htmlFor="transfer-new-account-name">{t("Account name")}</Label>
              <Input
                id="transfer-new-account-name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder={t("e.g. Checking, Savings, Credit Card") ?? undefined}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-new-account-currency">{t("Account currency")}</Label>
              <Input
                id="transfer-new-account-currency"
                value={newAccountCurrency}
                onChange={(event) => setNewAccountCurrency(event.target.value.toUpperCase())}
                placeholder={normalizedBaseCurrency}
                list="transfer-account-currency-options"
              />
              <datalist id="transfer-account-currency-options">
                {currencyOptions.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
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
