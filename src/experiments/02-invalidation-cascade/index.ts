/**
 * Experiment 02 - Invalidation cascade
 *
 *   npm run exp:02
 *
 * Question: change one `RUN` in a chain of n. How many rebuild? Expected: the
 * changed step and every step after it, i.e. `n - k + 1`, regardless of the
 * later steps' commands being byte-identical.
 */
import { clearContexts, writeContext } from "../../lib/context.js";
import { removeImage } from "../../lib/cleanup.js";
import { runBuild } from "../../lib/docker.js";
import { snapshotEnv } from "../../lib/env.js";
import { createRunDir, writeJson, writeText } from "../../lib/results.js";
import { envBlock, heading, table } from "../../lib/report.js";
import { CHAINS, EXPERIMENT, tagFor } from "./config.js";
import { contextFiles } from "./gen.js";

interface Point {
  n: number;
  k: number;
  rebuilt: number;
  expected: number;
  match: boolean;
}

function main(): void {
  const env = snapshotEnv();
  const run = createRunDir(EXPERIMENT);
  console.log(envBlock(env));
  console.log(`\nrun dir: ${run.dir}`);

  const runId = Date.now().toString(36);
  const points: Point[] = [];

  for (const { n, positions } of CHAINS) {
    const tag = tagFor(n);
    console.log(heading(`n=${n}: cold baseline -> change step k -> rebuild`));
    removeImage(tag);

    // Cold baseline (changeAt = 0), run-unique so it cannot hit a stale entry.
    const base = writeContext({
      experiment: EXPERIMENT,
      label: `n${n}-base`,
      files: contextFiles(n, 0, runId),
    });
    const cold = runBuild(base, { tag, noCache: true });
    writeText(run.file(`build-log/n${n}-cold.txt`), cold.output);
    console.log(`  cold: exit=${cold.exitCode} steps=${cold.buildSteps.length}`);

    for (const k of positions) {
      const ctx = writeContext({
        experiment: EXPERIMENT,
        label: `n${n}-k${k}`,
        files: contextFiles(n, k, runId),
      });
      const rebuild = runBuild(ctx, { tag });
      const runSteps = rebuild.buildSteps.filter((s) => /^RUN /.test(s.name));
      const rebuilt = runSteps.filter((s) => !s.cached).length;
      const expected = n - k + 1;
      const match = rebuilt === expected;
      points.push({ n, k, rebuilt, expected, match });
      writeText(run.file(`build-log/n${n}-k${k}.txt`), rebuild.output);
      console.log(
        `  k=${k}: rebuilt ${rebuilt} RUN steps, expected ${expected} ${match ? "ok" : "MISMATCH"}`,
      );
    }
  }

  // ---------------------------------------------------------------- report
  const rows = points.map((p) => [
    p.n,
    p.k,
    p.rebuilt,
    p.expected,
    p.match ? "ok" : "MISMATCH",
  ]);
  const allMatch = points.every((p) => p.match);

  const report = [
    `Experiment ${EXPERIMENT}`,
    "",
    envBlock(env),
    "",
    "Change RUN step k of n; count rebuilt RUN steps",
    "",
    table(["n", "k", "rebuilt", "expected (n-k+1)", "match"], rows),
    "",
    allMatch
      ? "All positions matched: a RUN miss rebuilds exactly itself and every step below."
      : "Some positions did not match n-k+1 (see build-log/).",
  ].join("\n");

  console.log(`\n${report}`);
  writeText(run.file("comparison.txt"), report);
  writeJson(run.file("baseline.json"), { experiment: EXPERIMENT, env, chains: CHAINS });
  writeJson(run.file("summary.json"), {
    experiment: EXPERIMENT,
    runAt: new Date().toISOString(),
    env,
    allMatch,
    points,
  });

  console.log(`\nFull output under:\n  ${run.dir}`);
  clearContexts(EXPERIMENT);
  for (const { n } of CHAINS) removeImage(tagFor(n));
}

main();
