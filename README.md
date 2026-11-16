# Al Server

Bahasa Indonesia version: [readme.id.md](readme.id.md)

All-in-one local development server manager. A modern alternative to XAMPP/Laragon: bundled databases (MySQL, MariaDB, PostgreSQL), configure ports through the UI, free with no ads.

## Quick start

npm install
npm run dev     # renderer (vite :5173) + electron
npm run build   # dist/renderer + dist/main
npm run dist    # NSIS installer (Windows)

## Structure

src/main      Electron main process (ServiceManager, BinaryRegistry, ConfigEditor, PortAllocator, UpdaterService, VhostManager, PhpVersionManager, ConfigBackup)
src/renderer  React 18 + TS UI (Dashboard, ServiceCard, PortEditor, DatabasePicker, LogViewer)
src/shared    types shared by main + renderer
resources/binaries  bundled binaries (bundled via extraResources into process.resourcesPath/binaries)

## Runtime paths

- Config internal: app.getPath('userData') via electron-store
- Log: userData/logs/<service>/
- Service data (DB data dir, htdocs): userData/data/<service>/

## Windows installer (verified)

- `npm run dist` produces `release/Al Server Setup 0.1.0.exe` (~303MB, assisted NSIS: choose directory, desktop + start menu shortcuts, uninstaller).
- Verified: silent install (`/S /D=C:\path` — use backslashes), all binaries included, app boots and writes `%APPDATA%\Al Server\config.json`, clean uninstall.
- Installer is UNSIGNED — Windows SmartScreen will show a blue "Unknown publisher" warning. Click More info > Run anyway. TODO: code signing before the public release.
- release/ is gitignored; official distribution via GitHub Releases (auto-update via electron-updater reading latest.yml).

## Bundled binaries (verified working)

- Apache 2.4.68 (Apache Lounge VS18 Win64) — start + HTTP 200 verified
- Nginx 1.30.4 stable — start + HTTP verified
- PHP 8.5.10 (default active) + PHP 8.4.25 (VS17 x64 Thread Safe) — php-cgi + FastCGI verified
- MySQL Community 8.4.8 LTS (noinstall) — init + start + connection verified
- MariaDB 11.4.8 — init + start + connection verified
- PostgreSQL 18.6 — initdb + start + connection verified
- Logo `resources/icons/icon.ico` created internally (server-stack mark, navy/teal).

Environment notes:

- PostgreSQL refuses to run as Administrator (upstream security rule). On an elevated dev box, PG verification is done via an unprivileged token. Normal, non-elevated users are not affected by this.
- Port 20128 is RESERVED — Al Server refuses to use or kill this port (see RESERVED_PORTS in PortAllocator).
- MySQL default 3306 conflicts if the machine already has a system MariaDB/MySQL service; change the port from the UI (verified on 3336).

## Assumptions and items to review (old)

- Code signing: SKIP (unsigned installer). TODO before the public release.
- Final branding: the internal logo is already installed (icon.ico); replace it any time via resources/icons/icon.ico, then run npm run dist again.
- Final app name: "Al Server" (App ID dev.al.server).
- Without the real binaries, ServiceManager runs in mock mode (placeholder process) so the dashboard stays testable. Once the real binaries are present, mock mode automatically turns off.
- Virtual host editing of the hosts file needs elevated permission on Windows; the app detects EACCES and shows run-as-admin instructions.
- Telemetry: none. electron-updater only checks GitHub Releases when the user clicks Check.

## Release TODO

- [ ] Fill in resources/icons/icon.ico (final)
- [ ] Windows code signing
- [ ] Test the installer on a clean Windows install + SmartScreen note
