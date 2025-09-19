import { execSync } from "child_process"
import fs from "fs"
import fsPromises from "fs/promises"
import path from "path"
import ts from "typescript"

const rootDir = process.cwd()
const releaseRoot = path.join(rootDir, "release", "windows")
const appDir = path.join(releaseRoot, "app")
const runtimeDir = path.join(releaseRoot, "runtime")
const nodeRuntimeSource = process.env.CASHTRACK_NODE_RUNTIME || path.join(rootDir, "runtime", "windows")

async function rimraf(target: string) {
  if (fs.existsSync(target)) {
    await fsPromises.rm(target, { recursive: true, force: true })
  }
}

async function copyRecursive(source: string, destination: string) {
  await fsPromises.cp(source, destination, { recursive: true })
}

async function transpileServiceScript(destination: string) {
  const sourcePath = path.join(rootDir, "scripts", "windows", "service.ts")
  const source = await fsPromises.readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  })
  await fsPromises.writeFile(destination, transpiled.outputText, "utf8")
}

async function writeEnvTemplate() {
  const envPath = path.join(appDir, ".env.production")
  const contents = `CASHTRACK_SESSION_SECRET=change-me-in-production\nCASHTRACK_DATA_DIR=%PROGRAMDATA%\\CashTrack\\data\nSYNC_HOST=\n`
  await fsPromises.writeFile(envPath, contents, "utf8")
}

async function ensureDirectories() {
  await fsPromises.mkdir(appDir, { recursive: true })
  await fsPromises.mkdir(runtimeDir, { recursive: true })
  await fsPromises.mkdir(path.join(appDir, "scripts", "windows"), { recursive: true })
}

async function copyApplicationFiles() {
  await copyRecursive(path.join(rootDir, ".next"), path.join(appDir, ".next"))
  await copyRecursive(path.join(rootDir, "public"), path.join(appDir, "public"))
  await fsPromises.copyFile(path.join(rootDir, "package.json"), path.join(appDir, "package.json"))
  await fsPromises.copyFile(path.join(rootDir, "package-lock.json"), path.join(appDir, "package-lock.json"))
  if (fs.existsSync(path.join(rootDir, "next.config.mjs"))) {
    await fsPromises.copyFile(path.join(rootDir, "next.config.mjs"), path.join(appDir, "next.config.mjs"))
  }
  await fsPromises.copyFile(
    path.join(rootDir, "scripts", "windows", "service-runner.cjs"),
    path.join(appDir, "scripts", "windows", "service-runner.cjs"),
  )
  await transpileServiceScript(path.join(appDir, "scripts", "windows", "service.js"))
  await fsPromises.copyFile(path.join(rootDir, "scripts", "windows", "service.ts"), path.join(appDir, "scripts", "windows", "service.ts"))
}

async function copyNodeRuntime() {
  if (!fs.existsSync(nodeRuntimeSource)) {
    console.warn(
      "No portable Node runtime found. Place the runtime files under runtime/windows or set CASHTRACK_NODE_RUNTIME to an absolute path.",
    )
    return
  }
  await copyRecursive(nodeRuntimeSource, runtimeDir)
}

async function main() {
  console.log("Building Next.js production bundle...")
  execSync("npm run build", { stdio: "inherit" })

  await rimraf(releaseRoot)
  await ensureDirectories()
  await copyApplicationFiles()

  console.log("Installing production dependencies in release bundle...")
  execSync("npm install --omit=dev", { cwd: appDir, stdio: "inherit" })

  await copyNodeRuntime()
  await writeEnvTemplate()

  console.log("Desktop build ready at", releaseRoot)
  console.log("Copy a portable Node runtime into", runtimeDir)
}

main().catch((error) => {
  console.error("Desktop build failed", error)
  process.exit(1)
})
