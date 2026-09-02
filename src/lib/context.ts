/**
 * A build context is a generated directory: a `Dockerfile` plus whatever files
 * it copies. Contexts are produced from a fixed template per experiment; the
 * only thing that varies along an axis is the axis value, nothing random.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TMP_ROOT = new URL("../../.contexts-tmp/", import.meta.url).pathname;

export interface BuildContext {
  dir: string;
  label: string;
  files: Record<string, string>;
}

export interface ContextSpec {
  experiment: string;
  label: string;
  /** Relative path -> file contents. Must include "Dockerfile". */
  files: Record<string, string>;
}

export function writeContext(spec: ContextSpec): BuildContext {
  if (!spec.files["Dockerfile"]) {
    throw new Error(`context "${spec.label}" has no Dockerfile`);
  }
  const dir = join(TMP_ROOT, spec.experiment, spec.label);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(spec.files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
  }
  return { dir, label: spec.label, files: spec.files };
}

/** Overwrites one file in an existing context in place (to bust a cache). */
export function patchContext(ctx: BuildContext, name: string, contents: string): void {
  writeFileSync(
    join(ctx.dir, name),
    contents.endsWith("\n") ? contents : `${contents}\n`,
    "utf8",
  );
}

/** Removes the whole scratch area for one experiment. */
export function clearContexts(experiment: string): void {
  rmSync(join(TMP_ROOT, experiment), { recursive: true, force: true });
}
