import * as net from "net";
import type { ServiceConfig } from "../../shared/types";

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function findConflict(services: ServiceConfig[], name: string, port: number): string | null {
  const clash = services.find((s) => s.name !== name && s.port === port);
  return clash ? `Port ${port} already used by ${clash.label}` : null;
}

export function checkSystemPort(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (inUse: boolean) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* noop */ }
      resolve(inUse);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, "127.0.0.1");
  });
}
