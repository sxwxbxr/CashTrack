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
import { Switch } from "@/components/ui/switch"
import type { RecurrenceUnit, TransactionStatus, TransactionType } from "@/lib/transactions/types"
import { useTranslations } from "@/components/language-provider"

interface CategoryOption {
  id: string
  name: string
}

interface AccountOption {
  id: string
  name: string
  currency: string
}

export interface TransactionFormValues {
  date: string
  description: string
  categoryId: string | null
  categoryName: string
  amount: string
  accountAmount: string
  currency: string
  account: string
  type: TransactionType
  status: TransactionStatus
  notes: string
  isRecurring: boolean
  recurrenceInterval: number
  recurrenceUnit: RecurrenceUnit
  recurrenceStartDate: string
}

interface TransactionFormDialogProps {
  open: boolean
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TransactionFormValues) => Promise<void>
  initialValues?: TransactionFormValues
  categories: CategoryOption[]
  accounts: AccountOption[]
  baseCurrency: string
  availableCurrencies: string[]
  currencyRates: Record<string, number>
  accountCurrencyMap: Record<string, string>
  onCreateAccount: (input: { name: string; currency: string }) => Promise<AccountOption>
}

const statusOptions: TransactionStatus[] = ["completed", "pending", "cleared"]
const recurrenceUnits: RecurrenceUnit[] = ["day", "week", "month", "year"]

const NEW_ACCOUNT_VALUE = "__create_account__"

const createDefaultValues = (defaultAccount: string, defaultCurrency: string): TransactionFormValues => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  categoryId: null,
  categoryName: "Uncategorized",
  amount: "",
  accountAmount: "",
  currency: defaultCurrency,
  account: defaultAccount,
  type: "expense",
  status: "completed",
  notes: "",
  isRecurring: false,
  recurrenceInterval: 1,
  recurrenceUnit: "month",
  recurrenceStartDate: "",
})

