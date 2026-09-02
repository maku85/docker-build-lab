/**
 * Experiment 04 - Image size myths
 *
 *   npm run exp:04
 *
 * A. does `rm` in a later RUN shrink the image? (inline-clean vs late-clean)
 * B. is multi-stage meaningfully smaller? (single-stage vs multi-stage)
 *
 * Total size from the sum of `docker history` layer sizes.
 */
import { clearContexts, writeContext } from "../../lib/context.js";
import { removeImage } from "../../lib/cleanup.js";
import { runBuild } from "../../lib/docker.js";
import { humanBytes, imageInfo } from "../../lib/image.js";
import type { ImageInfo } from "../../lib/image.js";
import { snapshotEnv } from "../../lib/env.js";
import { createRunDir, writeJson, writeText } from "../../lib/results.js";
import { envBlock, heading, table } from "../../lib/report.js";
import { EXPERIMENT, VARIANTS, tagFor } from "./config.js";
import { contextFiles } from "./gen.js";

function biggestLayer(info: ImageInfo | null): string {
  if (!info || info.layers.length === 0) return "-";
  const top = [...info.layers].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
  return top ? `${humanBytes(top.sizeBytes)}  ${top.createdBy.slice(0, 44)}` : "-";
}

function main(): void {
  const env = snapshotEnv();
  const run = createRunDir(EXPERIMENT);
  console.log(envBlock(env));
  console.log(`\nrun dir: ${run.dir}`);

  const infos = new Map<string, ImageInfo | null>();

  for (const variant of VARIANTS) {
    const tag = tagFor(variant);
    console.log(heading(`${variant}: build --no-cache`));
    removeImage(tag);
    const build = runBuild(
      writeContext({ experiment: EXPERIMENT, label: variant, files: contextFiles(variant) }),
      { tag, noCache: true },
    );
    writeText(run.file(`build-log/${variant}.txt`), build.output);
    const info = imageInfo(tag);
    infos.set(variant, info);
    console.log(`  exit=${build.exitCode} size=${info ? humanBytes(info.totalBytes) : "?"}`);
  }

  const size = (v: string): number => infos.get(v)?.totalBytes ?? 0;

  const tableA = table(
    ["variant", "image size", "biggest layer"],
    ["inline-clean", "late-clean"].map((v) => [v, humanBytes(size(v)), biggestLayer(infos.get(v) ?? null)]),
  );
  const tableB = table(
    ["variant", "image size", "biggest layer"],
    ["single-stage", "multi-stage"].map((v) => [v, humanBytes(size(v)), biggestLayer(infos.get(v) ?? null)]),
  );

  const cleanupDelta = size("late-clean") - size("inline-clean");
  const stageDelta = size("single-stage") - size("multi-stage");

  const report = [
    `Experiment ${EXPERIMENT}`,
    "",
    envBlock(env),
    "",
    "A. Cleanup: does `rm` in a later RUN shrink the image?",
    "",
    tableA,
    `late-clean minus inline-clean: ${humanBytes(cleanupDelta)} ` +
      `(the later rm did not reclaim the 50 MB blob)`,
    "",
    "B. Multi-stage: is the final image smaller?",
    "",
    tableB,
    `single-stage minus multi-stage: ${humanBytes(stageDelta)} ` +
      `(the build toolchain never reaches the final image)`,
  ].join("\n");

  console.log(`\n${report}`);
  writeText(run.file("comparison.txt"), report);
  writeJson(run.file("baseline.json"), { experiment: EXPERIMENT, env, variants: VARIANTS });
  writeJson(run.file("summary.json"), {
    experiment: EXPERIMENT,
    runAt: new Date().toISOString(),
    env,
    sizes: Object.fromEntries(VARIANTS.map((v) => [v, infos.get(v)?.totalBytes ?? 0])),
    cleanupDelta,
    stageDelta,
    layers: Object.fromEntries(VARIANTS.map((v) => [v, infos.get(v)?.layers ?? []])),
  });

  console.log(`\nFull output under:\n  ${run.dir}`);
  clearContexts(EXPERIMENT);
  for (const variant of VARIANTS) removeImage(tagFor(variant));
}

main();
