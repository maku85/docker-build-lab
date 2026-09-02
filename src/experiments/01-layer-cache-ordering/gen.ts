/**
 * Context generator for experiment 01.
 *
 * Same app, two Dockerfiles:
 *
 *   naive    COPY . .  then  RUN npm install
 *            -> any source change busts the COPY layer, so npm install re-runs
 *   ordered  COPY package.json  then  RUN npm install  then  COPY . .
 *            -> a source change busts only the final COPY; npm install stays cached
 *
 * The measurement is a rebuild after touching a source file that is NOT
 * package.json.
 */
import { BASE_IMAGE, DEPENDENCIES } from "./config.js";
import type { Variant } from "./config.js";

const packageJson = JSON.stringify(
  { name: "app", version: "1.0.0", private: true, dependencies: DEPENDENCIES },
  null,
  2,
);

export function indexJs(marker: string): string {
  return `// marker: ${marker}
const isOdd = require("is-odd");
console.log(isOdd(Number(process.argv[2] ?? 3)));
`;
}

const DOCKERFILES: Record<Variant, string> = {
  naive: `FROM ${BASE_IMAGE}
WORKDIR /app
COPY . .
RUN npm install --omit=dev --no-audit --no-fund
CMD ["node", "index.js"]
`,
  ordered: `FROM ${BASE_IMAGE}
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
CMD ["node", "index.js"]
`,
};

export function contextFiles(variant: Variant, marker: string): Record<string, string> {
  return {
    Dockerfile: DOCKERFILES[variant],
    "package.json": packageJson,
    "index.js": indexJs(marker),
    ".dockerignore": "node_modules\nDockerfile*\n",
  };
}
