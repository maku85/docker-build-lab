/**
 * Context generator for experiment 03.
 *
 *   plain       COPY package.json; RUN npm install
 *   cachemount  COPY package.json; RUN --mount=type=cache,target=/root/.npm npm install
 *
 * The cache mount keeps npm's download cache across builds without a layer. The
 * probe: populate it on a cold build, then bust the RUN layer (a changed ARG,
 * package.json untouched) and run `npm install --offline`.
 *
 *   plain       the previous npm cache lived in the busted layer -> --offline fails
 *   cachemount  the cache is the persistent mount -> --offline succeeds
 *
 * The mount `id` is run-unique so a run starts from an empty mount.
 */
import { BASE_IMAGE, DEPENDENCIES } from "./config.js";
import type { Variant } from "./config.js";

const packageJson = JSON.stringify(
  { name: "app", version: "1.0.0", private: true, dependencies: DEPENDENCIES },
  null,
  2,
);

export function contextFiles(
  variant: Variant,
  opts: { offline: boolean; mountId: string },
): Record<string, string> {
  const mount =
    variant === "cachemount"
      ? `--mount=type=cache,id=${opts.mountId},target=/root/.npm `
      : "";
  const offline = opts.offline ? " --offline" : "";
  const dockerfile = `# syntax=docker/dockerfile:1
FROM ${BASE_IMAGE}
WORKDIR /app
COPY package.json ./
ARG BUST
RUN ${mount}sh -c 'echo "bust=$BUST" && npm install --no-audit --no-fund${offline}'
CMD ["node", "-e", "0"]
`;
  return { Dockerfile: dockerfile, "package.json": packageJson };
}
