import * as fs from "fs";
import * as path from "path";
import type { ServiceConfig, ServiceName } from "../../shared/types";

export const DEFAULT_SERVICES: ServiceConfig[] = [
  { name: "apache", label: "Apache", kind: "web", port: 8080, enabled: true, binaryRelPath: "apache/bin/httpd.exe", args: [], configRelPath: "apache/conf/httpd.conf", dataDirName: "apache" },
  { name: "nginx", label: "Nginx", kind: "web", port: 8081, enabled: false, binaryRelPath: "nginx/nginx.exe", args: [], configRelPath: "nginx/conf/nginx.conf", dataDirName: "nginx" },
  { name: "php-fpm", label: "PHP-FPM", kind: "php", port: 9000, enabled: true, binaryRelPath: "php/php-cgi.exe", args: ["-b", "127.0.0.1:9000"], configRelPath: "php/php.ini", dataDirName: "php" },
  { name: "mysql", label: "MySQL", kind: "database", port: 3306, enabled: true, binaryRelPath: "mysql/bin/mysqld.exe", args: [], configRelPath: "mysql/my.ini.template", dataDirName: "mysql" },
  { name: "mariadb", label: "MariaDB", kind: "database", port: 3307, enabled: false, binaryRelPath: "mariadb/bin/mariadbd.exe", args: [], configRelPath: "mariadb/my.ini.template", dataDirName: "mariadb" },
  { name: "postgresql", label: "PostgreSQL", kind: "database", port: 5432, enabled: false, binaryRelPath: "postgresql/bin/postgres.exe", args: [], configRelPath: "postgresql/postgresql.conf", dataDirName: "postgresql" }
];

export function binariesRoot(resourcesPath: string, devRoot?: string): string {
  if (devRoot) return path.join(devRoot, "resources", "binaries");
  return path.join(resourcesPath, "binaries");
}

export function resolveBinary(root: string, svc: ServiceConfig): string {
  const win = svc.binaryRelPath;
  if (process.platform !== "win32") {
    const noExe = win.replace(/\.exe$/i, "");
    const alt = path.join(root, noExe);
    if (fs.existsSync(alt)) return alt;
    if (fs.existsSync(path.join(root, win))) return path.join(root, win);
    return alt;
  }
  return path.join(root, win);
}

export function binaryExists(root: string, svc: ServiceConfig): boolean {
  return fs.existsSync(resolveBinary(root, svc));
}

export function scanBinaries(root: string): Record<ServiceName, boolean> {
  const out = {} as Record<ServiceName, boolean>;
  for (const svc of DEFAULT_SERVICES) {
    try {
      out[svc.name] = binaryExists(root, svc);
    } catch {
      out[svc.name] = false;
    }
  }
  return out;
}
