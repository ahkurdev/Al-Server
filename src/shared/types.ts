export type ServiceName = "apache" | "nginx" | "php-fpm" | "mysql" | "mariadb" | "postgresql";
export type ServiceState = "running" | "stopped" | "error";
export type ServiceKind = "web" | "php" | "database";

export interface ServiceConfig {
  name: ServiceName;
  label: string;
  kind: ServiceKind;
  port: number;
  enabled: boolean;
  binaryRelPath: string;
  args: string[];
  configRelPath: string;
  dataDirName: string;
}

export interface ServiceStatus extends ServiceConfig {
  state: ServiceState;
  pid?: number;
  mock: boolean;
  lastError?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
}

export interface PortApplyRequest {
  name: ServiceName;
  port: number;
}

export interface PhpVersion {
  version: string;
  path: string;
  active: boolean;
}

export interface VhostEntry {
  host: string;
  root: string;
  server: "apache" | "nginx";
  port: number;
}

export interface AppSnapshot {
  services: ServiceStatus[];
  theme: "light" | "dark";
  phpVersions: PhpVersion[];
  activePhp: string;
  vhosts: VhostEntry[];
}
