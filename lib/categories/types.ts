export interface Category {
  id: string
  name: string
  icon: string
  color: string
  monthlyBudget: number
  createdAt: string
  updatedAt: string
}

export interface CategoryWithStats extends Category {
  spent: number
  transactionCount: number
}

export interface CategoryListResult {
  categories: CategoryWithStats[]
}

export interface CreateCategoryInput {
  name: string
  icon: string
  color: string
  monthlyBudget: number
}

export interface UpdateCategoryInput {
  name?: string
  icon?: string
  color?: string
  monthlyBudget?: number
}

export type RuleMatchType = "contains" | "starts_with" | "ends_with" | "exact" | "regex"

export interface AutomationRule {
  id: string
  name: string
  categoryId: string
  type: RuleMatchType
  pattern: string
  priority: number
  isActive: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AutomationRuleWithStats extends AutomationRule {
  categoryName: string
  matchCount: number
}

export interface RuleListResult {
  rules: AutomationRuleWithStats[]
}

export interface CreateAutomationRuleInput {
  name: string
  categoryId: string
  type: RuleMatchType
  pattern: string
  priority: number
  isActive: boolean
  description?: string
}

export interface UpdateAutomationRuleInput {
  name?: string
  categoryId?: string
  type?: RuleMatchType
  pattern?: string
  priority?: number
  isActive?: boolean
  description?: string
}
