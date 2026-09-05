# Al Server

All-in-one local development server manager. Alternatif modern XAMPP/Laragon: database bundled (MySQL, MariaDB, PostgreSQL), atur port lewat UI, gratis tanpa iklan.

## Quick start

npm install
npm run dev        # renderer (vite :5173) + electron
npm run build      # dist/renderer + dist/main
npm run dist       # installer NSIS (Windows)

## Struktur

src/main      Electron main process (ServiceManager, BinaryRegistry, ConfigEditor, PortAllocator, UpdaterService, VhostManager, PhpVersionManager, ConfigBackup)
src/renderer  React 18 + TS UI (Dashboard, ServiceCard, PortEditor, DatabasePicker, LogViewer)
src/shared    tipe bersama main + renderer
resources/binaries  binary bawaan (di-bundle via extraResources ke process.resourcesPath/binaries)

## Path runtime

- Config internal: app.getPath('userData') via electron-store
- Log: userData/logs/<service>/
- Data service (data dir DB, htdocs): userData/data/<service>/

## Asumsi dan perlu direview

- Binary database: versi stable terbaru saat packaging (MySQL Community 8.4 LTS, MariaDB 11.4 LTS, PostgreSQL 17.x, Apache 2.4.x, Nginx stable 1.26.x, PHP 8.3.x). Taruh binary per service di resources/binaries/<service>/ dan catat versi persis di sini sebelum rilis.
- Code signing: SKIP (installer unsigned). TODO sebelum rilis publik.
- Nama aplikasi final: "Al Server" (App ID dev.al.server).
- Tanpa binary asli, ServiceManager jalan mode mock (placeholder process) supaya dashboard tetap testable. Begitu binary asli ada, mock otomatis nonaktif.
- Virtual host edit file hosts butuh elevated permission di Windows; app deteksi EACCES dan tampilkan instruksi run-as-admin.
- Telemetry: tidak ada. electron-updater hanya cek GitHub Releases saat user klik Check.

## TODO rilis

- [ ] Isi resources/icons/icon.ico final
- [ ] Code signing Windows
- [ ] Uji installer di Windows bersih + SmartScreen note
