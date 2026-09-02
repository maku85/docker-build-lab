/**
 * Runs `docker buildx build --progress=plain` against a generated context and
 * parses the BuildKit progress log into per-step records: whether the step was
 * a cache hit, and how long it ran.
 *
 * Never throws on a non-zero exit; a failing build is a valid measurement.
 */
import { spawnSync } from "node:child_process";

import type { BuildContext } from "./context.js";

export interface BuildStep {
  id: string;
  /** e.g. "2/5" for a `[2/5] RUN …` step; null for internal / export steps. */
  index: string | null;
  name: string;
  cached: boolean;
  durationS: number;
  error: boolean;
}

export interface BuildRun {
  label: string;
  exitCode: number;
  /** Combined stdout + stderr (BuildKit writes progress to stderr). */
  output: string;
  wallMs: number;
  steps: BuildStep[];
  /** Build steps only (name matches `[k/m] …`), in order. */
  buildSteps: BuildStep[];
  cachedCount: number;
  rebuiltCount: number;
  /** Bytes reported for `[internal] load build context`, or null. */
  contextBytes: number | null;
}

const SIZE_UNITS: Record<string, number> = {
  B: 1,
  kB: 1000,
  MB: 1000 ** 2,
  GB: 1000 ** 3,
  KB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
};

function parseHumanSize(text: string): number {
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim());
  return m ? Math.round(Number(m[1]) * (SIZE_UNITS[m[2] as string] ?? 1)) : 0;
}

// BuildKit labels both the `.dockerignore` load and the build-context load
// `transferring context:`. Pick the one under `[internal] load build context`.
const LOAD_CONTEXT_ID = /^#(\d+)\s+\[internal\] load build context$/m;
function contextTransferBytes(output: string): number | null {
  const idMatch = LOAD_CONTEXT_ID.exec(output);
  if (!idMatch) return null;
  const xfer = new RegExp(
    `^#${idMatch[1]}\\s+transferring context:\\s+([\\d.]+\\s*[A-Za-z]+)`,
    "m",
  ).exec(output);
  return xfer ? parseHumanSize(xfer[1] as string) : null;
}

const STEP_HEAD = /^#(\d+)\s+(\[[^\]]*\][^\n]*)$/;
// BuildKit right-pads the step number once the total reaches two digits
// (`[ 3/10]`) and prefixes a stage name in multi-stage / newer-frontend builds
// (`[stage-0 4/4]`, `[build 2/3]`). Tolerate both.
const STEP_INDEX = /^\[\s*(?:[\w.-]+\s+)?(\d+)\/(\d+)\s*\]\s+(.*)$/;
const STEP_DONE = /^#(\d+)\s+DONE\s+([\d.]+)s(?:\s+done)?$/;
const STEP_CACHED = /^#(\d+)\s+CACHED$/;
const STEP_ERROR = /^#(\d+)\s+ERROR/;

function parseSteps(output: string): BuildStep[] {
  const byId = new Map<string, BuildStep>();
  const ensure = (id: string): BuildStep => {
    let s = byId.get(id);
    if (!s) {
      s = { id, index: null, name: "", cached: false, durationS: 0, error: false };
      byId.set(id, s);
    }
    return s;
  };

  for (const line of output.split("\n")) {
    const head = STEP_HEAD.exec(line);
    if (head) {
      const s = ensure(head[1] as string);
      if (!s.name) {
        const text = (head[2] as string).trim();
        const bracket = STEP_INDEX.exec(text);
        if (bracket) {
          s.index = `${bracket[1]}/${bracket[2]}`;
          s.name = (bracket[3] as string).trim();
        } else {
          s.name = text;
        }
      }
      continue;
    }
    const done = STEP_DONE.exec(line);
    if (done) {
      ensure(done[1] as string).durationS = Number(done[2]);
      continue;
    }
    const cached = STEP_CACHED.exec(line);
    if (cached) {
      ensure(cached[1] as string).cached = true;
      continue;
    }
    const err = STEP_ERROR.exec(line);
    if (err) ensure(err[1] as string).error = true;
  }

  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export interface RunBuildOptions {
  tag: string;
  noCache?: boolean;
  /** `--build-arg KEY=VALUE` pairs. */
  buildArgs?: Record<string, string>;
  /** Extra flags, e.g. ["--cache-from", "type=local,src=..."]. */
  extraArgs?: string[];
}

export function runBuild(ctx: BuildContext, opts: RunBuildOptions): BuildRun {
  const args = [
    "buildx",
    "build",
    "--progress=plain",
    "--load",
    "-t",
    opts.tag,
    "-f",
    `${ctx.dir}/Dockerfile`,
    ...(opts.noCache ? ["--no-cache"] : []),
    ...Object.entries(opts.buildArgs ?? {}).flatMap(([k, v]) => [
      "--build-arg",
      `${k}=${v}`,
    ]),
    ...(opts.extraArgs ?? []),
    ctx.dir,
  ];
  const started = Date.now();
  const res = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const wallMs = Date.now() - started;
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const steps = parseSteps(output);
  const buildSteps = steps.filter((s) => s.index !== null);
  return {
    label: ctx.label,
    exitCode: res.status ?? -1,
    output,
    wallMs,
    steps,
    buildSteps,
    cachedCount: buildSteps.filter((s) => s.cached).length,
    rebuiltCount: buildSteps.filter((s) => !s.cached && !s.error).length,
    contextBytes: contextTransferBytes(output),
  };
}
