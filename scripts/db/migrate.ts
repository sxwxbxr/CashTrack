import { initDatabase } from "../../lib/db"
import { getDataDirectory } from "../../lib/db/paths"

async function main() {
  await initDatabase()
  console.log(`Database initialized in ${getDataDirectory()}`)
}

main().catch((error) => {
  console.error("Failed to initialize database", error)
  process.exit(1)
})
