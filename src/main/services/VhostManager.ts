import * as fs from "fs";
import * as path from "path";
import type { ActionResult, VhostEntry } from "../../shared/types";

interface StoreLike {
  get(key: string, fallback?: unknown): unknown;
  set(key: string, value: unknown): void;
}

export class VhostManager {
  constructor(private store: StoreLike, private userData: string) {}

  list(): VhostEntry[] {
    return (this.store.get("vhosts", []) as VhostEntry[]) || [];
  }

  add(entry: VhostEntry): ActionResult {
    if (!entry.host || !entry.root) return { success: false, message: "host and root required" };
    const list = this.list();
    if (list.some((v) => v.host === entry.host)) return { success: false, message: `${entry.host} already exists` };
    list.push(entry);
    this.store.set("vhosts", list);
    const write = this.renderVhostFile(entry.server, list.filter((v) => v.server === entry.server));
    return { success: true, message: `vhost ${entry.host} added. Config: ${write}` };
  }

  remove(host: string): ActionResult {
    const list = this.list().filter((v) => v.host !== host);
    this.store.set("vhosts", list);
    return { success: true, message: `${host} removed` };
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
