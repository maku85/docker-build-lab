/**
 * Reads back what a build produced: total image size, and the per-layer
 * breakdown from `docker history`.
 */
import { execFileSync } from "node:child_process";

export interface ImageLayer {
  createdBy: string;
  sizeBytes: number;
}

export interface ImageInfo {
  tag: string;
  totalBytes: number;
  layers: ImageLayer[];
  /** Layers with size > 0, i.e. the ones that actually add weight. */
  weightyLayers: number;
}

function exec(args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

export function imageInfo(tag: string): ImageInfo | null {
  // `docker image inspect .Size` is unreliable for buildx images built with
  // attestations (it does not sum the platform layers). Prefer the sum of
  // `docker history` layer sizes; fall back to `.Size`.
  let inspectSize = 0;
  try {
    inspectSize = Number(exec(["image", "inspect", tag, "--format", "{{.Size}}"]).trim()) || 0;
  } catch {
    return null;
  }

  const layers: ImageLayer[] = [];
  try {
    const hist = exec(["history", tag, "--no-trunc", "--format", "{{json .}}"]);
    for (const line of hist.trim().split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as { CreatedBy?: string; Size?: string };
      layers.push({
        createdBy: (row.CreatedBy ?? "").replace(/\s+/g, " ").slice(0, 120),
        sizeBytes: parseSize(row.Size ?? "0B"),
      });
    }
  } catch {
    // history can fail for some base images
  }

  const historySum = layers.reduce((n, l) => n + l.sizeBytes, 0);
  return {
    tag,
    totalBytes: historySum > 0 ? historySum : inspectSize,
    layers,
    weightyLayers: layers.filter((l) => l.sizeBytes > 0).length,
  };
}

const UNITS: Record<string, number> = {
  B: 1,
  kB: 1000,
  MB: 1000 ** 2,
  GB: 1000 ** 3,
  KB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
};

function parseSize(text: string): number {
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim());
  if (!m) return 0;
  return Math.round(Number(m[1]) * (UNITS[m[2] as string] ?? 1));
}

export function humanBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1000 ** 2) return `${(n / 1000).toFixed(1)} kB`;
  if (n < 1000 ** 3) return `${(n / 1000 ** 2).toFixed(1)} MB`;
  return `${(n / 1000 ** 3).toFixed(2)} GB`;
}
