"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { AddCategoryDialog, type CategoryFormValues } from "@/components/add-category-dialog"
import { AddRuleDialog, type RuleFormValues } from "@/components/add-rule-dialog"
import { EditBudgetDialog } from "@/components/edit-budget-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Edit, Loader2, Plus, Search, Target, Trash2, Zap } from "lucide-react"

interface Category {
  id: string
  name: string
  icon: string
  color: string
  monthlyBudget: number
  spent: number
  transactionCount: number
}

type RuleMatchType = "contains" | "starts_with" | "ends_with" | "exact" | "regex"

interface Rule {
  id: string
  name: string
  categoryId: string
  categoryName: string
  type: RuleMatchType
  pattern: string
  priority: number
  isActive: boolean
  description?: string
  matchCount: number
}

const matchTypeLabels: Record<RuleMatchType, string> = {
  contains: "Contains",
  starts_with: "Starts With",
  ends_with: "Ends With",
  exact: "Exact",
  regex: "Regex",
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sortCategories(list: Category[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

function sortRules(list: Rule[]) {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return a.name.localeCompare(b.name)
  })
}

function formatReprocessedMessage(count: number) {
  if (count === 0) {
    return "No existing transactions were recategorized."
  }
  if (count === 1) {
    return "1 transaction was recategorized."
  }
  return `${count} transactions were recategorized.`
}

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryDialogMode, setCategoryDialogMode] = useState<"create" | "edit">("create")
  const [categoryDialogSelection, setCategoryDialogSelection] = useState<Category | null>(null)

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [ruleDialogMode, setRuleDialogMode] = useState<"create" | "edit">("create")
  const [ruleDialogSelection, setRuleDialogSelection] = useState<Rule | null>(null)

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [budgetCategory, setBudgetCategory] = useState<Category | null>(null)

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError(null)
    try {
      const response = await fetch("/api/categories", { cache: "no-store" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Failed to load categories"
        throw new Error(message)
      }
      const data = (await response.json()) as { categories: Category[] }
      setCategories(sortCategories(data.categories))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load categories"
      setCategoriesError(message)
      toast.error("Unable to load categories", { description: message })
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  const fetchRules = useCallback(async () => {
    setRulesLoading(true)
    setRulesError(null)
    try {
      const response = await fetch("/api/categories/rules", { cache: "no-store" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Failed to load rules"
        throw new Error(message)
      }
      const data = (await response.json()) as { rules: Rule[] }
      setRules(sortRules(data.rules))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load rules"
      setRulesError(message)
      toast.error("Unable to load automation rules", { description: message })
    } finally {
      setRulesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchRules()
  }, [fetchCategories, fetchRules])

  useEffect(() => {
    if (categoryDialogSelection) {
      const updated = categories.find((category) => category.id === categoryDialogSelection.id)
      if (updated && updated !== categoryDialogSelection) {
        setCategoryDialogSelection(updated)
      }
    }
  }, [categories, categoryDialogSelection])

  useEffect(() => {
    if (budgetCategory) {
      const updated = categories.find((category) => category.id === budgetCategory.id)
      if (updated && updated !== budgetCategory) {
        setBudgetCategory(updated)
      }
    }
  }, [categories, budgetCategory])

  useEffect(() => {
    if (ruleDialogSelection) {
      const updated = rules.find((rule) => rule.id === ruleDialogSelection.id)
      if (updated && updated !== ruleDialogSelection) {
        setRuleDialogSelection(updated)
      }
    }
  }, [rules, ruleDialogSelection])

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return categories
    }
    return categories.filter((category) => category.name.toLowerCase().includes(normalizedSearch))
  }, [categories, normalizedSearch])

  const filteredRules = useMemo(() => {
    if (!normalizedSearch) {
      return rules
    }
    return rules.filter((rule) => {
      const search = normalizedSearch
      return (
        rule.name.toLowerCase().includes(search) ||
        rule.categoryName.toLowerCase().includes(search) ||
        rule.pattern.toLowerCase().includes(search)
      )
    })
  }, [rules, normalizedSearch])

  const categoryInitialValues = useMemo(() => {
    if (!categoryDialogSelection) {
      return undefined
    }
    return {
      name: categoryDialogSelection.name,
      icon: categoryDialogSelection.icon,
      color: categoryDialogSelection.color,
      monthlyBudget: categoryDialogSelection.monthlyBudget.toString(),
    }
  }, [categoryDialogSelection])

  const ruleInitialValues = useMemo(() => {
    if (!ruleDialogSelection) {
      return undefined
    }
    return {
      name: ruleDialogSelection.name,
      categoryId: ruleDialogSelection.categoryId,
      type: ruleDialogSelection.type,
      pattern: ruleDialogSelection.pattern,
      priority: ruleDialogSelection.priority.toString(),
      isActive: ruleDialogSelection.isActive,
      description: ruleDialogSelection.description ?? "",
    }
  }, [ruleDialogSelection])

  const openCreateCategoryDialog = () => {
    setCategoryDialogMode("create")
    setCategoryDialogSelection(null)
    setCategoryDialogOpen(true)
  }

  const openEditCategoryDialog = (category: Category) => {
    setCategoryDialogMode("edit")
    setCategoryDialogSelection(category)
    setCategoryDialogOpen(true)
  }

  const openBudgetDialog = (category: Category) => {
    setBudgetCategory(category)
    setBudgetDialogOpen(true)
  }

  const openCreateRuleDialog = () => {
    setRuleDialogMode("create")
    setRuleDialogSelection(null)
    if (categories.length === 0) {
      toast.info("Add a category before creating rules")
      return
    }
    setRuleDialogOpen(true)
  }

  const openEditRuleDialog = (rule: Rule) => {
    setRuleDialogMode("edit")
    setRuleDialogSelection(rule)
    setRuleDialogOpen(true)
  }

  const handleCategoryDialogOpenChange = (open: boolean) => {
    setCategoryDialogOpen(open)
    if (!open) {
      setCategoryDialogSelection(null)
    }
  }

  const handleRuleDialogOpenChange = (open: boolean) => {
    setRuleDialogOpen(open)
    if (!open) {
      setRuleDialogSelection(null)
    }
  }

  const handleBudgetDialogOpenChange = (open: boolean) => {
    setBudgetDialogOpen(open)
    if (!open) {
      setBudgetCategory(null)
    }
  }

  const handleCategorySubmit = async (values: CategoryFormValues) => {
    const monthlyBudget = Number.parseFloat(values.monthlyBudget)
    if (Number.isNaN(monthlyBudget) || monthlyBudget < 0) {
      throw new Error("Budget must be a positive number")
    }

    const payload = {
      name: values.name.trim(),
      icon: values.icon,
      color: values.color,
      monthlyBudget,
    }

    if (categoryDialogMode === "create") {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to create category"
        throw new Error(message)
      }

      const data = (await response.json()) as { category: Category }
      setCategories((previous) => sortCategories([...previous, data.category]))
      toast.success("Category added")
    } else if (categoryDialogSelection) {
      const response = await fetch(`/api/categories/${categoryDialogSelection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to update category"
        throw new Error(message)
      }

      const data = (await response.json()) as { category: Category }
      setCategories((previous) =>
        sortCategories(previous.map((category) => (category.id === data.category.id ? data.category : category))),
      )
      setBudgetCategory((previous) => (previous?.id === data.category.id ? data.category : previous))
      toast.success("Category updated")
      await fetchRules()
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    const confirmed = window.confirm(
      `Delete category "${category.name}"? Transactions will be marked as Uncategorized and related rules removed.`,
    )
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to delete category"
        throw new Error(message)
      }

      setCategories((previous) => sortCategories(previous.filter((entry) => entry.id !== category.id)))
      setBudgetCategory((previous) => (previous?.id === category.id ? null : previous))
      toast.success("Category deleted")
      await fetchRules()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete category"
      toast.error("Delete failed", { description: message })
    }
  }

  const handleBudgetSubmit = async (newBudget: number) => {
    if (!budgetCategory) {
      throw new Error("No category selected")
    }

    const response = await fetch(`/api/categories/${budgetCategory.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyBudget: newBudget }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as { error?: unknown }))
      const message = typeof body.error === "string" ? body.error : "Unable to update budget"
      throw new Error(message)
    }

    const data = (await response.json()) as { category: Category }
    setCategories((previous) =>
      sortCategories(previous.map((category) => (category.id === data.category.id ? data.category : category))),
    )
    setBudgetCategory(data.category)
    setCategoryDialogSelection((previous) => (previous?.id === data.category.id ? data.category : previous))
    toast.success("Budget updated")
  }

  const handleRuleSubmit = async (values: RuleFormValues) => {
    const payload = {
      name: values.name.trim(),
      categoryId: values.categoryId,
      type: values.type,
      pattern: values.pattern.trim(),
      priority: Number.parseInt(values.priority, 10),
      isActive: values.isActive,
      description: values.description.trim() ? values.description.trim() : undefined,
    }

    if (!payload.categoryId) {
      throw new Error("Please select a category")
    }

    if (Number.isNaN(payload.priority) || payload.priority < 1) {
      throw new Error("Priority must be a positive number")
    }

    if (ruleDialogMode === "create") {
      const response = await fetch("/api/categories/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to create rule"
        throw new Error(message)
      }

      const data = (await response.json()) as { rule: Rule; reprocessedCount: number }
      setRules((previous) => sortRules([...previous, data.rule]))
      if (data.reprocessedCount > 0) {
        void fetchCategories()
      }
      toast.success("Rule created", { description: formatReprocessedMessage(data.reprocessedCount) })
    } else if (ruleDialogSelection) {
      const response = await fetch(`/api/categories/rules/${ruleDialogSelection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to update rule"
        throw new Error(message)
      }

      const data = (await response.json()) as { rule: Rule; reprocessedCount: number }
      setRules((previous) => sortRules(previous.map((rule) => (rule.id === data.rule.id ? data.rule : rule))))
      if (data.reprocessedCount > 0) {
        void fetchCategories()
      }
      toast.success("Rule updated", { description: formatReprocessedMessage(data.reprocessedCount) })
    }
  }

  const handleDeleteRule = async (rule: Rule) => {
    const confirmed = window.confirm(`Delete rule "${rule.name}"?`)
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/categories/rules/${rule.id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: unknown }))
        const message = typeof body.error === "string" ? body.error : "Unable to delete rule"
        throw new Error(message)
      }

      setRules((previous) => previous.filter((entry) => entry.id !== rule.id))
      toast.success("Rule deleted")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete rule"
      toast.error("Delete failed", { description: message })
    }
  }

  const renderCategories = () => {
    if (categoriesLoading) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading categories...
          </div>
        </div>
      )
    }

    if (categoriesError) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-sm text-red-500">{categoriesError}</p>
        </div>
      )
    }

    if (filteredCategories.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-sm text-muted-foreground">No categories found. Try adjusting your search.</p>
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => {
          const remaining = category.monthlyBudget - category.spent
          const utilization =
            category.monthlyBudget > 0
              ? category.spent / category.monthlyBudget
              : category.spent > 0
                ? 1
                : 0
          const progress =
            category.monthlyBudget > 0
              ? Math.min((category.spent / category.monthlyBudget) * 100, 100)
              : category.spent > 0
                ? 100
                : 0
          const spentColor =
            utilization >= 1 ? "text-red-600" : utilization >= 0.8 ? "text-yellow-600" : "text-green-600"
          const remainingColor = remaining < 0 ? "text-red-600" : "text-green-600"
          return (
            <Card key={category.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${category.color} text-lg text-white`}>
                      {category.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <CardDescription>{category.transactionCount} transactions</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openBudgetDialog(category)}>
                      <Target className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditCategoryDialog(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-medium">{formatCurrency(category.monthlyBudget)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className={`font-medium ${spentColor}`}>{formatCurrency(category.spent)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Progress</span>
                      <span>{Math.min(progress, 999).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className={`h-2 rounded-full ${utilization >= 1 ? "bg-red-500" : category.color}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={`font-medium ${remainingColor}`}>
                      {remaining >= 0 ? formatCurrency(remaining) : `-${formatCurrency(Math.abs(remaining))}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderRules = () => {
    if (rulesLoading) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading automation rules...
          </div>
        </div>
      )
    }

    if (rulesError) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-sm text-red-500">{rulesError}</p>
        </div>
      )
    }

    if (filteredRules.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-sm text-muted-foreground">No automation rules found. Try adjusting your search.</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {filteredRules.map((rule) => (
          <div key={rule.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{rule.name}</h4>
                <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant="outline">Priority {rule.priority}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Category: <span className="font-medium">{rule.categoryName}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Pattern ({matchTypeLabels[rule.type]}): <code className="rounded bg-muted px-1 text-xs">{rule.pattern}</code>
              </p>
              {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
              <p className="text-xs text-muted-foreground">Matched {rule.matchCount} transactions</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEditRuleDialog(rule)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <AppLayout
      title="Categories & Rules"
      description="Manage spending categories and automation rules"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openCreateRuleDialog}>
            <Zap className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
          <Button size="sm" onClick={openCreateCategoryDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardContent>
            </Card>

            {renderCategories()}
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search rules..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription>
                  Rules automatically categorize transactions based on patterns in descriptions
                </CardDescription>
              </CardHeader>
              <CardContent>{renderRules()}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={handleCategoryDialogOpenChange}
        mode={categoryDialogMode}
        onSubmit={handleCategorySubmit}
        initialValues={categoryInitialValues}
      />
      <AddRuleDialog
        open={ruleDialogOpen}
        onOpenChange={handleRuleDialogOpenChange}
        mode={ruleDialogMode}
        onSubmit={handleRuleSubmit}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        initialValues={ruleInitialValues}
      />
      <EditBudgetDialog
        open={budgetDialogOpen}
        onOpenChange={handleBudgetDialogOpenChange}
        category={
          budgetCategory
            ? {
                id: budgetCategory.id,
                name: budgetCategory.name,
                monthlyBudget: budgetCategory.monthlyBudget,
                spent: budgetCategory.spent,
              }
            : null
        }
        onSubmit={handleBudgetSubmit}
      />
    </AppLayout>
  )
}

