"use client"

import type React from "react"

import { useState, useEffect } from "react"
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

interface EditBudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: any
}

export function EditBudgetDialog({ open, onOpenChange, category }: EditBudgetDialogProps) {
  const [budget, setBudget] = useState("")

  useEffect(() => {
    if (category) {
      setBudget(category.budget.toString())
    }
  }, [category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Updated budget:", { categoryId: category?.id, budget: Number.parseFloat(budget) })
    onOpenChange(false)
  }

  if (!category) return null

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
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Current spending: ${category.spent}</p>
            <p>
              {budget && Number.parseFloat(budget) > 0 && (
                <>New budget utilization: {((category.spent / Number.parseFloat(budget)) * 100).toFixed(1)}%</>
              )}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Budget</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
