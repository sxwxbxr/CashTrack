const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

const programData = process.env.PROGRAMDATA || path.join(process.env.SYSTEMDRIVE || "C:", "ProgramData")
const logDirectory = path.join(programData, "CashTrack", "logs")
fs.mkdirSync(logDirectory, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
const logFile = path.join(logDirectory, `cashtrack-${timestamp}.log`)
const logStream = fs.createWriteStream(logFile, { flags: "a" })

const port = process.env.PORT || "3000"
const args = [
  "node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  port,
]

logStream.write(`[${new Date().toISOString()}] Starting CashTrack server on port ${port}\n`)

const child = spawn("node", args, {
  cwd: process.env.APP_ROOT || process.cwd(),
  env: { ...process.env },
  stdio: ["ignore", "pipe", "pipe"],
})

child.stdout.on("data", (data) => {
  logStream.write(data)
})

child.stderr.on("data", (data) => {
  logStream.write(data)
})

const shutdown = (signal) => {
  logStream.write(`[${new Date().toISOString()}] Received ${signal}, stopping server\n`)
  child.kill("SIGTERM")
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

child.on("exit", (code) => {
  logStream.write(`[${new Date().toISOString()}] Server exited with code ${code}\n`)
  logStream.end()
  process.exit(code ?? 0)
})
