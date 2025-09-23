"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/components/language-provider"

interface ManagedAccount {
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

interface AccountManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: ManagedAccount[]
  baseCurrency: string
  availableCurrencies: string[]
  onCreate: (input: { name: string; currency: string }) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onChangeCurrency: (id: string, currency: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function AccountManagerDialog({
  open,
  onOpenChange,
  accounts,
  baseCurrency,
  availableCurrencies,
  onCreate,
  onRename,
  onChangeCurrency,
  onDelete,
}: AccountManagerDialogProps) {
  const { t } = useTranslations()
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})
  const [renameLoading, setRenameLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [currencyEdits, setCurrencyEdits] = useState<Record<string, string>>({})
  const [currencyLoading, setCurrencyLoading] = useState<string | null>(null)
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountCurrency, setNewAccountCurrency] = useState(baseCurrency)
  const [newAccountError, setNewAccountError] = useState<string | null>(null)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const currencyFormatters = useRef<Map<string, Intl.NumberFormat>>(new Map())

  useEffect(() => {
    currencyFormatters.current.clear()
  }, [baseCurrency])

  const baseFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: baseCurrency,
        minimumFractionDigits: 2,
      }),
    [baseCurrency],
  )

  const formatAmount = useCallback(
    (value: number, currency: string) => {
      const normalized = (currency || baseCurrency).toUpperCase()
      if (!currencyFormatters.current.has(normalized)) {
        try {
          currencyFormatters.current.set(
            normalized,
            new Intl.NumberFormat(undefined, { style: "currency", currency: normalized }),
          )
        } catch {
          currencyFormatters.current.set(
            normalized,
            new Intl.NumberFormat(undefined, { style: "currency", currency: baseCurrency }),
          )
        }
      }
      return currencyFormatters.current.get(normalized)!.format(value)
    },
    [baseCurrency],
  )

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
    set.add(baseCurrency.toUpperCase())
    return Array.from(set).sort()
  }, [availableCurrencies, accounts, baseCurrency])

  useEffect(() => {
    if (!open) {
      setNewAccountName("")
      setNewAccountError(null)
      setRenameLoading(null)
      setDeleteLoading(null)
      setRowErrors({})
      setCurrencyLoading(null)
      setCurrencyEdits({})
      setNewAccountCurrency(baseCurrency)
    }
  }, [open, baseCurrency])

  useEffect(() => {
    if (open) {
      setNewAccountCurrency(baseCurrency)
    }
  }, [baseCurrency, open])

  useEffect(() => {
    const nextNames: Record<string, string> = {}
    const nextCurrencies: Record<string, string> = {}
    accounts.forEach((account) => {
      nextNames[account.id] = account.name
      nextCurrencies[account.id] = account.currency
    })
    setNameEdits(nextNames)
    setCurrencyEdits(nextCurrencies)
  }, [accounts])

  const handleRename = async (id: string) => {
    const nextName = nameEdits[id]?.trim() ?? ""
    if (!nextName) {
      setRowErrors((previous) => ({ ...previous, [id]: t("Account name is required") }))
      return
    }

    setRowErrors((previous) => ({ ...previous, [id]: null }))
    setRenameLoading(id)
    try {
      await onRename(id, nextName)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to update account")
      setRowErrors((previous) => ({ ...previous, [id]: message }))
    } finally {
      setRenameLoading(null)
    }
  }

  const handleCurrencyChange = async (id: string, currency: string) => {
    setCurrencyEdits((previous) => ({ ...previous, [id]: currency }))
    const account = accounts.find((entry) => entry.id === id)
    if (!account || account.currency === currency) {
      return
    }

    setRowErrors((previous) => ({ ...previous, [id]: null }))
    setCurrencyLoading(id)
    try {
      await onChangeCurrency(id, currency)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to update account")
      setRowErrors((previous) => ({ ...previous, [id]: message }))
      setCurrencyEdits((previous) => ({ ...previous, [id]: account.currency }))
    } finally {
      setCurrencyLoading(null)
    }
  }

  const handleDelete = async (account: ManagedAccount) => {
    const confirmed = window.confirm(
      t("Delete {{name}}? This cannot be undone.", { values: { name: account.name } }),
    )
    if (!confirmed) {
      return
    }

    setDeleteLoading(account.id)
    try {
      await onDelete(account.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to delete account")
      setRowErrors((previous) => ({ ...previous, [account.id]: message }))
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newAccountName.trim()
    if (!trimmed) {
      setNewAccountError(t("Account name is required"))
      return
    }

    setNewAccountError(null)
    setCreatingAccount(true)
    try {
      await onCreate({ name: trimmed, currency: newAccountCurrency })
      setNewAccountName("")
      setNewAccountCurrency(baseCurrency)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to create account")
      setNewAccountError(message)
    } finally {
      setCreatingAccount(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("Manage accounts")}</DialogTitle>
          <DialogDescription>
            {t("Rename, add, or remove accounts used when logging transactions and transfers.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-managed-account">{t("Add new account")}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="new-managed-account"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder={t("e.g. Travel fund") ?? undefined}
                  className="flex-1 min-w-[200px]"
                />
                <Select
                  value={newAccountCurrency}
                  onValueChange={setNewAccountCurrency}
                  disabled={creatingAccount}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t("Currency") ?? undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={creatingAccount}>
                  {creatingAccount ? t("Saving…") : t("Add")}
                </Button>
              </div>
            </div>
            {newAccountError && <p className="text-sm text-red-500">{newAccountError}</p>}
          </form>

          <Separator />

          <div className="space-y-4">
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("No accounts yet. Create one to get started.")}</p>
            )}
            {accounts.map((account) => {
              const errorMessage = rowErrors[account.id]
              const isRenaming = renameLoading === account.id
              const isDeleting = deleteLoading === account.id
              const isCurrencyUpdating = currencyLoading === account.id
              const netClass = account.balance >= 0 ? "text-green-600" : "text-red-600"
              const selectedCurrency = currencyEdits[account.id] ?? account.currency

              return (
                <div
                  key={account.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`account-name-${account.id}`}>{t("Account name")}</Label>
                          <Input
                            id={`account-name-${account.id}`}
                            value={nameEdits[account.id] ?? ""}
                            onChange={(event) =>
                              setNameEdits((previous) => ({ ...previous, [account.id]: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`account-currency-${account.id}`}>{t("Currency")}</Label>
                          <Select
                            value={selectedCurrency}
                            onValueChange={(value) => handleCurrencyChange(account.id, value)}
                            disabled={isRenaming || isDeleting || isCurrencyUpdating}
                          >
                            <SelectTrigger id={`account-currency-${account.id}`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currencyOptions.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          {t("Transactions: {{count}}", { values: { count: account.transactions.toString() } })}
                        </span>
                        <span className="text-green-600">
                          {t("Inflow: {{value}}", { values: { value: formatAmount(account.inflow, account.currency) } })}
                        </span>
                        <span className="text-red-600">
                          {t("Outflow: {{value}}", { values: { value: formatAmount(account.outflow, account.currency) } })}
                        </span>
                        <span className={netClass}>
                          {t("Balance: {{value}}", { values: { value: formatAmount(account.balance, account.currency) } })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          {t("Base inflow: {{value}}", { values: { value: baseFormatter.format(account.inflowInBase) } })}
                        </span>
                        <span>
                          {t("Base outflow: {{value}}", { values: { value: baseFormatter.format(account.outflowInBase) } })}
                        </span>
                        <span>
                          {t("Base balance: {{value}}", { values: { value: baseFormatter.format(account.balanceInBase) } })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRename(account.id)}
                          disabled={isRenaming || isDeleting}
                        >
                          {isRenaming ? t("Saving…") : t("Rename")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(account)}
                          disabled={isRenaming || isDeleting}
                        >
                          {isDeleting ? t("Removing…") : t("Delete")}
                        </Button>
                      </div>
                      {account.transactions > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {t("{{count}} transactions", { values: { count: account.transactions.toString() } })}
                        </Badge>
                      )}
                      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
