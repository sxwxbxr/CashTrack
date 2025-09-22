"use client"

import { useEffect, useMemo, useState } from "react"

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
import { useTranslations } from "@/components/language-provider"

interface ManagedAccount {
  id: string
  name: string
  balance: number
  inflow: number
  outflow: number
  transactions: number
}

interface AccountManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: ManagedAccount[]
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function AccountManagerDialog({
  open,
  onOpenChange,
  accounts,
  onCreate,
  onRename,
  onDelete,
}: AccountManagerDialogProps) {
  const { t } = useTranslations()
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})
  const [renameLoading, setRenameLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountError, setNewAccountError] = useState<string | null>(null)
  const [creatingAccount, setCreatingAccount] = useState(false)

  useEffect(() => {
    if (!open) {
      setNewAccountName("")
      setNewAccountError(null)
      setRenameLoading(null)
      setDeleteLoading(null)
      setRowErrors({})
    }
  }, [open])

  useEffect(() => {
    const next: Record<string, string> = {}
    accounts.forEach((account) => {
      next[account.id] = account.name
    })
    setNameEdits(next)
  }, [accounts])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [],
  )

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
      await onCreate(trimmed)
      setNewAccountName("")
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
              <div className="flex gap-2">
                <Input
                  id="new-managed-account"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder={t("e.g. Travel fund") ?? undefined}
                />
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
              const netClass = account.balance >= 0 ? "text-green-600" : "text-red-600"

              return (
                <div
                  key={account.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`account-name-${account.id}`}>{t("Account name")}</Label>
                      <Input
                        id={`account-name-${account.id}`}
                        value={nameEdits[account.id] ?? ""}
                        onChange={(event) =>
                          setNameEdits((previous) => ({ ...previous, [account.id]: event.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          {t("Transactions: {{count}}", { values: { count: account.transactions.toString() } })}
                        </span>
                        <span className="text-green-600">
                          {t("Inflow: {{value}}", { values: { value: currencyFormatter.format(account.inflow) } })}
                        </span>
                        <span className="text-red-600">
                          {t("Outflow: {{value}}", { values: { value: currencyFormatter.format(account.outflow) } })}
                        </span>
                        <span className={netClass}>
                          {t("Balance: {{value}}", { values: { value: currencyFormatter.format(account.balance) } })}
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
