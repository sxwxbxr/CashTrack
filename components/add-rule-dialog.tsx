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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/components/language-provider"

export interface RuleFormValues {
  name: string
  categoryId: string
  type: "contains" | "starts_with" | "ends_with" | "exact" | "regex"
  pattern: string
  priority: string
  isActive: boolean
  description: string
}

interface CategoryOption {
  id: string
  name: string
}

interface AddRuleDialogProps {
  open: boolean
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSubmit: (values: RuleFormValues) => Promise<void>
  categories: CategoryOption[]
  initialValues?: RuleFormValues
}

const createDefaultValues = (categories: CategoryOption[]): RuleFormValues => ({
  name: "",
  categoryId: categories[0]?.id ?? "",
  type: "contains",
  pattern: "",
  priority: "1",
  isActive: true,
  description: "",
})

export function AddRuleDialog({ open, mode, onOpenChange, onSubmit, categories, initialValues }: AddRuleDialogProps) {
  const { t } = useTranslations()
  const [formData, setFormData] = useState<RuleFormValues>(() => createDefaultValues(categories))
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const categoryOptions = useMemo(() => categories.map((category) => ({ id: category.id, name: category.name })), [categories])

  useEffect(() => {
    if (open) {
      setError(null)
      setIsSubmitting(false)
      if (initialValues) {
        setFormData(initialValues)
      } else {
        setFormData(createDefaultValues(categories))
      }
    }
  }, [open, categories, initialValues])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!formData.name.trim()) {
        throw new Error(t("Rule name is required"))
      }
      if (!formData.categoryId) {
        throw new Error(t("Please select a category"))
      }
      if (!formData.pattern.trim()) {
        throw new Error(t("Pattern is required"))
      }

      await onSubmit(formData)
      if (mode === "create") {
        setFormData(createDefaultValues(categories))
      }
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Failed to save rule"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Add Automation Rule") : t("Edit Automation Rule")}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("Create a rule to automatically categorize transactions")
              : t("Update the automation rule configuration")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">{t("Rule Name")}</Label>
            <Input
              id="rule-name"
              placeholder={t("e.g., Grocery Stores")}
              value={formData.name}
              onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-category">{t("Category")}</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, categoryId: value }))}
              >
                <SelectTrigger id="rule-category">
                  <SelectValue placeholder={t("Select category") ?? undefined} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-type">{t("Match Type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: RuleFormValues["type"]) => setFormData((previous) => ({ ...previous, type: value }))}
              >
                <SelectTrigger id="rule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">{t("Contains")}</SelectItem>
                  <SelectItem value="starts_with">{t("Starts With")}</SelectItem>
                  <SelectItem value="ends_with">{t("Ends With")}</SelectItem>
                  <SelectItem value="exact">{t("Exact Match")}</SelectItem>
                  <SelectItem value="regex">{t("Regular Expression")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-pattern">{t("Pattern")}</Label>
            <Input
              id="rule-pattern"
              placeholder={t("e.g., grocery|supermarket|walmart")}
              value={formData.pattern}
              onChange={(event) => setFormData((previous) => ({ ...previous, pattern: event.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">{t('Use | to separate multiple patterns (e.g., "starbucks|coffee|cafe")')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-description">{t("Description (Optional)")}</Label>
            <Textarea
              id="rule-description"
              placeholder={t("Describe what this rule matches...")}
              value={formData.description}
              onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-priority">{t("Priority")}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, priority: value }))}
              >
                <SelectTrigger id="rule-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("High (1)")}</SelectItem>
                  <SelectItem value="2">{t("Medium (2)")}</SelectItem>
                  <SelectItem value="3">{t("Low (3)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-active">{t("Active")}</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="rule-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData((previous) => ({ ...previous, isActive: checked }))}
                />
                <Label htmlFor="rule-active" className="text-sm">
                  {formData.isActive ? t("Enabled") : t("Disabled")}
                </Label>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Saving…") : mode === "create" ? t("Add Rule") : t("Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
