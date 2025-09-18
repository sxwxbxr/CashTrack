import { promises as fs } from "fs"
import path from "path"
import { Transaction } from "@/lib/transactions/types"

const DATA_DIRECTORY = path.join(process.cwd(), "data")
const TRANSACTIONS_FILE = path.join(DATA_DIRECTORY, "transactions.json")

async function ensureDataFile() {
  try {
    await fs.access(TRANSACTIONS_FILE)
  } catch {
    await fs.mkdir(DATA_DIRECTORY, { recursive: true })
    await fs.writeFile(TRANSACTIONS_FILE, "[]", "utf8")
  }
}

export async function readTransactions(): Promise<Transaction[]> {
  await ensureDataFile()
  const fileContents = await fs.readFile(TRANSACTIONS_FILE, "utf8")
  const parsed = JSON.parse(fileContents) as Transaction[]
  return parsed.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount),
  }))
}

export async function writeTransactions(transactions: Transaction[]) {
  await ensureDataFile()
  await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2), "utf8")
}
