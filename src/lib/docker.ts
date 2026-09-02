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
}

const STEP_HEAD = /^#(\d+)\s+(\[[^\]]*\][^\n]*)$/;
const STEP_INDEX = /^\[(\d+\/\d+)\]\s+(.*)$/;
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
          s.index = bracket[1] as string;
          s.name = (bracket[2] as string).trim();
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
  };
}
