import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bin = (...p) => path.join(root, "resources", "binaries", ...p);
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);

console.log("php:", execFileSync(bin("php", "8.5", "php-cgi.exe"), ["-v"]).toString().split("\n")[0]);
console.log("httpd:", execFileSync(bin("apache", "bin", "httpd.exe"), ["-v"]).toString().split("\n")[0].trim());
console.log("nginx:", execFileSync(bin("nginx", "nginx.exe"), ["-V"], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim() || "nginx binary runs (version on stderr)");
console.log("mysqld:", execFileSync(bin("mysql", "bin", "mysqld.exe"), ["--version"]).toString().trim());
console.log("mariadbd:", execFileSync(bin("mariadb", "bin", "mariadbd.exe"), ["--version"]).toString().trim().slice(0, 80));
console.log("postgres:", execFileSync(bin("postgresql", "bin", "postgres.exe"), ["--version"]).toString().trim());

const { ServiceManager } = await imp("dist/main/services/ServiceManager.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alreal-"));
const mem = new Map();
const store = { get: (k, f) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => { mem.set(k, v); } };
const mgr = new ServiceManager(store, { resourcesPath: "", userData: tmp, devRoot: root });

for (const name of ["postgresql", "mysql"]) {
  console.log(`--- ${name}: start`);
  const r = await mgr.start(name);
  console.log("start:", r.success, r.message);
  if (!r.success) { console.log("LOG:", mgr.readLogTail(name).slice(-2000)); process.exitCode = 1; break; }
  await new Promise((r2) => setTimeout(r2, 4000));
  const st = mgr.list().find((s) => s.name === name);
  console.log("state:", st.state, "pid:", st.pid, "mock:", st.mock);
  const rStop = await mgr.stop(name);
  console.log("stop:", rStop.success, rStop.message);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log("realbin: done");
