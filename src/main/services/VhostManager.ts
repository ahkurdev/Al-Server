import * as fs from "fs";
import * as path from "path";
import type { ActionResult, VhostEntry } from "../../shared/types";

interface StoreLike {
  get(key: string, fallback?: unknown): unknown;
  set(key: string, value: unknown): void;
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class VhostManager {
  constructor(private store: StoreLike, private userData: string) {}

  list(): VhostEntry[] {
    return (this.store.get("vhosts", []) as VhostEntry[]) || [];
  }

  private hostsPath(): string {
    if (process.platform === "win32") return "C:\\Windows\\System32\\drivers\\etc\\hosts";
    return "/etc/hosts";
  }

  syncHostsEntry(host: string, present: boolean): ActionResult {
    const file = this.hostsPath();
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (err) {
      return { success: false, message: `cannot read hosts file: ${err instanceof Error ? err.message : String(err)}` };
    }
    const line = `127.0.0.1 ${host} # al-server`;
    const has = text.split("\n").some((l) => l.trim() === line || new RegExp(`^127\\.0\\.0\\.1\\s+${esc(host)}(\\s|$)`).test(l.trim()));
    if (present && has) return { success: true, message: "hosts entry already present" };
    if (!present && !has) return { success: true, message: "hosts entry already absent" };
    let next: string;
    if (present) {
      next = text.trimEnd() + "\n" + line + "\n";
    } else {
      next = text.split("\n").filter((l) => !new RegExp(`^127\\.0\\.0\\.1\\s+${esc(host)}(\\s|$)`).test(l.trim()) && l.trim() !== line).join("\n") + "\n";
    }
    try {
      fs.writeFileSync(file, next, "utf8");
      return { success: true, message: present ? `hosts entry added for ${host}` : `hosts entry removed for ${host}` };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code ?? "";
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `hosts write failed (run Al Server as admin once): ${code} ${msg}`.trim() };
    }
  }

  add(entry: VhostEntry): ActionResult {
    if (!entry.host || !entry.root) return { success: false, message: "host and root required" };
    const list = this.list();
    if (list.some((v) => v.host === entry.host)) return { success: false, message: `${entry.host} already exists` };
    list.push(entry);
    this.store.set("vhosts", list);
    const write = this.renderVhostFile(entry.server, list.filter((v) => v.server === entry.server));
    const hosts = this.syncHostsEntry(entry.host, true);
    const extra = hosts.success ? hosts.message : `WARNING: ${hosts.message}`;
    return { success: true, message: `vhost ${entry.host} added. Config: ${write}. ${extra}` };
  }

  remove(host: string): ActionResult {
    const list = this.list().filter((v) => v.host !== host);
    this.store.set("vhosts", list);
    for (const server of ["apache", "nginx"] as const) {
      this.renderVhostFile(server, list.filter((v) => v.server === server));
    }
    const hosts = this.syncHostsEntry(host, false);
    const extra = hosts.success ? hosts.message : `WARNING: ${hosts.message}`;
    return { success: true, message: `${host} removed. ${extra}` };
  }

  renderVhostFile(server: "apache" | "nginx", entries: VhostEntry[]): string {
    const dir = path.join(this.userData, "data", server, "vhosts");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, server === "apache" ? "vhosts.conf" : "vhosts.conf");
    const body = entries.map((e) => {
      if (server === "apache") {
        return `<VirtualHost *:${e.port}>\n    ServerName ${e.host}\n    DocumentRoot "${e.root}"\n    <Directory "${e.root}">\n        AllowOverride All\n        Require all granted\n    </Directory>\n</VirtualHost>\n`;
      }
      return `server {\n    listen ${e.port};\n    server_name ${e.host};\n    root ${e.root};\n    index index.php index.html;\n}\n`;
    }).join("\n");
    try {
      fs.writeFileSync(file, body, "utf8");
    } catch (err) {
      return `write failed (run as admin?): ${err instanceof Error ? err.message : String(err)}`;
    }
    return file;
  }
}
