import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { ServiceManager } = await import(pathToFileURL(path.join(root, "dist/main/services/ServiceManager.js")).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alma-"));
const mem = new Map();
const store = { get: (k, f) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => { mem.set(k, v); } };
const mgr = new ServiceManager(store, { resourcesPath: "", userData: tmp, devRoot: root });

const r = await mgr.start("mariadb");
console.log("start:", r.success, r.message);
await new Promise((r2) => setTimeout(r2, 10000));
const st = mgr.list().find((s) => s.name === "mariadb");
console.log("state:", st.state, "pid:", st.pid, "mock:", st.mock, "err:", st.lastError);
await new Promise((resolve) => {
  const sock = new net.Socket();
  sock.once("connect", () => { console.log("MARIADB 3307 ACCEPTS CONNECTIONS"); sock.destroy(); resolve(); });
  sock.once("error", (e) => { console.log("CONNECT FAIL:", e.message); resolve(); });
  sock.connect(3307, "127.0.0.1");
});
if (st.state !== "running") console.log("--- log tail ---\n" + mgr.readLogTail("mariadb").slice(-1500));
await mgr.stop("mariadb");
console.log("after stop:", mgr.list().find((s) => s.name === "mariadb").state);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
