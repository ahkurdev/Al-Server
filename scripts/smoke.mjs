import assert from "node:assert";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { ServiceManager } = await imp("dist/main/services/ServiceManager.js");
const ce = await imp("dist/main/services/ConfigEditor.js");
const pa = await imp("dist/main/services/PortAllocator.js");
const br = await imp("dist/main/services/BinaryRegistry.js");

assert.ok(typeof ServiceManager === "function", "ServiceManager exported");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alserver-"));
const mem = new Map();
const store = { get: (k, f) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => { mem.set(k, v); } };
const mgr = new ServiceManager(store, { resourcesPath: path.join(tmp, "res"), userData: path.join(tmp, "ud"), devRoot: tmp });

let list = mgr.list();
assert.equal(list.length, 6, "6 default services, got " + list.length);
assert.ok(list.every((s) => s.state === "stopped"));

const r1 = await mgr.start("mysql");
assert.ok(r1.success, "mock start mysql: " + r1.message);
assert.equal(mgr.list().find((s) => s.name === "mysql").state, "running");
assert.ok(mgr.list().find((s) => s.name === "mysql").mock, "mock flag set without binaries");

const rClash = await mgr.setPort("mariadb", 3306);
assert.ok(!rClash.success, "conflicting port must be rejected");

const rBad = await mgr.setPort("mysql", 99999);
assert.ok(!rBad.success, "invalid port must be rejected");

const rPort = await mgr.setPort("mysql", 3336);
assert.ok(rPort.success, "port change: " + rPort.message);
assert.equal(mgr.get("mysql").port, 3336);

const rStop = await mgr.stop("mysql");
assert.ok(rStop.success);
assert.equal(mgr.list().find((s) => s.name === "mysql").state, "stopped");

assert.equal(ce.applyPortToConfigText("apache", "Listen 8080\n", 9090).trim(), "Listen 9090");
assert.ok(ce.applyPortToConfigText("nginx", "listen 8081;\n", 9091).includes("listen 9091;"));
assert.ok(ce.applyPortToConfigText("mysql", "port=3306\n", 3336).includes("port=3336"));
assert.ok(ce.applyPortToConfigText("postgresql", "#port = 5432\n", 5544).includes("port = 5544"));

assert.ok(!pa.isValidPort(0) && pa.isValidPort(8080) && !pa.isValidPort(70000));
const clash = pa.findConflict(mgr.exportConfig().services, "apache", 3336);
assert.ok(clash && clash.includes("MySQL"), "conflict names MySQL, got: " + clash);

const scan = br.scanBinaries(path.join(tmp, "nobin"));
assert.equal(Object.keys(scan).length, 6);

const exp = mgr.exportConfig();
const rImp = mgr.importConfig(exp);
assert.ok(rImp.success);
assert.ok(!mgr.importConfig({ nope: 1 }).success);

try { await mgr.stopAll(); } catch {}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log("smoke: all assertions passed");
