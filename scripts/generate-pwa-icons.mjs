import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(scriptDir, "assets")
const targetDir = join(process.cwd(), "public", "icons")

const icons = [
  { name: "icon-192x192.png", source: "icon-192x192.b64" },
  { name: "icon-512x512.png", source: "icon-512x512.b64" },
]

mkdirSync(targetDir, { recursive: true })

for (const icon of icons) {
  const base64 = readFileSync(join(assetsDir, icon.source), "utf8").replace(/\s+/g, "")
  const buffer = Buffer.from(base64, "base64")
  const targetPath = join(targetDir, icon.name)
  writeFileSync(targetPath, buffer)
  console.log(`Generated ${targetPath}`)
}
