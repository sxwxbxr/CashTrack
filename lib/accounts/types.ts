export interface Account {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface AccountWithBalance extends Account {
  balance: number
  inflow: number
  outflow: number
  transactions: number
}

export interface CreateAccountInput {
  name: string
}

export interface UpdateAccountInput {
  name?: string
}
