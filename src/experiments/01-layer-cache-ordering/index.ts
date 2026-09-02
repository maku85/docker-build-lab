/**
 * Experiment 01 - Layer cache ordering
 *
 *   npm run exp:01
 *
 * Question: after a source-file change (not package.json), does `npm install`
 * stay cached? `naive` (COPY . . before install) should re-run it; `ordered`
 * (COPY package.json, install, COPY . .) should keep it cached.
 *
 * Per variant: cold build (--no-cache) -> touch index.js -> warm rebuild.
 * The warm rebuild is the measurement.
 */
import { clearContexts, patchContext, writeContext } from "../../lib/context.js";
import { removeImage } from "../../lib/cleanup.js";
import { runBuild } from "../../lib/docker.js";
import type { BuildRun } from "../../lib/docker.js";
import { humanBytes, imageInfo } from "../../lib/image.js";
import { snapshotEnv } from "../../lib/env.js";
import { createRunDir, writeJson, writeText } from "../../lib/results.js";
import { envBlock, heading, table } from "../../lib/report.js";
import { EXPERIMENT, VARIANTS, tagFor } from "./config.js";
import type { Variant } from "./config.js";
import { contextFiles, indexJs } from "./gen.js";

interface VariantResult {
  variant: Variant;
  cold: BuildRun;
  warm: BuildRun;
  installCachedWarm: boolean;
  imageBytes: number;
}

function installStep(run: BuildRun): { cached: boolean; durationS: number } | null {
  const s = run.buildSteps.find((b) => /npm install/.test(b.name));
  return s ? { cached: s.cached, durationS: s.durationS } : null;
}

function main(): void {
  const env = snapshotEnv();
  const run = createRunDir(EXPERIMENT);
  console.log(envBlock(env));
  console.log(`\nrun dir: ${run.dir}`);

  const results: VariantResult[] = [];
  // The BuildKit cache is global and persistent. A fixed marker string can hit
  // a cache entry left by a previous run, so both the cold state and the
  // "changed" state get a run-unique token.
  const runId = Date.now().toString(36);

  for (const variant of VARIANTS) {
    const tag = tagFor(variant);
    console.log(heading(`${variant}: cold build (--no-cache) -> touch index.js -> warm rebuild`));
    // `--no-cache` on the cold build is enough to force every step; it still
    // populates cache for the warm rebuild to read. No global prune.
    removeImage(tag);

    const ctx = writeContext({
      experiment: EXPERIMENT,
      label: variant,
      files: contextFiles(variant, `${runId}-v1`),
    });

    const cold = runBuild(ctx, { tag, noCache: true });
    console.log(`  cold: exit=${cold.exitCode} rebuilt=${cold.rebuiltCount} wall=${(cold.wallMs / 1000).toFixed(1)}s`);

    patchContext(ctx, "index.js", indexJs(`${runId}-v2-changed`));
    const warm = runBuild(ctx, { tag });
    console.log(
      `  warm: exit=${warm.exitCode} cached=${warm.cachedCount} rebuilt=${warm.rebuiltCount} ` +
        `install=${installStep(warm)?.cached ? "CACHED" : "re-run"}`,
    );

    const info = imageInfo(tag);
    run.copyDir(ctx.dir, `context/${variant}`);
    writeText(run.file(`build-log/${variant}.cold.txt`), cold.output);
    writeText(run.file(`build-log/${variant}.warm.txt`), warm.output);

    results.push({
      variant,
      cold,
      warm,
      installCachedWarm: installStep(warm)?.cached ?? false,
      imageBytes: info?.totalBytes ?? 0,
    });
  }

  // ---------------------------------------------------------------- report
  const rows = results.map((r) => [
    r.variant,
    installStep(r.cold)?.durationS != null ? `${installStep(r.cold)?.durationS}s` : "?",
    r.installCachedWarm ? "CACHED" : "re-run",
    `${r.warm.cachedCount}/${r.warm.buildSteps.length}`,
    r.warm.rebuiltCount,
    humanBytes(r.imageBytes),
  ]);

  const report = [
    `Experiment ${EXPERIMENT}`,
    "",
    envBlock(env),
    "",
    "Rebuild after touching index.js (not package.json)",
    "",
    table(
      ["variant", "cold install", "warm install", "warm cached", "warm rebuilt", "image size"],
      rows,
    ),
    "",
    "Expect: `naive` re-runs npm install on the source change; `ordered` keeps it",
    "cached and only re-runs the final COPY.",
  ].join("\n");

  console.log(`\n${report}`);
  writeText(run.file("comparison.txt"), report);
  writeJson(run.file("baseline.json"), { experiment: EXPERIMENT, env, variants: VARIANTS });
  writeJson(run.file("summary.json"), {
    experiment: EXPERIMENT,
    runAt: new Date().toISOString(),
    env,
    results: results.map((r) => ({
      variant: r.variant,
      imageBytes: r.imageBytes,
      installCachedWarm: r.installCachedWarm,
      cold: { exitCode: r.cold.exitCode, wallMs: r.cold.wallMs, buildSteps: r.cold.buildSteps },
      warm: {
        exitCode: r.warm.exitCode,
        wallMs: r.warm.wallMs,
        cachedCount: r.warm.cachedCount,
        rebuiltCount: r.warm.rebuiltCount,
        buildSteps: r.warm.buildSteps,
      },
    })),
  });

  console.log(`\nFull output under:\n  ${run.dir}`);
  clearContexts(EXPERIMENT);
  for (const variant of VARIANTS) removeImage(tagFor(variant));
}

main();
