# Local installation guide

This document walks through installing CashTrack on Windows, macOS, and Linux without relying on any hosted services. The application is designed to run entirely offline: all data is stored in a local SQLite database, session cookies are issued by iron-session, and a service worker keeps the UI responsive even when the network disappears.

## Requirements

- Node.js 18 or later (LTS recommended)
- npm 9+ (or the bundled version that ships with Node LTS)
- Git (for cloning the repository)
- Optional: Inno Setup 6+ for building the Windows installer

The following environment variables control where CashTrack stores data and how it identifies itself to other devices:

| Variable | Purpose | Default |
| --- | --- | --- |
| `CASHTRACK_SESSION_SECRET` | Secret used to encrypt the iron-session cookie. Must be set to a long random string in production. | *(required)* |
| `CASHTRACK_DATA_DIR` | Directory containing `cashtrack.db`, WAL files, and backups. | `./data` |
| `SYNC_HOST` | Base URL shown in the Settings page for LAN discovery. | `http://<local-ip>:3000` |

> ℹ️ **Tip:** Point `CASHTRACK_DATA_DIR` at a folder that is already synced with Syncthing, iCloud Drive, or a NAS share to replicate the SQLite database across household computers. The seed JSON files that ship in `data/` are imported automatically the first time the migrations run.

## Common setup steps

1. **Clone and install**

   ```bash
   git clone https://github.com/sxwxbxr/CashTrack.git
   cd CashTrack
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env.local` (or `.env`) and set the variables listed above. Keep the session secret private.

3. **Initialise the database**

   ```bash
   npm run db:migrate
   ```

   The migration script creates every table, enables Write-Ahead Logging, imports any existing JSON data, and seeds the default `household / cashtrack` user with `mustChangePassword = 1`.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in with the default credentials, and immediately change the password from **Settings → Household Account**. The middleware enforces a password change before any other HTML route loads.

## Windows

CashTrack includes scripts for packaging a desktop build and running it as a background service.

1. **Build the production bundle**

   ```bash
   npm run build:desktop
   ```

   - `release/windows/app` contains the Next.js production output, server scripts, and a `.env.production` template.
   - `release/windows/runtime` should contain a portable Node runtime. Copy the contents of a Node zip distribution here or set the `CASHTRACK_NODE_RUNTIME` environment variable before running the build script.

2. **Install the Windows service**

   ```bash
   npm run service:install
   ```

   This registers a "CashTrack Local Server" service that runs `next start --hostname 127.0.0.1 --port 3000`. Logs are written to `%PROGRAMDATA%\CashTrack\logs` and the SQLite database lives in `%PROGRAMDATA%\CashTrack\data`. Stop and remove the service with `npm run service:uninstall`.

3. **Build the installer (optional)**

   Open `installer/windows/CashTrackInstaller.iss` in Inno Setup. The script copies the `release/windows` directory to `%ProgramFiles%/CashTrack`, installs the Windows service, and creates Start Menu/Desktop shortcuts pointing at `http://localhost:3000`.

4. **Desktop shortcuts**

   After installation, launch the shortcut to open CashTrack in your default browser. The service keeps running in the background so LAN devices can sync even when no browser is open.

## macOS & Linux

1. Follow the **Common setup steps**.
2. For a persistent server, create a simple process manager entry (e.g. a systemd unit or launchd plist) that runs `npm run start` from the project directory. Remember to set `CASHTRACK_DATA_DIR` to a writable path.
3. To expose the server to other devices on the LAN, ensure the firewall allows inbound connections to port 3000 (or the port you choose). Update `SYNC_HOST` so the Settings page shows the correct URL.
4. Optional: create a `.desktop` entry (Linux) or Automator app (macOS) that opens `http://localhost:3000` for quick access.

## Backups & restore

- **Manual export** – visit Settings and click **Export backup** or run `curl http://localhost:3000/api/sync/export -o cashtrack-backup.json`.
- **Manual import** – upload a previously exported JSON file in Settings or `curl -F file=@cashtrack-backup.json http://localhost:3000/api/sync/import`.
- **Automated retention** – enable automatic backups in Settings to record the last backup timestamp and retention window in the `settings` table. You can schedule a platform-specific task (Task Scheduler, cron, launchd) that calls the export endpoint on an interval.

## LAN sync tips

1. Enable **Allow LAN sync requests** in Settings. This flag is stored in the `settings` table and can be toggled remotely through `PATCH /api/settings` if you authenticate first.
2. Use the displayed discovery URL (`SYNC_HOST`) when configuring other devices. Both `/api/sync/pull` and `/api/sync/push` expect a valid session cookie from the household account.
3. For tools like Syncthing, keep `CASHTRACK_DATA_DIR` inside a synced folder and let Syncthing move the SQLite database around. WAL mode keeps file locking predictable across platforms.
4. Track the `sync.lastSuccessfulAt` setting to confirm that at least one device has pushed or pulled recently.

## Enabling HTTPS with a self-signed certificate

CashTrack runs happily over HTTP on a trusted LAN, but you can layer HTTPS in front of it:

1. Generate a certificate with [`mkcert`](https://github.com/FiloSottile/mkcert) or your preferred tooling.
2. Trust the generated root certificate on every device that will access CashTrack:
   - **Windows:** double-click the root certificate and import it into the "Trusted Root Certification Authorities" store.
   - **macOS:** open Keychain Access, add the certificate to the System keychain, and set it to "Always Trust".
   - **Linux:** place the certificate in `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`.
3. Proxy `npm run start` through a TLS terminator (Caddy, nginx, IIS, or Node's `https` module) that references the certificate files.
4. Update `SYNC_HOST` to use `https://` so the Settings page advertises the secure URL. If you expose the service outside your LAN, rotate credentials regularly and consider restricting access with a firewall or VPN.

## Troubleshooting

- **Session errors:** ensure `CASHTRACK_SESSION_SECRET` is set and at least 16 characters long; otherwise iron-session will throw at startup.
- **Database locked:** SQLite places `.db-wal` files next to the main database. If you see lock errors, verify that only one instance of the server is writing to the database or switch to LAN sync rather than syncing the raw DB file.
- **Service worker cache:** during development you may need to hard refresh (Shift + Reload) to invalidate the cache after code changes.
- **Linting and type checks:** run `npm run lint` before packaging to confirm TypeScript strict mode passes.

Enjoy maintaining your household finances without depending on any cloud services!
