import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { ServiceManager } = await import(pathToFileURL(path.join(root, "dist/main/services/ServiceManager.js")).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alweb-"));
const mem = new Map();
const store = { get: (k, f) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => { mem.set(k, v); } };
const mgr = new ServiceManager(store, { resourcesPath: "", userData: tmp, devRoot: root });

function get(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/`, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve(`${res.statusCode} ${body.slice(0, 60).replace(/\s+/g, " ")}`));
    }).on("error", (e) => resolve("FAIL " + e.message));
  });
}

for (const [name, port] of [["apache", 8080], ["nginx", 8081], ["php-fpm", 9000]]) {
  const r = await mgr.start(name);
  console.log(name, "start:", r.success, r.message);
  await new Promise((r2) => setTimeout(r2, 5000));
  const st = mgr.list().find((s) => s.name === name);
  console.log(name, "state:", st.state, "pid:", st.pid, "mock:", st.mock, "err:", st.lastError);
  if (name !== "php-fpm") console.log(name, "http:", await get(port));
  else {
    const php = await import("node:net").then((m) => new Promise((resolve) => {
      const s = new m.Socket();
      s.once("connect", () => { resolve("FASTCGI PORT OPEN"); s.destroy(); });
      s.once("error", (e) => resolve("FAIL " + e.message));
      s.connect(port, "127.0.0.1");
    }));
    console.log("php-fpm:", php);
  }
  if (st.state !== "running") console.log("--- log tail ---\n" + mgr.readLogTail(name).slice(-1500));
  await mgr.stop(name);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log("realweb: done");
