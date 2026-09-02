/**
 * Experiment 03 - RUN --mount=type=cache
 *
 *   npm run exp:03
 *
 * Question: after the RUN layer is busted (ARG change, package.json untouched),
 * does the npm download cache survive? `plain` keeps its cache inside the layer,
 * so a busted layer loses it; `cachemount` keeps it in a persistent mount.
 *
 * Probe: cold build (online, populates) -> rebuild with `npm install --offline`.
 *   plain       --offline fails (empty cache in the fresh layer)
 *   cachemount  --offline succeeds (mount still full)
 * Image sizes should be equal (a cache mount is not a layer).
 */
import { clearContexts, writeContext } from "../../lib/context.js";
import { removeImage } from "../../lib/cleanup.js";
import { runBuild } from "../../lib/docker.js";
import { humanBytes, imageInfo } from "../../lib/image.js";
import { snapshotEnv } from "../../lib/env.js";
import { createRunDir, writeJson, writeText } from "../../lib/results.js";
import { envBlock, heading, table } from "../../lib/report.js";
import { EXPERIMENT, VARIANTS, tagFor } from "./config.js";
import { contextFiles } from "./gen.js";

interface VariantResult {
  variant: string;
  coldExit: number;
  offlineRebuildExit: number;
  runStepDurationS: number | null;
  imageBytes: number;
}

function main(): void {
  const env = snapshotEnv();
  const run = createRunDir(EXPERIMENT);
  console.log(envBlock(env));
  console.log(`\nrun dir: ${run.dir}`);

  const runId = Date.now().toString(36);
  const results: VariantResult[] = [];

  for (const variant of VARIANTS) {
    const tag = tagFor(variant);
    const mountId = `dbl03-${runId}`;
    console.log(heading(`${variant}: cold (online) -> rebuild (npm install --offline)`));
    removeImage(tag);

    const cold = runBuild(
      writeContext({
        experiment: EXPERIMENT,
        label: `${variant}-cold`,
        files: contextFiles(variant, { offline: false, mountId }),
      }),
      { tag, noCache: true, buildArgs: { BUST: `${runId}-1` } },
    );
    console.log(`  cold: exit=${cold.exitCode}`);
    writeText(run.file(`build-log/${variant}.cold.txt`), cold.output);

    const rebuild = runBuild(
      writeContext({
        experiment: EXPERIMENT,
        label: `${variant}-offline`,
        files: contextFiles(variant, { offline: true, mountId }),
      }),
      { tag, buildArgs: { BUST: `${runId}-2` } },
    );
    const runStep = rebuild.buildSteps.find((s) => /npm install/.test(s.name));
    console.log(
      `  rebuild --offline: exit=${rebuild.exitCode} ` +
        `RUN=${runStep && !runStep.cached ? `${runStep.durationS}s` : runStep?.cached ? "CACHED" : "?"}`,
    );
    writeText(run.file(`build-log/${variant}.offline.txt`), rebuild.output);

    const info = imageInfo(tag);
    results.push({
      variant,
      coldExit: cold.exitCode,
      offlineRebuildExit: rebuild.exitCode,
      runStepDurationS: runStep && !runStep.cached ? runStep.durationS : null,
      imageBytes: info?.totalBytes ?? 0,
    });
  }

  // ---------------------------------------------------------------- report
  const rows = results.map((r) => [
    r.variant,
    r.coldExit === 0 ? "ok" : `exit ${r.coldExit}`,
    r.offlineRebuildExit === 0 ? "ok" : `exit ${r.offlineRebuildExit}`,
    r.runStepDurationS != null ? `${r.runStepDurationS}s` : "-",
    humanBytes(r.imageBytes),
  ]);

  const report = [
    `Experiment ${EXPERIMENT}`,
    "",
    envBlock(env),
    "",
    "RUN layer busted (ARG change), then `npm install --offline`",
    "",
    table(
      ["variant", "cold", "rebuild --offline", "rebuild RUN", "image size"],
      rows,
    ),
    "",
    "Expect: `plain` --offline fails (npm cache was in the busted layer);",
    "`cachemount` --offline succeeds (persistent mount). Image sizes equal.",
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
