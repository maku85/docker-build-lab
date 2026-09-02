/**
 * Daemon hygiene between measurements. A "cold" build needs the BuildKit cache
 * and any prior image gone; a "warm" rebuild needs them kept.
 */
import { execFileSync } from "node:child_process";

function run(args: string[]): void {
  try {
    execFileSync("docker", args, { stdio: "ignore" });
  } catch {
    // best effort
  }
}

/** Removes a tagged image (ignores "no such image"). */
export function removeImage(tag: string): void {
  run(["image", "rm", "-f", tag]);
}

/** Clears the entire BuildKit build cache. Use before a cold run. */
export function pruneBuildCache(): void {
  run(["builder", "prune", "-af"]);
}

/** Full reset: build cache + dangling images. */
export function resetDaemon(tags: string[] = []): void {
  for (const tag of tags) removeImage(tag);
  pruneBuildCache();
}
