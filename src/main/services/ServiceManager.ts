import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import kill from "tree-kill";
import log from "electron-log";
import type { ActionResult, ServiceConfig, ServiceName, ServiceStatus } from "../../shared/types";
import { DEFAULT_SERVICES, binariesRoot, resolveBinary } from "./BinaryRegistry";
import { checkSystemPort, findConflict, isValidPort } from "./PortAllocator";
import { applyPortToConfigText, readTextIfExists, writeTextFile } from "./ConfigEditor";

interface StoreLike {
  get(key: string, fallback?: unknown): unknown;
  set(key: string, value: unknown): void;
}

interface Paths {
  resourcesPath: string;
  userData: string;
  devRoot?: string;
}

export class ServiceManager {
  private procs = new Map<ServiceName, ChildProcess>();
  private mocks = new Set<ServiceName>();
  private errors = new Map<ServiceName, string>();
  private services: ServiceConfig[];
  private root: string;
  private userData: string;

  constructor(private store: StoreLike, paths: Paths) {
    this.root = binariesRoot(paths.resourcesPath, paths.devRoot);
    this.userData = paths.userData;
    const saved = this.store.get("services", null) as ServiceConfig[] | null;
    this.services = Array.isArray(saved) && saved.length > 0 ? saved : structuredClone(DEFAULT_SERVICES);
    this.persist();
  }

  private persist(): void {
    this.store.set("services", this.services);
  }

  list(): ServiceStatus[] {
    return this.services.map((s) => ({
      ...s,
      state: this.procs.has(s.name) ? "running" : this.errors.has(s.name) ? "error" : "stopped",
      pid: this.procs.get(s.name)?.pid,
      mock: this.mocks.has(s.name),
      lastError: this.errors.get(s.name)
    }));
  }

  get(name: ServiceName): ServiceConfig | undefined {
    return this.services.find((s) => s.name === name);
  }

  logFile(name: ServiceName): string {
    return path.join(this.userData, "logs", name, `${name}.log`);
  }

  dataDir(name: ServiceName): string {
    const svc = this.get(name);
    return path.join(this.userData, "data", svc?.dataDirName ?? name);
  }

  private appendLog(name: ServiceName, chunk: string): void {
    try {
      const file = this.logFile(name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, chunk);
    } catch (err) {
      log.warn(`log append failed for ${name}:`, err);
    }
  }

  private ensureDataDir(name: ServiceName): void {
    const dir = this.dataDir(name);
    fs.mkdirSync(dir, { recursive: true });
    if ((name === "mysql" || name === "mariadb" || name === "postgresql") && !fs.existsSync(path.join(dir, ".initialized"))) {
      fs.writeFileSync(path.join(dir, ".initialized"), new Date().toISOString(), "utf8");
      this.appendLog(name, `data dir initialized at ${dir}\n`);
    }
  }

