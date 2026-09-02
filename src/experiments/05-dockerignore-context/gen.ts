/**
 * Context generator for experiment 05.
 *
 * An app directory padded with a large ignorable tree (`node_modules/`,
 * `logs/`). Two variants:
 *
 *   noignore  no `.dockerignore`; the whole tree is sent to the daemon and
 *             folded into the `COPY . .` cache key
 *   ignored   a `.dockerignore` that excludes the tree
 *
 * Measured: `transferring context:` size, final image size, and whether
 * touching a file inside the ignorable tree busts `COPY . .`.
 */
import { BASE_IMAGE, LOGS_BYTES, NODE_MODULES_BYTES } from "./config.js";
import type { Variant } from "./config.js";

const DOCKERFILE = `FROM ${BASE_IMAGE}
WORKDIR /app
COPY . .
CMD ["true"]
`;

const pad = (bytes: number, seed: string): string =>
  `${seed}\n${"x".repeat(Math.max(0, bytes - seed.length - 1))}`;

export function appTxt(marker: string): string {
  return `real app file\nmarker: ${marker}\n`;
}

export function logFile(marker: string): string {
  return pad(LOGS_BYTES, `log marker ${marker}`);
}

export function contextFiles(variant: Variant, marker: string): Record<string, string> {
  const files: Record<string, string> = {
    Dockerfile: DOCKERFILE,
    "app.txt": appTxt(marker),
    "node_modules/pkg/bundle.js": pad(NODE_MODULES_BYTES, "vendor bundle"),
    "logs/app.log": logFile("v1"),
  };
  if (variant === "ignored") {
    files[".dockerignore"] = "node_modules\nlogs\n*.log\nDockerfile*\n";
  }
  return files;
}
