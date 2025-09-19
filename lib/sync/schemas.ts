import { z } from "zod"

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().min(1).optional().nullable(),
  categoryName: z.string().min(1),
  amount: z.number(),
  account: z.string().min(1),
  status: z.enum(["pending", "completed", "cleared"]),
  type: z.enum(["income", "expense"]),
  notes: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  monthlyBudget: z.number().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const automationRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  type: z.string().min(1),
  pattern: z.string().min(1),
  priority: z.number().int().nonnegative(),
  isActive: z.boolean(),
  description: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const settingRowSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.string().min(1),
})

export const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  passwordHash: z.string().min(1),
  mustChangePassword: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const syncPushPayloadSchema = z.object({
  transactions: z.array(transactionSchema).optional(),
  categories: z.array(categorySchema).optional(),
  rules: z.array(automationRuleSchema).optional(),
  settings: z.array(settingRowSchema).optional(),
  users: z.array(userSchema).optional(),
})

export const backupSnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().min(1),
  transactions: z.array(transactionSchema),
  categories: z.array(categorySchema),
  rules: z.array(automationRuleSchema),
  settings: z.array(settingRowSchema),
  users: z.array(userSchema),
})

export type SyncPushPayload = z.infer<typeof syncPushPayloadSchema>
export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>
