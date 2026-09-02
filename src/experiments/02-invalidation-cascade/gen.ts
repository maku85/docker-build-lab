/**
 * Context generator for experiment 02.
 *
 * A Dockerfile with `n` sequential `RUN` steps. Each step writes a marker file.
 * `changeAt` (1-indexed, 0 = none) picks one step whose command text is altered
 * with a run-unique token, so that step's cache key changes.
 *
 * Because every `RUN`'s key includes its parent's result digest, changing step
 * k should force k and every step after it to rebuild, regardless of the later
 * steps' commands being identical.
 */
import { BASE_IMAGE } from "./config.js";

export function dockerfile(n: number, changeAt: number, runId: string): string {
  // Every command is scoped to (runId, n) so the n=4 / n=8 / n=16 chains never
  // share a cache entry: identical step commands off the same base would
  // otherwise let a short chain prime a longer one.
  const lines = [`FROM ${BASE_IMAGE}`, `WORKDIR /w-${runId}-${n}`];
  for (let i = 1; i <= n; i += 1) {
    const suffix = i === changeAt ? " changed" : "";
    lines.push(`RUN echo "${runId} n${n} step ${i}${suffix}" > ./s${i}`);
  }
  lines.push('CMD ["true"]');
  return `${lines.join("\n")}\n`;
}

export function contextFiles(n: number, changeAt: number, runId: string): Record<string, string> {
  return { Dockerfile: dockerfile(n, changeAt, runId) };
}
