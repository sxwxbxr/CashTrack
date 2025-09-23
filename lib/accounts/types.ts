export interface Account {
  id: string
  name: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface AccountWithBalance extends Account {
  balance: number
  inflow: number
  outflow: number
  transactions: number
  balanceInBase: number
  inflowInBase: number
  outflowInBase: number
}

export interface CreateAccountInput {
  name: string
  currency?: string
}

export interface UpdateAccountInput {
  name?: string
  currency?: string
}
