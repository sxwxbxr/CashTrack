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

export interface CategoryFormValues {
  name: string
  icon: string
  color: string
  monthlyBudget: string
}

interface AddCategoryDialogProps {
  open: boolean
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CategoryFormValues) => Promise<void>
  initialValues?: CategoryFormValues
}

const colorOptions = [
  { name: "Blue", value: "bg-blue-500" },
  { name: "Green", value: "bg-green-500" },
  { name: "Purple", value: "bg-purple-500" },
  { name: "Yellow", value: "bg-yellow-500" },
  { name: "Red", value: "bg-red-500" },
  { name: "Pink", value: "bg-pink-500" },
  { name: "Indigo", value: "bg-indigo-500" },
  { name: "Orange", value: "bg-orange-500" },
]

const iconOptions = ["🍽️", "🚗", "🎬", "🛍️", "⚡", "🏥", "🎓", "🏠", "💼", "🎯", "📱", "✈️"]

const createDefaultValues = (): CategoryFormValues => ({
  name: "",
  icon: iconOptions[0],
  color: colorOptions[0].value,
  monthlyBudget: "",
})

export function AddCategoryDialog({ open, mode, onOpenChange, onSubmit, initialValues }: AddCategoryDialogProps) {
  const [formData, setFormData] = useState<CategoryFormValues>(createDefaultValues)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setIsSubmitting(false)
      if (initialValues) {
        setFormData(initialValues)
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
      if (!formData.name.trim()) {
        throw new Error("Category name is required")
      }
      if (!formData.monthlyBudget) {
        throw new Error("Monthly budget is required")
      }

      await onSubmit(formData)
      if (mode === "create") {
        setFormData(createDefaultValues())
      }
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save category")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Category" : "Edit Category"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new spending category with budget"
              : "Update your category details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              placeholder="e.g., Food & Dining"
              value={formData.name}
              onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-icon">Icon</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, icon: value }))}
              >
                <SelectTrigger id="category-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <span className="text-lg">{icon}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-color">Color</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, color: value }))}
              >
                <SelectTrigger id="category-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded ${color.value}`} />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-budget">Monthly Budget</Label>
            <Input
              id="category-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.monthlyBudget}
              onChange={(event) => setFormData((previous) => ({ ...previous, monthlyBudget: event.target.value }))}
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Add Category" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
