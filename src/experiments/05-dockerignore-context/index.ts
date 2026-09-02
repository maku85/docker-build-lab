/**
 * Experiment 05 - .dockerignore and the build context
 *
 *   npm run exp:05
 *
 * Question: how much does a `.dockerignore` change (1) the context transfer size
 * and (2) whether touching a file inside the ignorable tree busts `COPY . .`?
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
import { contextFiles, logFile } from "./gen.js";

interface VariantResult {
  variant: string;
  contextBytes: number | null;
  imageBytes: number;
  copyCachedAfterIgnorableChange: boolean;
}

const copyStep = (run: BuildRun) => run.buildSteps.find((s) => /^COPY /.test(s.name));

function main(): void {
  const env = snapshotEnv();
  const run = createRunDir(EXPERIMENT);
  console.log(envBlock(env));
  console.log(`\nrun dir: ${run.dir}`);

  const runId = Date.now().toString(36);
  const results: VariantResult[] = [];

  for (const variant of VARIANTS) {
    const tag = tagFor(variant);
    console.log(heading(`${variant}: cold build -> touch logs/app.log -> rebuild`));
    removeImage(tag);

    const ctx = writeContext({
      experiment: EXPERIMENT,
      label: variant,
      files: contextFiles(variant, `${runId}-v1`),
    });

    const cold = runBuild(ctx, { tag, noCache: true });
    console.log(
      `  cold: exit=${cold.exitCode} context=${cold.contextBytes != null ? humanBytes(cold.contextBytes) : "?"}`,
    );

    // Touch a file inside the ignorable tree.
    patchContext(ctx, "logs/app.log", logFile(`${runId}-v2`));
    const warm = runBuild(ctx, { tag });
    const copyCached = copyStep(warm)?.cached ?? false;
    console.log(`  warm: COPY . . ${copyCached ? "CACHED" : "re-run"}`);

    const info = imageInfo(tag);
    // Copy only the meaningful files, not the multi-MB padding.
    for (const f of ["Dockerfile", ".dockerignore", "app.txt"]) {
      if (ctx.files[f]) writeText(run.file(`context/${variant}/${f}`), ctx.files[f]);
    }
    writeText(
      run.file(`context/${variant}/_ignorable-tree.txt`),
      `node_modules/pkg/bundle.js  ~2 MB\nlogs/app.log  ~3 MB\n(padding, not committed)\n`,
    );
    writeText(run.file(`build-log/${variant}.cold.txt`), cold.output);
    writeText(run.file(`build-log/${variant}.warm.txt`), warm.output);

    results.push({
      variant,
      contextBytes: cold.contextBytes,
      imageBytes: info?.totalBytes ?? 0,
      copyCachedAfterIgnorableChange: copyCached,
    });
  }

  // ---------------------------------------------------------------- report
  const rows = results.map((r) => [
    r.variant,
    r.contextBytes != null ? humanBytes(r.contextBytes) : "?",
    humanBytes(r.imageBytes),
    r.copyCachedAfterIgnorableChange ? "CACHED" : "re-run",
  ]);

  const report = [
    `Experiment ${EXPERIMENT}`,
    "",
    envBlock(env),
    "",
    "node_modules (2 MB) + logs (3 MB) alongside a tiny real file",
    "",
    table(
      ["variant", "context transfer", "image size", "COPY after ignorable change"],
      rows,
    ),
    "",
    "Expect: `.dockerignore` cuts the context to a few kB and keeps `COPY . .`",
    "cached when only an ignored file changed; without it, both get worse.",
  ].join("\n");

  console.log(`\n${report}`);
  writeText(run.file("comparison.txt"), report);
  writeJson(run.file("baseline.json"), { experiment: EXPERIMENT, env, variants: VARIANTS });
  writeJson(run.file("summary.json"), {
    experiment: EXPERIMENT,
    runAt: new Date().toISOString(),
    env,
    results,
  });

  console.log(`\nFull output under:\n  ${run.dir}`);
  clearContexts(EXPERIMENT);
  for (const variant of VARIANTS) removeImage(tagFor(variant));
}

main();
