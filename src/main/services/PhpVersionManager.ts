import * as fs from "fs";
import * as path from "path";
import type { ActionResult, PhpVersion } from "../../shared/types";

export class PhpVersionManager {
  constructor(private store: { get(k: string, f?: unknown): unknown; set(k: string, v: unknown): void }, private phpRoot: string) {}

  scan(): PhpVersion[] {
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(this.phpRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      dirs = [];
    }
    const active = (this.store.get("activePhp", "") as string) || "";
    const versions: PhpVersion[] = dirs.map((v) => ({ version: v, path: path.join(this.phpRoot, v), active: v === active }));
    if (versions.length > 0 && !versions.some((v) => v.active)) versions[0].active = true;
    return versions;
  }

  setActive(version: string): ActionResult {
    const found = this.scan().find((v) => v.version === version);
    if (!found) return { success: false, message: `PHP ${version} not found` };
    this.store.set("activePhp", version);
    return { success: true, message: `PHP ${version} activated. Restart PHP-FPM to apply.` };
  }

  getActive(): string {
    return (this.store.get("activePhp", "") as string) || "";
  }
}
