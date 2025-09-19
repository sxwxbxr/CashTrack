import fs from "fs"
import path from "path"

let cachedDirectory: string | null = null

function resolveDataDirectory(): string {
  const configured = process.env.CASHTRACK_DATA_DIR?.trim()
  if (configured && configured.length > 0) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }
  return path.join(process.cwd(), "data")
}

export function getDataDirectory(): string {
  if (cachedDirectory) {
    return cachedDirectory
  }

  const directory = resolveDataDirectory()
  fs.mkdirSync(directory, { recursive: true })
  cachedDirectory = directory
  return directory
}