export function TransactionFormDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  initialValues,
  categories,
  accounts,
  baseCurrency,
  availableCurrencies,
  currencyRates,
  accountCurrencyMap,
  onCreateAccount,
}: TransactionFormDialogProps) {
  const { t } = useTranslations()
  const normalizedBaseCurrency = baseCurrency.trim().toUpperCase() || "USD"

  const [formData, setFormData] = useState<TransactionFormValues>(() =>
    createDefaultValues("", normalizedBaseCurrency),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountCurrency, setNewAccountCurrency] = useState(normalizedBaseCurrency)
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
    const defaultAccount = initialValues?.account ?? accountsRef.current[0]?.name ?? ""
    const accountKey = defaultAccount.trim().toLowerCase()
    const fallbackCurrency =
      initialValues?.currency ||
      accountCurrencyMap[accountKey]?.toUpperCase() ||
      normalizedBaseCurrency

    const defaults = createDefaultValues(defaultAccount, fallbackCurrency)

    if (initialValues) {
      setFormData({
        ...defaults,
        ...initialValues,
        categoryId: initialValues.categoryId ?? null,
        categoryName: initialValues.categoryName ?? defaults.categoryName,
        amount: initialValues.amount ?? "",
        accountAmount: initialValues.accountAmount ?? "",
        currency: (initialValues.currency || defaults.currency).toUpperCase(),
        notes: initialValues.notes ?? "",
        recurrenceInterval: initialValues.recurrenceInterval ?? 1,
        recurrenceUnit: initialValues.recurrenceUnit ?? "month",
        recurrenceStartDate: initialValues.recurrenceStartDate ?? "",
        isRecurring: initialValues.isRecurring ?? false,
      })
      return
    }

    setFormData(defaults)
  }, [open, initialValues, accountCurrencyMap, normalizedBaseCurrency])

  useEffect(() => {
    if (!isAccountDialogOpen) {
      setAccountError(null)
      setNewAccountName("")
      setNewAccountCurrency(normalizedBaseCurrency)
    }
  }, [isAccountDialogOpen, normalizedBaseCurrency])

  useEffect(() => {
    if (formData.isRecurring && !formData.recurrenceStartDate) {
      setFormData((previous) => ({ ...previous, recurrenceStartDate: previous.date }))
    }
  }, [formData.isRecurring, formData.recurrenceStartDate, formData.date])

  const baseCurrencyOptions = useMemo(() => {
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

  const transactionCurrencyOptions = useMemo(() => {
    const set = new Set(baseCurrencyOptions)
    if (formData.currency) {
      set.add(formData.currency.toUpperCase())
    }
    return Array.from(set).sort()
  }, [baseCurrencyOptions, formData.currency])

  const accountOptions = useMemo(() => {
    const map = new Map<string, AccountOption>()
    accounts.forEach((account) => {
      const currency = account.currency ? account.currency.toUpperCase() : normalizedBaseCurrency
      map.set(account.name.toLowerCase(), { ...account, currency })
    })

    if (formData.account) {
      const key = formData.account.toLowerCase()
      if (!map.has(key)) {
        const currency =
          accountCurrencyMap[key]?.toUpperCase() ||
          formData.currency?.toUpperCase() ||
          normalizedBaseCurrency
        map.set(key, { id: `local:${key}`, name: formData.account, currency })
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
  }, [accounts, formData.account, formData.currency, accountCurrencyMap, normalizedBaseCurrency])

  const accountCurrency = useMemo(() => {
    if (!formData.account) {
      return normalizedBaseCurrency
    }
    const key = formData.account.trim().toLowerCase()
    const code = accountCurrencyMap[key]
    return code ? code.toUpperCase() : normalizedBaseCurrency
  }, [formData.account, accountCurrencyMap, normalizedBaseCurrency])

  const transactionCurrency = useMemo(() => {
    const value = formData.currency?.trim()
    if (value) {
      return value.toUpperCase()
    }
    return accountCurrency || normalizedBaseCurrency
  }, [formData.currency, accountCurrency, normalizedBaseCurrency])

  const normalizedRates = useMemo(() => {
    const entries: Record<string, number> = {}
    Object.entries(currencyRates).forEach(([code, value]) => {
      const numeric = Number(value)
      if (Number.isFinite(numeric) && numeric > 0) {
        entries[code.toUpperCase()] = numeric
      }
    })
    if (!entries[normalizedBaseCurrency]) {
      entries[normalizedBaseCurrency] = 1
    }
    return entries
  }, [currencyRates, normalizedBaseCurrency])

  const amountNumber = Number(formData.amount)
  const hasValidAmount = Number.isFinite(amountNumber) && formData.amount.trim().length > 0

  const baseAmount = useMemo(() => {
    if (!hasValidAmount) {
      return null
    }
    const rate = normalizedRates[transactionCurrency]
    if (!rate) {
      return null
    }
    return Math.abs(amountNumber) * rate
  }, [hasValidAmount, normalizedRates, transactionCurrency, amountNumber])

  const accountAmountSuggestion = useMemo(() => {
    if (!baseAmount) {
      return null
    }
    const rate = normalizedRates[accountCurrency]
    if (!rate) {
      return null
    }
    return baseAmount / rate
  }, [baseAmount, normalizedRates, accountCurrency])

  const roundToTwo = (value: number | null) =>
    value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100

  const roundedBaseAmount = roundToTwo(baseAmount)
  const roundedAccountAmount = roundToTwo(accountAmountSuggestion)

  const handleAccountSelect = (value: string) => {
    if (value === NEW_ACCOUNT_VALUE) {
      setAccountError(null)
      setNewAccountName("")
      setNewAccountCurrency(transactionCurrency)
      setIsAccountDialogOpen(true)
      return
    }

    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    const nextCurrency = accountCurrencyMap[key]?.toUpperCase() || normalizedBaseCurrency

    setFormData((prev) => ({
      ...prev,
      account: trimmed,
      currency: nextCurrency,
    }))
  }

  const handleAccountDialogChange = (nextOpen: boolean) => {
    setIsAccountDialogOpen(nextOpen)
    if (!nextOpen) {
      setAccountError(null)
      setNewAccountName("")
      setNewAccountCurrency(normalizedBaseCurrency)
    }
  }

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = newAccountName.trim()
    if (!trimmedName) {
      setAccountError(t("Account name is required"))
      return
    }

    const currencyCode = newAccountCurrency.trim().toUpperCase() || normalizedBaseCurrency

    setAccountError(null)
    setIsCreatingAccount(true)
    try {
      const account = await onCreateAccount({ name: trimmedName, currency: currencyCode })
      setFormData((prev) => ({
        ...prev,
        account: account.name,
        currency: account.currency ? account.currency.toUpperCase() : currencyCode,
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
    setIsSubmitting(true)
    try {
      if (!formData.categoryName || !formData.account) {
        throw new Error(t("Please select a category and account"))
      }
      if (!formData.amount) {
        throw new Error(t("Amount is required"))
      }

      const normalizedCurrency =
        formData.currency.trim().toUpperCase() || accountCurrency || normalizedBaseCurrency

      const payload: TransactionFormValues = {
        ...formData,
        categoryName: formData.categoryName || "Uncategorized",
        categoryId: formData.categoryId ?? null,
        amount: formData.amount.trim(),
        accountAmount: formData.accountAmount.trim(),
        currency: normalizedCurrency,
        notes: formData.notes,
        recurrenceInterval:
          formData.recurrenceInterval && formData.recurrenceInterval > 0
            ? formData.recurrenceInterval
            : 1,
        recurrenceStartDate: formData.isRecurring
          ? formData.recurrenceStartDate || formData.date
          : "",
      }

      await onSubmit(payload)
      const defaultAccount = accountsRef.current[0]?.name ?? ""
      const accountKey = defaultAccount.trim().toLowerCase()
      const defaultCurrency =
        accountCurrencyMap[accountKey]?.toUpperCase() || normalizedBaseCurrency
      setFormData(createDefaultValues(defaultAccount, defaultCurrency))
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("Failed to save transaction"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const recurrenceLabel = (unit: RecurrenceUnit) => {
    switch (unit) {
      case "day":
        return t("Days")
      case "week":
        return t("Weeks")
      case "month":
        return t("Months")
      case "year":
        return t("Years")
      default:
        return unit
    }
  }

  const formatCurrencyAmount = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(value)
    } catch {
      return `${value.toFixed(2)} ${currency}`
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
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
                  onValueChange={(value: TransactionType) =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
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
                placeholder={t("Enter transaction description") ?? undefined}
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
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
                      setFormData((prev) => ({
                        ...prev,
                        categoryId: null,
                        categoryName: "Uncategorized",
                      }))
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
                <Label htmlFor="transaction-status">{t("Status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TransactionStatus) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
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
                        {account.currency
                          ? `${account.name} · ${account.currency.toUpperCase()}`
                          : account.name}
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
                <Label htmlFor="transaction-currency">{t("Transaction currency")}</Label>
                <Input
                  id="transaction-currency"
                  value={formData.currency}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                  }
                  placeholder={transactionCurrency || normalizedBaseCurrency}
                  list="transaction-currency-options"
                />
                <datalist id="transaction-currency-options">
                  {transactionCurrencyOptions.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  {t("Use a 3-letter currency code (e.g., USD)")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transaction-amount">{t("Original amount")}</Label>
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
                <p className="text-xs text-muted-foreground">
                  {t("Amount in {{currency}}", { values: { currency: transactionCurrency } })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transaction-account-amount">{t("Account amount (optional)")}</Label>
                <Input
                  id="transaction-account-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.accountAmount}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, accountAmount: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("Leave blank to convert automatically to {{currency}}", {
                    values: { currency: accountCurrency },
                  })}
                </p>
                {roundedBaseAmount !== null && (
                  <p className="text-xs text-muted-foreground">
                    {t("Estimated base amount: {{value}}", {
                      values: {
                        value: formatCurrencyAmount(roundedBaseAmount, normalizedBaseCurrency),
                      },
                    })}
                  </p>
                )}
                {roundedAccountAmount !== null && (
                  <p className="text-xs text-muted-foreground">
                    {t("Estimated account amount: {{value}}", {
                      values: { value: formatCurrencyAmount(roundedAccountAmount, accountCurrency) },
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("Recurring payment")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Automatically repeat this transaction")}
                  </p>
                </div>
                <Switch
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isRecurring: checked }))
                  }
                  aria-label={t("Toggle recurring transaction")}
                />
              </div>
              {formData.isRecurring && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-interval">{t("Repeat every")}</Label>
                    <Input
                      id="recurrence-interval"
                      type="number"
                      min="1"
                      value={formData.recurrenceInterval.toString()}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10)
                        setFormData((prev) => ({
                          ...prev,
                          recurrenceInterval: Number.isFinite(next) && next > 0 ? next : 1,
                        }))
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-unit">{t("Frequency unit")}</Label>
                    <Select
                      value={formData.recurrenceUnit}
                      onValueChange={(value: RecurrenceUnit) =>
                        setFormData((prev) => ({ ...prev, recurrenceUnit: value }))
                      }
                    >
                      <SelectTrigger id="recurrence-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {recurrenceLabel(unit)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-start">{t("First occurrence")}</Label>
                    <Input
                      id="recurrence-start"
                      type="date"
                      value={formData.recurrenceStartDate || formData.date}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          recurrenceStartDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
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
              {t(
                "Add a new account to keep transactions organized by where money is stored or spent.",
              )}
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
            <div className="space-y-2">
              <Label htmlFor="new-account-currency">{t("Account currency")}</Label>
              <Input
                id="new-account-currency"
                value={newAccountCurrency}
                onChange={(event) =>
                  setNewAccountCurrency(event.target.value.toUpperCase())
                }
                placeholder={normalizedBaseCurrency}
                list="new-account-currency-options"
              />
              <datalist id="new-account-currency-options">
                {baseCurrencyOptions.map((code) => (
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
