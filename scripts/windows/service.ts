import fs from "fs"
import path from "path"

function resolveProgramData() {
  return process.env.PROGRAMDATA || path.join(process.env.SYSTEMDRIVE || "C:", "ProgramData")
}

async function resolveServiceConstructor() {
  if (process.platform !== "win32") {
    console.error("The CashTrack Windows service helpers can only run on Windows.")
    process.exit(1)
  }

  const nodeWindows = await import("node-windows")
  return nodeWindows.Service
}

function resolveAction(): "install" | "uninstall" {
  if (process.argv.includes("--install")) {
    return "install"
  }
  if (process.argv.includes("--uninstall")) {
    return "uninstall"
  }
  throw new Error("Specify --install or --uninstall")
}

async function main() {
  const action = resolveAction()
  const programData = resolveProgramData()
  const dataDirectory = path.join(programData, "CashTrack", "data")
  fs.mkdirSync(dataDirectory, { recursive: true })

  const serviceScript = path.join(process.cwd(), "scripts", "windows", "service-runner.cjs")
  const Service = await resolveServiceConstructor()
  const svc = new Service({
    name: "CashTrack Local Server",
    description: "Runs the CashTrack Next.js server for LAN syncing",
    script: serviceScript,
    env: [
      { name: "APP_ROOT", value: process.cwd() },
      { name: "CASHTRACK_DATA_DIR", value: dataDirectory },
    ],
  })

  if (action === "install") {
    svc.on("install", () => {
      console.log("CashTrack Local Server installed")
      svc.start()
    })
    svc.install()
  } else {
    svc.on("uninstall", () => {
      console.log("CashTrack Local Server removed")
    })
    svc.uninstall()
  }
}

main().catch((error) => {
  console.error("Service command failed", error)
  process.exit(1)
})
