export interface Account {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface CreateAccountInput {
  name: string
}

export interface UpdateAccountInput {
  name?: string
}
