"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, Target, Zap, Search } from "lucide-react"
import { AddCategoryDialog } from "@/components/add-category-dialog"
import { AddRuleDialog } from "@/components/add-rule-dialog"
import { EditBudgetDialog } from "@/components/edit-budget-dialog"

// Mock data
const mockCategories = [
  {
    id: "1",
    name: "Food & Dining",
    icon: "🍽️",
    color: "bg-blue-500",
    budget: 600,
    spent: 450,
    transactionCount: 23,
  },
  {
    id: "2",
    name: "Transportation",
    icon: "🚗",
    color: "bg-green-500",
    budget: 300,
    spent: 280,
    transactionCount: 12,
  },
  {
    id: "3",
    name: "Entertainment",
    icon: "🎬",
    color: "bg-purple-500",
    budget: 200,
    spent: 120,
    transactionCount: 8,
  },
  {
    id: "4",
    name: "Shopping",
    icon: "🛍️",
    color: "bg-yellow-500",
    budget: 400,
    spent: 350,
    transactionCount: 15,
  },
  {
    id: "5",
    name: "Bills & Utilities",
    icon: "⚡",
    color: "bg-red-500",
    budget: 800,
    spent: 725,
    transactionCount: 6,
  },
  {
    id: "6",
    name: "Healthcare",
    icon: "🏥",
    color: "bg-pink-500",
    budget: 150,
    spent: 85,
    transactionCount: 3,
  },
]

const mockRules = [
  {
    id: "1",
    name: "Grocery Stores",
    category: "Food & Dining",
    type: "contains",
    pattern: "grocery|supermarket|walmart|target",
    priority: 1,
    isActive: true,
    matchCount: 45,
  },
  {
    id: "2",
    name: "Gas Stations",
    category: "Transportation",
    type: "contains",
    pattern: "shell|exxon|bp|chevron|gas",
    priority: 2,
    isActive: true,
    matchCount: 23,
  },
  {
    id: "3",
    name: "Streaming Services",
    category: "Entertainment",
    type: "contains",
    pattern: "netflix|spotify|hulu|disney|amazon prime",
    priority: 1,
    isActive: true,
    matchCount: 12,
  },
  {
    id: "4",
    name: "Coffee Shops",
    category: "Food & Dining",
    type: "contains",
    pattern: "starbucks|coffee|cafe",
    priority: 3,
    isActive: true,
    matchCount: 18,
  },
  {
    id: "5",
    name: "Utility Bills",
    category: "Bills & Utilities",
    type: "contains",
    pattern: "electric|water|gas bill|internet|phone bill",
    priority: 1,
    isActive: true,
    matchCount: 8,
  },
]

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false)
  const [showEditBudgetDialog, setShowEditBudgetDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<any>(null)

  const filteredCategories = mockCategories.filter((category) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredRules = mockRules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEditBudget = (category: any) => {
    setSelectedCategory(category)
    setShowEditBudgetDialog(true)
  }

  return (
    <AppLayout
      title="Categories & Rules"
      description="Manage spending categories and automation rules"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddRuleDialog(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
          <Button size="sm" onClick={() => setShowAddCategoryDialog(true)}>
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
            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Categories Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => (
                <Card key={category.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center text-white text-lg`}
                        >
                          {category.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <CardDescription>{category.transactionCount} transactions</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditBudget(category)}>
                          <Target className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">${category.budget}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Spent</span>
                        <span
                          className={`font-medium ${category.spent > category.budget * 0.8 ? "text-red-600" : "text-green-600"}`}
                        >
                          ${category.spent}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{((category.spent / category.budget) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              category.spent / category.budget > 0.8 ? "bg-red-500" : category.color
                            }`}
                            style={{ width: `${Math.min((category.spent / category.budget) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining</span>
                        <span
                          className={`font-medium ${category.budget - category.spent < 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          ${Math.max(category.budget - category.spent, 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search rules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rules List */}
            <Card>
              <CardHeader>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription>
                  Rules automatically categorize transactions based on patterns in descriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">Priority {rule.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Category: <span className="font-medium">{rule.category}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Pattern: <code className="bg-muted px-1 rounded text-xs">{rule.pattern}</code>
                        </p>
                        <p className="text-xs text-muted-foreground">Matched {rule.matchCount} transactions</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AddCategoryDialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog} />
      <AddRuleDialog open={showAddRuleDialog} onOpenChange={setShowAddRuleDialog} />
      <EditBudgetDialog
        open={showEditBudgetDialog}
        onOpenChange={setShowEditBudgetDialog}
        category={selectedCategory}
      />
    </AppLayout>
  )
}
