import { app, BrowserWindow, dialog } from "electron";
import * as net from "net";
import * as path from "path";
import log from "electron-log";
import { ServiceManager } from "./services/ServiceManager";
import { PhpVersionManager } from "./services/PhpVersionManager";
import { VhostManager } from "./services/VhostManager";
import { UpdaterService } from "./services/UpdaterService";
import { registerHandlers } from "./ipc/handlers";

let win: BrowserWindow | null = null;
let manager: ServiceManager | null = null;
let updaterSvc: UpdaterService | null = null;

function waitForPort(port: number, host: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = new net.Socket();
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`dev server ${host}:${port} not reachable`));
        else setTimeout(attempt, 200);
      });
      sock.connect(port, host);
    };
    attempt();
  });
}

async function createStore(userData: string) {
  const { default: Store } = await import("electron-store");
  return new Store({ cwd: userData, name: "config" }) as unknown as { get(k: string, f?: unknown): unknown; set(k: string, v: unknown): void };
}

async function createWindow(): Promise<void> {
  const userData = app.getPath("userData");
  const store = await createStore(userData);
  const dev = process.env.AL_SERVER_DEV === "1";
  const devRoot = dev ? path.resolve(__dirname, "..", "..") : undefined;

  manager = new ServiceManager(store, { resourcesPath: process.resourcesPath, userData, devRoot });
  const phpRoot = dev ? path.join(devRoot as string, "resources", "binaries", "php") : path.join(process.resourcesPath, "binaries", "php");
  const php = new PhpVersionManager(store, phpRoot);
  const vhosts = new VhostManager(store, userData);
  const updater = new UpdaterService();
  updaterSvc = updater;
  registerHandlers({ services: manager, php, vhosts, updater, store });

  win = new BrowserWindow({
    width: 1180,
    height: 780,
    title: "Al Server",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (dev) {
    await waitForPort(5173, "127.0.0.1");
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  win.on("closed", () => { win = null; });
}

app.whenReady().then(createWindow).then(async () => {
  if (process.env.AL_SERVER_DEV === "1") return;
  try {
    const probe = await updaterSvc?.probe();
    if (probe?.available && win) {
      const res = await dialog.showMessageBox(win, {
        type: "info",
        title: "Update tersedia",
        message: `Al Server v${probe.version} tersedia. Download dan install sekarang?`,
        buttons: ["Download", "Nanti"]
      });
      if (res.response === 0) await updaterSvc?.downloadAndInstall();
    }
  } catch (err) {
    log.warn("update probe failed:", err);
  }
}).catch((err) => {
  log.error("failed to start:", err);
  app.quit();
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  try { await manager?.stopAll(); } catch (err) { log.warn("stopAll failed:", err); }
});
