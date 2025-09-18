import type { AutomationRule, Category } from "@/lib/categories/types"

export type AutomationRuleMatch = {
  categoryId: string
  categoryName: string
}

export function matchesAutomationRule(rule: AutomationRule, description: string): boolean {
  if (!description) {
    return false
  }

  const normalizedDescription = description.toLowerCase()
  const patterns = rule.pattern
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (patterns.length === 0) {
    return false
  }

  switch (rule.type) {
    case "contains":
      return patterns.some((pattern) => normalizedDescription.includes(pattern.toLowerCase()))
    case "starts_with":
      return patterns.some((pattern) => normalizedDescription.startsWith(pattern.toLowerCase()))
    case "ends_with":
      return patterns.some((pattern) => normalizedDescription.endsWith(pattern.toLowerCase()))
    case "exact":
      return patterns.some((pattern) => normalizedDescription === pattern.toLowerCase())
    case "regex":
      return patterns.some((pattern) => {
        try {
          const regex = new RegExp(pattern, "i")
          return regex.test(description)
        } catch {
          return false
        }
      })
    default:
      return false
  }
}

export function createAutomationRuleEvaluator(rules: AutomationRule[], categories: Category[]) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  const orderedRules = rules
    .filter((rule) => rule.isActive)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.name.localeCompare(b.name)
    })

  return (description: string): AutomationRuleMatch | null => {
    if (!description?.trim()) {
      return null
    }

    for (const rule of orderedRules) {
      if (matchesAutomationRule(rule, description)) {
        const category = categoriesById.get(rule.categoryId)
        return {
          categoryId: rule.categoryId,
          categoryName: category?.name ?? "Uncategorized",
        }
      }
    }

    return null
  }
}

export function findMatchingCategoryForDescription(
  description: string,
  rules: AutomationRule[],
  categories: Category[],
): AutomationRuleMatch | null {
  const evaluate = createAutomationRuleEvaluator(rules, categories)
  return evaluate(description)
}
