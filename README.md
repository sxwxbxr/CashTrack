# CashTrack

CashTrack is an offline-first household finance dashboard built with Next.js 14. Transactions, categories, automation rules, and settings live in a local SQLite database so the app stays fast and private even without an internet connection. A service worker keeps the UI responsive when you are offline, while LAN sync endpoints and Windows packaging scripts make it easy to share a single ledger across the devices in your home.

Remember!! CashTrack will never be able to automatically sync with your daily transactions due to its offline-firt architecture. You still need to either manually enter the Transactions or bulk-load them via bank statements (CSV or PDF-Format).

## Features

- **SQLite persistence** – data is stored in `cashtrack.db` under your configured `CASHTRACK_DATA_DIR`. Existing JSON seed files are imported automatically on the first run.
- **Household authentication** – iron-session backed login with default `household / cashtrack` credentials. Require a password change before accessing the full app.
- **Rich dashboard** – live income/expense trends, category spending charts, and budget utilisation calculated directly from SQL queries.
- **Automation rules & bulk import** – reapply category automation after CSV imports without touching JSON files.
- **LAN sync & backups** – authenticated `/api/sync/{pull,push,export,import}` endpoints plus settings to toggle LAN access and track the last successful sync.
- **Offline-ready** – `public/sw.js` caches static assets and recent API responses; `app/manifest.ts` exposes installable PWA metadata with icons.
- **Desktop distribution** – scripts to build a Windows-ready bundle, install a background service, and generate an Inno Setup installer.

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env.local` (or `.env`) and set a secure session secret. By default the SQLite database and backups live in `./data`, but you can point `CASHTRACK_DATA_DIR` at another folder such as a shared network drive.

   ```env
   CASHTRACK_SESSION_SECRET=replace-me-with-a-strong-random-value
   CASHTRACK_DATA_DIR=./data
   SYNC_HOST=http://192.168.1.10:3000   # optional override used for LAN discovery text
   ```

3. **Initialise the database**

   ```bash
   npm run db:migrate
   ```

   The migration script creates the SQLite schema, imports any JSON seed files that already exist in `data/`, and provisions the default `household` user with the password `cashtrack` (flagged to change on first login).

4. **Launch the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in with `household / cashtrack`, and head to **Settings → Household Account** to change the password for everyone.

### Default credentials

- Username: `household`
- Password: `cashtrack`

Sessions are backed by iron-session cookies; set `CASHTRACK_SESSION_SECRET` to a high-entropy value before deploying.

## Syncing & backups

- Toggle **Allow LAN sync** in Settings to permit authenticated requests against the sync endpoints.
- Pull incremental changes: `GET /api/sync/pull?since=<ISO timestamp>`
- Push merges from another device: `POST /api/sync/push`
- Export a JSON snapshot: `GET /api/sync/export`
- Restore a snapshot: upload the JSON file to `POST /api/sync/import` or use the Settings UI.

The `settings` table tracks the discovery host, last backup time, and last successful sync so you can monitor sharing across the household.

## Windows packaging & service control

1. **Create a production desktop bundle**

   ```bash
   npm run build:desktop
   ```

   The script outputs `release/windows/app` (Next.js build, production dependencies, scripts) and `release/windows/runtime`. Copy a portable Node.js runtime into `release/windows/runtime` or set `CASHTRACK_NODE_RUNTIME` before running the script.

2. **Install the Windows service**

   ```bash
   npm run service:install
   ```

   This registers a "CashTrack Local Server" service that launches `next start` on boot, storing the SQLite database under `%PROGRAMDATA%\CashTrack\data` and logs under `%PROGRAMDATA%\CashTrack\logs`. Use `npm run service:uninstall` to remove it.

3. **Build an installer**

   Open `installer/windows/CashTrackInstaller.iss` in Inno Setup to package the contents of `release/windows` into a distributable installer. The installer copies files into `%ProgramFiles%/CashTrack`, registers the Windows service, and creates shortcuts that open `http://localhost:3000` in the default browser.

## Additional documentation

Detailed platform-specific setup, backup/restore tips, and LAN sync usage notes live in [`docs/LOCAL_INSTALLATION.md`](./docs/LOCAL_INSTALLATION.md).

## Development commands

```bash
npm run dev          # start the Next.js dev server
npm run db:migrate   # run migrations and seed the SQLite database
npm run lint         # TypeScript + ESLint checks
npm run build        # production build (used by build:desktop)
```

## Staying private & offline

- CashTrack never ships analytics or telemetry. Remove `@vercel/analytics` entirely and keep the app self-hosted.
- PWA metadata (`app/manifest.ts`) and the service worker (`public/sw.js`) let you install CashTrack and keep working offline; budget summaries and charts render from cached SQLite data even when disconnected.
- Point `CASHTRACK_DATA_DIR` at a synced folder (Syncthing, NAS share, etc.) to replicate the SQLite database, or rely on the built-in LAN sync endpoints for incremental replication between trusted devices.
