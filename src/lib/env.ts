/**
 * Toolchain + host snapshot, written into every run's baseline.json.
 * Numbers in results/ are only comparable within the same snapshot.
 */
import { execFileSync } from "node:child_process";
import os from "node:os";

export interface EnvSnapshot {
  dockerVersion: string;
  buildxVersion: string;
  buildkitDriver: string;
  node: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  totalMemGB: number;
  capturedAt: string;
}

function tryExec(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function buildkitDriver(): string {
  const out = tryExec("docker", ["buildx", "inspect"]);
  return /^Driver:\s*(\S+)/m.exec(out)?.[1] ?? "unknown";
}

export function snapshotEnv(): EnvSnapshot {
  const cpus = os.cpus();
  return {
    dockerVersion: tryExec("docker", ["version", "--format", "{{.Server.Version}}"]),
    buildxVersion: tryExec("docker", ["buildx", "version"]).split(/\s+/)[1] ?? "unknown",
    buildkitDriver: buildkitDriver(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpus[0]?.model.trim() ?? "unknown",
    cpuCount: cpus.length,
    totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    capturedAt: new Date().toISOString(),
  };
}
