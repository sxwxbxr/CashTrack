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
  const [budget, setBudget] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        throw new Error("Budget must be a positive number")
      }
      await onSubmit(parsed)
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update budget")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!category) {
    return null
  }

  const utilization = budget && Number.parseFloat(budget) > 0 ? (category.spent / Number.parseFloat(budget)) * 100 : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
          <DialogDescription>Update the monthly budget for {category.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget">Monthly Budget</Label>
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
            <p>Current spending: ${category.spent.toFixed(2)}</p>
            {utilization !== null && Number.isFinite(utilization) && (
              <p>New budget utilization: {Math.min(utilization, 999).toFixed(1)}%</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
