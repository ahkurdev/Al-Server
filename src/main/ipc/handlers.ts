import { BrowserWindow, dialog, ipcMain } from "electron";
import * as fs from "fs";
import type { PortApplyRequest, ServiceName } from "../../shared/types";
import type { ServiceManager } from "../services/ServiceManager";
import type { PhpVersionManager } from "../services/PhpVersionManager";
import type { VhostManager } from "../services/VhostManager";
import type { UpdaterService } from "../services/UpdaterService";

interface Deps {
  services: ServiceManager;
  php: PhpVersionManager;
  vhosts: VhostManager;
  updater: UpdaterService;
  store: { get(k: string, f?: unknown): unknown; set(k: string, v: unknown): void };
}

export function registerHandlers(deps: Deps): void {
  const { services, php, vhosts, updater, store } = deps;

  ipcMain.handle("services:list", () => services.list());
  ipcMain.handle("services:start", (_e, name: ServiceName) => services.start(name));
  ipcMain.handle("services:stop", (_e, name: ServiceName) => services.stop(name));
  ipcMain.handle("services:restart", (_e, name: ServiceName) => services.restart(name));
  ipcMain.handle("services:set-port", (_e, req: PortApplyRequest) => services.setPort(req.name, req.port));
  ipcMain.handle("services:set-enabled", (_e, name: ServiceName, enabled: boolean) => services.setEnabled(name, enabled));
  ipcMain.handle("services:log-tail", (_e, name: ServiceName) => services.readLogTail(name));
  ipcMain.handle("services:log-clear", (_e, name: ServiceName) => services.clearLog(name));

  ipcMain.handle("php:list", () => php.scan());
  ipcMain.handle("php:set-active", (_e, v: string) => php.setActive(v));

  ipcMain.handle("vhosts:list", () => vhosts.list());
  ipcMain.handle("vhosts:add", (_e, entry) => vhosts.add(entry));
  ipcMain.handle("vhosts:remove", (_e, host: string) => vhosts.remove(host));

  ipcMain.handle("updater:check", () => updater.check());
  ipcMain.handle("updater:install", () => updater.downloadAndInstall());

  ipcMain.handle("theme:get", () => (store.get("theme", "light") as string));
  ipcMain.handle("theme:set", (_e, theme: string) => {
    store.set("theme", theme);
    return { success: true };
  });

  ipcMain.handle("config:export", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win ?? undefined as never, { defaultPath: "al-server-config.json" });
    if (res.canceled || !res.filePath) return { success: false, message: "cancelled" };
    fs.writeFileSync(res.filePath, JSON.stringify(services.exportConfig(), null, 2), "utf8");
    return { success: true, message: res.filePath };
  });

  ipcMain.handle("config:import", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win ?? undefined as never, { filters: [{ name: "JSON", extensions: ["json"] }], properties: ["openFile"] });
    if (res.canceled || res.filePaths.length === 0) return { success: false, message: "cancelled" };
    try {
      const data = JSON.parse(fs.readFileSync(res.filePaths[0], "utf8"));
      return services.importConfig(data);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });
}
