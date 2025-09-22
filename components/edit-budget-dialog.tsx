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
import { useTranslations } from "@/components/language-provider"
import { useAppSettings } from "@/components/settings-provider"

interface CategorySummary {
  id: string
  name: string
  monthlyBudget: number
  spent: number
}

interface EditBudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: CategorySummary | null
  onSubmit: (budget: number) => Promise<void>
}

export function EditBudgetDialog({ open, onOpenChange, category, onSubmit }: EditBudgetDialogProps) {
  const { t } = useTranslations()
  const [budget, setBudget] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  useEffect(() => {
    if (open && category) {
      setBudget(category.monthlyBudget.toString())
      setError(null)
      setIsSubmitting(false)
    }
  }, [open, category])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const parsed = Number.parseFloat(budget)
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(t("Budget must be a positive number"))
      }
      await onSubmit(parsed)
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Failed to update budget"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!category) {
    return null
  }

  const utilization =
    category && budget && Number.parseFloat(budget) > 0
      ? (category.spent / Number.parseFloat(budget)) * 100
      : null
  const formattedSpent = category ? currencyFormatter.format(category.spent) : currencyFormatter.format(0)
  const formattedUtilization =
    utilization !== null && Number.isFinite(utilization) ? Math.min(utilization, 999).toFixed(1) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("Edit Budget")}</DialogTitle>
          <DialogDescription>
            {t("Update the monthly budget for {{category}}", { values: { category: category.name } })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget">{t("Monthly Budget")}</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              required
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>{t("Current spending: {{amount}}", { values: { amount: formattedSpent } })}</p>
            {formattedUtilization !== null && (
              <p>{t("New budget utilization: {{percent}}%", { values: { percent: formattedUtilization } })}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Saving…") : t("Update Budget")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
