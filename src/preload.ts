import { contextBridge, ipcRenderer } from "electron";
import type { ActionResult, AppSnapshot, PhpVersion, PortApplyRequest, ServiceName, ServiceStatus, VhostEntry } from "./shared/types";

const api = {
  listServices: (): Promise<ServiceStatus[]> => ipcRenderer.invoke("services:list"),
  start: (name: ServiceName): Promise<ActionResult> => ipcRenderer.invoke("services:start", name),
  stop: (name: ServiceName): Promise<ActionResult> => ipcRenderer.invoke("services:stop", name),
  restart: (name: ServiceName): Promise<ActionResult> => ipcRenderer.invoke("services:restart", name),
  setPort: (req: PortApplyRequest): Promise<ActionResult> => ipcRenderer.invoke("services:set-port", req),
  setEnabled: (name: ServiceName, enabled: boolean): Promise<ActionResult> => ipcRenderer.invoke("services:set-enabled", name, enabled),
  logTail: (name: ServiceName): Promise<string> => ipcRenderer.invoke("services:log-tail", name),
  logClear: (name: ServiceName): Promise<ActionResult> => ipcRenderer.invoke("services:log-clear", name),
  phpList: (): Promise<PhpVersion[]> => ipcRenderer.invoke("php:list"),
  phpSetActive: (v: string): Promise<ActionResult> => ipcRenderer.invoke("php:set-active", v),
  vhostsList: (): Promise<VhostEntry[]> => ipcRenderer.invoke("vhosts:list"),
  vhostsAdd: (e: VhostEntry): Promise<ActionResult> => ipcRenderer.invoke("vhosts:add", e),
  vhostsRemove: (host: string): Promise<ActionResult> => ipcRenderer.invoke("vhosts:remove", host),
  updaterCheck: (): Promise<ActionResult> => ipcRenderer.invoke("updater:check"),
  updaterInstall: (): Promise<ActionResult> => ipcRenderer.invoke("updater:install"),
  themeGet: (): Promise<string> => ipcRenderer.invoke("theme:get"),
  themeSet: (t: string): Promise<ActionResult> => ipcRenderer.invoke("theme:set", t),
  configExport: (): Promise<ActionResult> => ipcRenderer.invoke("config:export"),
  configImport: (): Promise<ActionResult> => ipcRenderer.invoke("config:import")
};

export type AlServerApi = typeof api;
export type SnapshotWire = AppSnapshot;

contextBridge.exposeInMainWorld("alServer", api);