  async start(name: ServiceName): Promise<ActionResult> {
    const svc = this.get(name);
    if (!svc) return { success: false, message: `Unknown service ${name}` };
    if (this.procs.has(name)) return { success: true, message: `${svc.label} already running` };
    this.errors.delete(name);
    this.mocks.delete(name);
    this.ensureDataDir(name);

    const binary = resolveBinary(this.root, svc);
    const hasBinary = fs.existsSync(binary);

    if (!hasBinary) {
      const child = spawn(process.execPath, ["-e", "setInterval(()=>{}, 10000);"], { stdio: "ignore", detached: false });
      child.on("error", (err) => this.errors.set(name, String(err?.message ?? err)));
      this.procs.set(name, child);
      this.mocks.add(name);
      this.appendLog(name, `[mock] ${svc.label} started on port ${svc.port} (binary not bundled yet)\n`);
      return { success: true, message: `${svc.label} started in mock mode on port ${svc.port}` };
    }

    const args = [...svc.args];
    if (svc.name === "php-fpm") {
      const idx = args.findIndex((a) => /127\.0\.0\.1:\d+/.test(a));
      if (idx >= 0) args[idx] = `127.0.0.1:${svc.port}`;
    }
    try {
      const child = spawn(binary, args, { cwd: path.dirname(binary), stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", (d) => this.appendLog(name, String(d)));
      child.stderr?.on("data", (d) => this.appendLog(name, String(d)));
      child.on("error", (err) => {
        this.errors.set(name, String(err?.message ?? err));
        this.procs.delete(name);
      });
      child.on("exit", (code) => {
        if (this.procs.get(name) === child) this.procs.delete(name);
        this.appendLog(name, `process exited with code ${code}\n`);
      });
      this.procs.set(name, child);
      this.appendLog(name, `${svc.label} started (pid ${child.pid}) on port ${svc.port}\n`);
      return { success: true, message: `${svc.label} started on port ${svc.port}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errors.set(name, message);
      return { success: false, message };
    }
  }

  async stop(name: ServiceName): Promise<ActionResult> {
    const svc = this.get(name);
    if (!svc) return { success: false, message: `Unknown service ${name}` };
    const child = this.procs.get(name);
    if (!child) return { success: true, message: `${svc.label} already stopped` };
    const pid = child.pid;
    this.procs.delete(name);
    this.mocks.delete(name);
    if (pid) {
      await new Promise<void>((resolve) => {
        try {
          kill(pid, "SIGTERM", () => resolve());
        } catch {
          resolve();
        }
        setTimeout(() => resolve(), 3000);
      });
    } else {
      try { child.kill(); } catch { /* noop */ }
    }
    this.appendLog(name, `${svc.label} stopped\n`);
    return { success: true, message: `${svc.label} stopped` };
  }

  async restart(name: ServiceName): Promise<ActionResult> {
    await this.stop(name);
    return this.start(name);
  }

  async setPort(name: ServiceName, port: number): Promise<ActionResult> {
    const svc = this.get(name);
    if (!svc) return { success: false, message: `Unknown service ${name}` };
    if (!isValidPort(port)) return { success: false, message: `Invalid port ${port}` };
    const clash = findConflict(this.services, name, port);
    if (clash) return { success: false, message: clash };
    if (await checkSystemPort(port)) {
      const inUseBySelf = svc.port === port && this.procs.has(name);
      if (!inUseBySelf) return { success: false, message: `Port ${port} is already in use by the system` };
    }
    svc.port = port;
    if (svc.name === "php-fpm") {
      const idx = svc.args.findIndex((a) => /127\.0\.0\.1:\d+/.test(a));
      if (idx >= 0) svc.args[idx] = `127.0.0.1:${port}`;
    } else {
      const template = path.join(this.root, svc.configRelPath);
      const text = readTextIfExists(template);
      if (text) {
        const target = path.join(this.dataDir(name), path.basename(svc.configRelPath));
        writeTextFile(target, applyPortToConfigText(name, text, port));
      }
    }
    this.persist();
    if (this.procs.has(name)) await this.restart(name);
    return { success: true, message: `${svc.label} port set to ${port}` };
  }

  async setEnabled(name: ServiceName, enabled: boolean): Promise<ActionResult> {
    const svc = this.get(name);
    if (!svc) return { success: false, message: `Unknown service ${name}` };
    svc.enabled = enabled;
    this.persist();
    return { success: true, message: `${svc.label} ${enabled ? "enabled" : "disabled"}` };
  }

  clearLog(name: ServiceName): ActionResult {
    try {
      fs.writeFileSync(this.logFile(name), "", "utf8");
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  readLogTail(name: ServiceName, maxChars = 20000): string {
    try {
      const content = fs.readFileSync(this.logFile(name), "utf8");
      return content.length > maxChars ? content.slice(-maxChars) : content;
    } catch {
      return "";
    }
  }

  exportConfig(): Record<string, unknown> {
    return { services: this.services, exportedAt: new Date().toISOString() };
  }

  importConfig(data: Record<string, unknown>): ActionResult {
    const list = (data as { services?: ServiceConfig[] }).services;
    if (!Array.isArray(list)) return { success: false, message: "Invalid config file" };
    this.services = list.filter((s) => typeof s?.name === "string" && isValidPort(s.port));
    if (this.services.length === 0) return { success: false, message: "No valid services in file" };
    this.persist();
    return { success: true, message: `Imported ${this.services.length} services` };
  }

  async stopAll(): Promise<void> {
    for (const s of this.services) {
      try { await this.stop(s.name); } catch { /* noop */ }
    }
  }
}
