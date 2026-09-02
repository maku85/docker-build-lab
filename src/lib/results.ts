/**
 * Persists experiment output under results/<experiment>/<timestamp>/.
 * The raw `docker build --progress=plain` output and the generated build
 * context are written verbatim so a run can be re-read later.
 */
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { scrub } from "./scrub.js";

const RESULTS_ROOT = new URL("../../results/", import.meta.url).pathname;

export interface RunPaths {
  dir: string;
  file: (name: string) => string;
  copyDir: (from: string, toRelative: string) => void;
}

/** Filesystem-safe ISO timestamp, e.g. 2026-09-02T21-04-59-123Z. */
export function runStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function createRunDir(experiment: string, stamp = runStamp()): RunPaths {
  const dir = join(RESULTS_ROOT, experiment, stamp);
  mkdirSync(dir, { recursive: true });
  return {
    dir,
    file: (name: string) => join(dir, name),
    copyDir: (from: string, toRelative: string) => {
      const to = join(dir, toRelative);
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to, { recursive: true });
    },
  };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${scrub(JSON.stringify(value, null, 2))}\n`, "utf8");
}

export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = scrub(text);
  writeFileSync(path, body.endsWith("\n") ? body : `${body}\n`, "utf8");
}
