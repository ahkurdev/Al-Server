import { spawn, spawnSync, execFileSync, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import kill from "tree-kill";
import log from "electron-log";
import type { ActionResult, ServiceConfig, ServiceName, ServiceStatus } from "../../shared/types";
import { DEFAULT_SERVICES, binariesRoot, resolveBinary } from "./BinaryRegistry";
import { checkSystemPort, findConflict, isReservedPort, isValidPort } from "./PortAllocator";
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

const slash = (p: string): string => p.replace(/\\/g, "/");

function toLongPath(p: string): string {
  if (process.platform !== "win32" || !p.includes("~")) return p;
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-Item -LiteralPath ${JSON.stringify(p)}).FullName`], { encoding: "utf8", timeout: 15000 }).trim();
    if (out && !out.includes("~")) return out;
  } catch { /* fall through */ }
  return p;
}

function replaceLine(content: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(content)) return content.replace(pattern, replacement);
  return content.trimEnd() + "\n" + replacement + "\n";
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
    try {
      fs.mkdirSync(paths.userData, { recursive: true });
      this.userData = toLongPath(fs.realpathSync(paths.userData));
    } catch {
      this.userData = toLongPath(paths.userData);
    }
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

  private binaryFor(svc: ServiceConfig): string {
    if (svc.name === "php-fpm") {
      let active = (this.store.get("activePhp", "") as string) || "";
      if (!active) {
        try {
          const dirs = fs.readdirSync(path.join(this.root, "php"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
          active = dirs[dirs.length - 1] ?? "";
          if (active) this.store.set("activePhp", active);
        } catch { /* keep empty */ }
      }
      if (active) {
        const versioned = path.join(this.root, "php", active, process.platform === "win32" ? "php-cgi.exe" : "php-cgi");
        if (fs.existsSync(versioned)) return versioned;
      }
    }
    return resolveBinary(this.root, svc);
  }

  private runInit(name: ServiceName, binary: string, args: string[]): ActionResult {
    try {
      const res = spawnSync(binary, args, { encoding: "utf8", timeout: 300000 });
      if (res.stdout) this.appendLog(name, String(res.stdout));
      if (res.stderr) this.appendLog(name, String(res.stderr));
      if (res.error) this.appendLog(name, `init spawn error: ${String(res.error?.message ?? res.error)}\n`);
      if (res.status !== 0) return { success: false, message: `init ${name} failed with code ${res.status}${res.error ? `: ${String(res.error?.message ?? res.error)}` : ""}` };
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private isInitialized(name: ServiceName): boolean {
    const dd = this.dataDir(name);
    if (name === "mysql") return fs.existsSync(path.join(dd, "mysql.ib")) || fs.existsSync(path.join(dd, "mysql"));
    if (name === "mariadb") return fs.existsSync(path.join(dd, "mysql"));
    if (name === "postgresql") return fs.existsSync(path.join(dd, "PG_VERSION"));
    return true;
  }

  private ensureDataReady(svc: ServiceConfig): ActionResult {
    const dd = this.dataDir(svc.name);
    fs.mkdirSync(dd, { recursive: true });
    const binDir = path.dirname(this.binaryFor(svc));

    if (svc.name === "mysql" || svc.name === "mariadb") {
      if (!this.isInitialized(svc.name)) {
        const serverBin = path.join(binDir, process.platform === "win32" ? (svc.name === "mysql" ? "mysqld.exe" : "mariadbd.exe") : "mysqld");
        this.appendLog(svc.name, `initializing data dir ${dd}\n`);
        if (svc.name === "mysql") {
          const r = this.runInit(svc.name, serverBin, ["--initialize-insecure", `--datadir=${dd}`]);
          if (!r.success) return r;
        } else {
          const installer = path.join(binDir, process.platform === "win32" ? "mysql_install_db.exe" : "mariadb-install-db");
          const r = fs.existsSync(installer)
            ? this.runInit(svc.name, installer, [`--datadir=${dd}`])
            : this.runInit(svc.name, serverBin, ["--initialize-insecure", `--datadir=${dd}`]);
          if (!r.success) return r;
        }
        this.appendLog(svc.name, "data dir initialized (root has no password, local dev only)\n");
      }
    }

    if (svc.name === "postgresql") {
      if (!this.isInitialized(svc.name)) {
        const initdb = path.join(binDir, process.platform === "win32" ? "initdb.exe" : "initdb");
        if (!fs.existsSync(initdb)) return { success: false, message: "initdb.exe not found in bundle" };
        this.appendLog(svc.name, `running initdb at ${dd}\n`);
        const r = this.runInit(svc.name, initdb, ["-D", dd, "-E", "UTF8", "-U", "postgres", "--auth=trust"]);
        if (!r.success) return r;
      }
    }

    if (svc.name === "apache") {
      const htdocs = path.join(dd, "htdocs");
      if (!fs.existsSync(htdocs)) {
        const shipped = path.join(this.root, "apache", "htdocs");
        fs.mkdirSync(path.join(dd, "logs"), { recursive: true });
        if (fs.existsSync(shipped)) fs.cpSync(shipped, htdocs, { recursive: true });
        else {
          fs.mkdirSync(htdocs, { recursive: true });
          fs.writeFileSync(path.join(htdocs, "index.html"), "<h1>Al Server running</h1>", "utf8");
        }
      }
    }

    return { success: true };
  }

  private renderConfig(svc: ServiceConfig): string {
    const dd = slash(this.dataDir(svc.name));

    if (svc.name === "apache") {
      const template = readTextIfExists(path.join(this.root, "apache", "conf", "httpd.conf"));
      let out = template;
      out = replaceLine(out, /^ServerRoot.*/m, `ServerRoot "${slash(path.join(this.root, "apache"))}"`);
      out = replaceLine(out, /^Listen.*/m, `Listen ${svc.port}`);
      out = replaceLine(out, /^DocumentRoot.*/m, `DocumentRoot "${dd}/htdocs"`);
      out = replaceLine(out, /^ErrorLog.*/m, `ErrorLog "${dd}/logs/error.log"`);
      out = out.replace(/CustomLog\s+"logs\/access\.log"/, `CustomLog "${dd}/logs/access.log"`);
      out = replaceLine(out, /^PidFile.*/m, `PidFile "${dd}/logs/httpd.pid"`);
      out = out.replace(/<Directory "\$\{SRVROOT\}\/htdocs">/, `<Directory "${dd}/htdocs">`);
      if (!out.includes("vhosts/*.conf")) out += `\nIncludeOptional "${dd}/vhosts/*.conf"\n`;
      const target = path.join(this.dataDir(svc.name), "httpd.conf");
      fs.mkdirSync(path.join(this.dataDir(svc.name), "logs"), { recursive: true });
      fs.mkdirSync(path.join(this.dataDir(svc.name), "vhosts"), { recursive: true });
      writeTextFile(target, out);
      return target;
    }

    if (svc.name === "nginx") {
      const confDir = path.join(this.dataDir(svc.name), "conf");
      fs.mkdirSync(path.join(this.dataDir(svc.name), "logs"), { recursive: true });
      for (const sub of ["client_body_temp", "proxy_temp", "fastcgi_temp", "uwsgi_temp", "scgi_temp"]) {
        fs.mkdirSync(path.join(this.dataDir(svc.name), "temp", sub), { recursive: true });
      }
      const shipped = path.join(this.root, "nginx", "conf");
      if (fs.existsSync(shipped)) {
        fs.mkdirSync(confDir, { recursive: true });
        for (const f of fs.readdirSync(shipped)) {
          const dest = path.join(confDir, f);
          if (!fs.existsSync(dest)) fs.copyFileSync(path.join(shipped, f), dest);
        }
      }
      const confFile = path.join(confDir, "nginx.conf");
      const text = readTextIfExists(confFile);
      if (text) writeTextFile(confFile, text.replace(/listen\s+\d+/g, `listen ${svc.port}`));
      return confFile;
    }

    if (svc.name === "php-fpm") {
      const iniTarget = path.join(this.dataDir(svc.name), "php.ini");
      if (!fs.existsSync(iniTarget)) {
        const active = (this.store.get("activePhp", "") as string) || "";
        const src = path.join(path.dirname(this.binaryFor(svc)), "php.ini-development");
        const fallback = active ? path.join(this.root, "php", active, "php.ini-development") : "";
        if (fs.existsSync(src)) fs.copyFileSync(src, iniTarget);
        else if (fallback && fs.existsSync(fallback)) fs.copyFileSync(fallback, iniTarget);
      }
      return iniTarget;
    }

    if (svc.name === "mysql" || svc.name === "mariadb") {
      const template = readTextIfExists(path.join(this.root, svc.name, "my.ini.template"));
      const baseDir = slash(path.join(this.root, svc.name));
      const out = template.split("__PORT__").join(String(svc.port)).split("__BASE_DIR__").join(baseDir).split("__DATA_DIR__").join(dd);
      const target = path.join(this.dataDir(svc.name), "my.ini");
      writeTextFile(target, out);
      return target;
    }

    if (svc.name === "postgresql") {
      const confFile = path.join(this.dataDir(svc.name), "postgresql.conf");
      const text = readTextIfExists(confFile);
      if (text) writeTextFile(confFile, applyPortToConfigText("postgresql", text, svc.port));
      return confFile;
    }

    return "";
  }

  private startArgs(svc: ServiceConfig, rendered: string): string[] {
    const dd = this.dataDir(svc.name);
    switch (svc.name) {
      case "apache":
        return ["-f", rendered, "-d", path.join(this.root, "apache")];
      case "nginx":
        return ["-p", slash(dd) + "/", "-c", slash(rendered)];
      case "php-fpm":
        return ["-b", `127.0.0.1:${svc.port}`, "-c", rendered];
      case "mysql":
      case "mariadb":
        return [`--defaults-file=${rendered}`];
      case "postgresql":
        return ["-D", dd];
      default:
        return [...svc.args];
    }
  }

  async start(name: ServiceName): Promise<ActionResult> {
    const svc = this.get(name);
    if (!svc) return { success: false, message: `Unknown service ${name}` };
    if (this.procs.has(name)) return { success: true, message: `${svc.label} already running` };
    this.errors.delete(name);
    this.mocks.delete(name);

    const binary = this.binaryFor(svc);
    if (!fs.existsSync(binary)) {
      const child = spawn(process.execPath, ["-e", "setInterval(()=>{}, 10000);"], { stdio: "ignore", detached: false });
      child.on("error", (err) => this.errors.set(name, String(err?.message ?? err)));
      this.procs.set(name, child);
      this.mocks.add(name);
      this.appendLog(name, `[mock] ${svc.label} started on port ${svc.port} (binary not bundled yet)\n`);
      return { success: true, message: `${svc.label} started in mock mode on port ${svc.port}` };
    }

    const ready = this.ensureDataReady(svc);
    if (!ready.success) {
      this.errors.set(name, ready.message ?? "init failed");
      return ready;
    }
    const rendered = this.renderConfig(svc);
    const args = this.startArgs(svc, rendered);

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
    if (isReservedPort(port)) return { success: false, message: `Port ${port} is reserved by the system, pick another` };
    const clash = findConflict(this.services, name, port);
    if (clash) return { success: false, message: clash };
    if (await checkSystemPort(port)) {
      const inUseBySelf = svc.port === port && this.procs.has(name);
      if (!inUseBySelf) return { success: false, message: `Port ${port} is already in use by the system` };
    }
    svc.port = port;
    this.persist();
    if (this.procs.has(name)) {
      await this.restart(name);
    } else if (fs.existsSync(this.binaryFor(svc)) && this.isInitialized(name)) {
      this.renderConfig(svc);
    }
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
