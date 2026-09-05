import type { ActionResult, PhpVersion, ServiceName, ServiceStatus, VhostEntry } from "../shared/types";
import type { AlServerApi } from "../preload";

declare global {
  interface Window { alServer: AlServerApi; }
}

const fallbackServices: ServiceStatus[] = [
  { name: "apache", label: "Apache", kind: "web", port: 8080, enabled: true, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "apache", state: "stopped", mock: true },
  { name: "nginx", label: "Nginx", kind: "web", port: 8081, enabled: false, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "nginx", state: "stopped", mock: true },
  { name: "php-fpm", label: "PHP-FPM", kind: "php", port: 9000, enabled: true, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "php", state: "stopped", mock: true },
  { name: "mysql", label: "MySQL", kind: "database", port: 3306, enabled: true, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "mysql", state: "stopped", mock: true },
  { name: "mariadb", label: "MariaDB", kind: "database", port: 3307, enabled: false, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "mariadb", state: "stopped", mock: true },
  { name: "postgresql", label: "PostgreSQL", kind: "database", port: 5432, enabled: false, binaryRelPath: "", args: [], configRelPath: "", dataDirName: "postgresql", state: "stopped", mock: true }
];

const noBridge = (): ActionResult => ({ success: false, message: "preview mode (no electron bridge)" });

export const api = {
  async listServices(): Promise<ServiceStatus[]> {
    if (!window.alServer) return fallbackServices;
    return window.alServer.listServices();
  },
  async start(n: ServiceName): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.start(n);
  },
  async stop(n: ServiceName): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.stop(n);
  },
  async restart(n: ServiceName): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.restart(n);
  },
  async setPort(name: ServiceName, port: number): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.setPort({ name, port });
  },
  async setEnabled(name: ServiceName, enabled: boolean): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.setEnabled(name, enabled);
  },
  async logTail(name: ServiceName): Promise<string> {
    if (!window.alServer) return "";
    return window.alServer.logTail(name);
  },
  async logClear(name: ServiceName): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.logClear(name);
  },
  async phpList(): Promise<PhpVersion[]> {
    if (!window.alServer) return [];
    return window.alServer.phpList();
  },
  async phpSetActive(v: string): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.phpSetActive(v);
  },
  async vhostsList(): Promise<VhostEntry[]> {
    if (!window.alServer) return [];
    return window.alServer.vhostsList();
  },
  async vhostsAdd(e: VhostEntry): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.vhostsAdd(e);
  },
  async vhostsRemove(host: string): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.vhostsRemove(host);
  },
  async updaterCheck(): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.updaterCheck();
  },
  async updaterInstall(): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.updaterInstall();
  },
  async themeGet(): Promise<string> {
    if (!window.alServer) return "light";
    return window.alServer.themeGet();
  },
  async themeSet(t: string): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.themeSet(t);
  },
  async configExport(): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.configExport();
  },
  async configImport(): Promise<ActionResult> {
    if (!window.alServer) return noBridge();
    return window.alServer.configImport();
  }
};
