import type { User } from "./repository"

export interface UserSummary {
  id: string
  username: string
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

export function sanitizeUser(user: User): UserSummary {
  return {
    id: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
