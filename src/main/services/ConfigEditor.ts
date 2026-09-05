import * as fs from "fs";

function replaceOrAppend(content: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(content)) return content.replace(pattern, replacement);
  return content.trimEnd() + "\n" + replacement + "\n";
}

export function updateApachePort(conf: string, port: number): string {
  return replaceOrAppend(conf, /^Listen\s+\d+.*/m, `Listen ${port}`);
}

export function updateNginxPort(conf: string, port: number): string {
  return conf.replace(/listen\s+\d+(\s+default_server)?\s*;/g, `listen ${port}$1;`);
}

export function updateMysqlPort(conf: string, port: number): string {
  return replaceOrAppend(conf, /^port\s*=\s*\d+.*/m, `port=${port}`);
}

export function updatePostgresPort(conf: string, port: number): string {
  if (/^#?\s*port\s*=\s*'?\d+'?/m.test(conf)) {
    return conf.replace(/^#?\s*port\s*=\s*'?\d+'?.*/m, `port = ${port}`);
  }
  return conf.trimEnd() + `\nport = ${port}\n`;
}

export function updatePhpFpmPort(args: string[], port: number): string[] {
  return args.map((a) => (/127\.0\.0\.1:\d+/.test(a) ? a.replace(/127\.0\.0\.1:\d+/, `127.0.0.1:${port}`) : a));
}

export function applyPortToConfigText(service: string, text: string, port: number): string {
  switch (service) {
    case "apache": return updateApachePort(text, port);
    case "nginx": return updateNginxPort(text, port);
    case "mysql":
    case "mariadb": return updateMysqlPort(text, port);
    case "postgresql": return updatePostgresPort(text, port);
    default: return text;
  }
}

export function readTextIfExists(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function writeTextFile(file: string, text: string): void {
  fs.mkdirSync(require("path").dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}
