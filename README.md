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

## Binary yang di-bundle (terverifikasi jalan)

- Apache 2.4.68 (Apache Lounge VS18 Win64) — start + HTTP 200 verified
- Nginx 1.30.4 stable — start + HTTP verified
- PHP 8.5.10 (default aktif) + PHP 8.4.25 (VS17 x64 Thread Safe) — php-cgi + FastCGI verified
- MySQL Community 8.4.8 LTS (noinstall) — init + start + koneksi verified
- MariaDB 11.4.8 — init + start + koneksi verified
- PostgreSQL 18.6 — initdb + start + koneksi verified
- Logo `resources/icons/icon.ico` dibuat internal (server-stack mark, navy/teal).

Catatan lingkungan:

- PostgreSQL menolak jalan sebagai Administrator (aturan keamanan upstream). Di dev box yang elevated, verifikasi PG dilakukan via unprivileged token. User normal tidak elevated tidak kena masalah ini.
- Port 20128 RESERVED — Al Server menolak memakai atau mematikan port ini (lihat RESERVED_PORTS di PortAllocator).
- MySQL default 3306 bentrok jika mesin sudah ada service MariaDB/MySQL sistem; ganti port dari UI (terverifikasi di 3336).

## Asumsi dan perlu direview (lama)

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
