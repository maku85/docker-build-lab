/**
 * Plain-text terminal report. No colours, no dependencies - just aligned columns.
 */
import type { EnvSnapshot } from "./env.js";

export function heading(text: string): string {
  return `\n=== ${text} ===`;
}

export function table(headers: string[], rows: (string | number)[][]): string {
  const cells = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...cells.map((row) => (row[c] ?? "").length)));
  const fmt = (row: string[]): string =>
    row.map((v, c) => v.padEnd(widths[c] ?? 0)).join("  ").trimEnd();
  return [
    fmt(cells[0] as string[]),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...cells.slice(1).map((r) => fmt(r as string[])),
  ].join("\n");
}

export function envBlock(env: EnvSnapshot): string {
  return [
    "Environment",
    `  Docker            ${env.dockerVersion}`,
    `  buildx            ${env.buildxVersion} (${env.buildkitDriver})`,
    `  Node              ${env.node}`,
    `  Platform          ${env.platform}/${env.arch}`,
    `  CPU               ${env.cpuModel} (${env.cpuCount} threads)`,
  ].join("\n");
}
