# Local installation guide

CashTrack is designed to run entirely on your own hardware. This guide covers the prerequisites, setup steps, and platform-specific tweaks needed to keep everything private and offline while still enabling household sharing over your local network.

## Before you start

| Requirement | Details |
| --- | --- |
| **Node.js** | Version 18.18 or newer (20 LTS recommended for best performance). |
| **npm** | npm 9+ (bundled with recent Node releases). |
| **Git** | Used to clone the repository. |
| **Optional tooling** | [Inno Setup 6+](https://jrsoftware.org/isinfo.php) for the Windows installer, `openssl` (macOS/Linux) or PowerShell for generating secrets. |

> 💡 **Tip:** On Windows, run `npm install --include=optional` if you skipped optional dependencies; the Windows service helper relies on the `node-windows` package.

## 1. Clone the repository and install dependencies

```bash
git clone https://github.com/sxwxbxr/CashTrack.git
cd CashTrack
npm install
```

The install step generates PWA icons (via the `postinstall` script) and installs the platform-specific tooling needed for packaging.

## 2. Configure environment variables

Copy the example file and edit the values to suit your setup.

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `CASHTRACK_SESSION_SECRET` | Encrypts iron-session cookies; must be long and random before exposing the app to other people. | *(none &mdash; required)* |
| `CASHTRACK_DATA_DIR` | Folder containing `cashtrack.db`, WAL files, and JSON backups. Relative paths resolve from the project root. | `./data` |
| `SYNC_HOST` | Optional URL shown in the Settings discovery banner for LAN peers. | `http://<your-lan-ip>:3000` |

Generate a session secret quickly:

```bash
echo "CASHTRACK_SESSION_SECRET=$(openssl rand -base64 32)" >> .env.local
```

```powershell
Add-Content .env.local ("CASHTRACK_SESSION_SECRET=" + [Convert]::ToBase64String([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 })))
```

You can add any other custom variables supported by Next.js in the same `.env.local` file.

## 3. Initialise the database

```bash
npm run db:migrate
```

This script creates the SQLite schema, imports JSON seed files in `data/` (if present), and provisions the default household login (`household` / `cashtrack`). The credentials are marked with `mustChangePassword = 1`, so the UI will force a password change on first sign-in.

## 4. Run CashTrack

### Development mode

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000), sign in with the default credentials, and immediately change the password under **Settings → Household account**.

### Production preview

```bash
npm run build
npm run start
```

This runs the optimised Next.js server on port 3000. Set `PORT` before running `npm run start` if you need a different port.

## 5. Keep CashTrack running in the background

- **Windows service:**
  1. Build the production bundle: `npm run build:desktop`.
  2. Install the background service (requires an elevated terminal): `npm run service:install`.
  3. Logs are stored under `%PROGRAMDATA%\CashTrack\logs` and the SQLite database lives in `%PROGRAMDATA%\CashTrack\data`.
  4. Remove the service with `npm run service:uninstall`.
- **macOS/Linux:**
  - Use your preferred process manager (systemd, launchd, pm2, etc.) to run `npm run start` from the project directory.
  - Ensure the user running the service has read/write access to `CASHTRACK_DATA_DIR`.
  - Open firewall port 3000 (or the port you configure) so other LAN devices can connect.

## Windows desktop distribution

If you want to ship CashTrack as an installer for family members, follow these steps:

1. Run `npm run build:desktop` to prepare `release/windows/app` and `release/windows/runtime`.
   - Copy a portable Node.js runtime into `release/windows/runtime` or set the `CASHTRACK_NODE_RUNTIME` environment variable before running the script.
2. Open `installer/windows/CashTrackInstaller.iss` in Inno Setup and build the installer.
   - The installer copies files into `%ProgramFiles%/CashTrack`, registers the background service, and creates Start Menu/Desktop shortcuts pointing at `http://localhost:3000`.

## Data directory, backups, and sync

- By default `CASHTRACK_DATA_DIR` resolves to `<project-root>/data`. Point it at a NAS, Syncthing, or cloud-synced folder if you prefer file-level replication.
- Enable **Allow LAN sync requests** in Settings when you want to use the `/api/sync/{pull,push,export,import}` endpoints from another device. A valid session cookie is required for every call.
- Export a snapshot from the UI or via `curl http://localhost:3000/api/sync/export -o cashtrack-backup.json`.
- Restore data by uploading through Settings or with `curl -F file=@cashtrack-backup.json http://localhost:3000/api/sync/import`.
- Automated backup retention settings live inside the `settings` table; schedule periodic exports using Task Scheduler, cron, or launchd if you want off-site copies.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **"Session secret is required"** | Double-check that `CASHTRACK_SESSION_SECRET` is set and at least 16 characters long before running the server. |
| **"SQLITE_BUSY" / database locked** | Verify that only one CashTrack server is writing to the SQLite database. When in doubt, rely on LAN sync instead of syncing the raw `.db` file. |
| **Service worker caching stale assets** | Hard refresh (Shift + Reload) during development to bust the cache, or clear application storage in your browser dev tools. |
| **Missing icons after clone** | Run `npm run postinstall` (or `npm install`) to regenerate the PWA icons in `public/icons`. |
| **TypeScript or lint errors** | Run `npm run lint` and fix the reported issues before packaging a build. |

Enjoy maintaining your household finances without depending on any hosted service.
