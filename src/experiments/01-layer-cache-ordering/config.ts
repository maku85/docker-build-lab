export const EXPERIMENT = "01-layer-cache-ordering";

/** Base image. Pinned by tag; digest pinning is a TODO. */
export const BASE_IMAGE = "node:22-alpine";

/** Two tiny real deps, so `npm install` is a meaningful but fast layer. */
export const DEPENDENCIES: Record<string, string> = {
  "is-number": "7.0.0",
  "is-odd": "3.0.1",
};

export const VARIANTS = ["naive", "ordered"] as const;
export type Variant = (typeof VARIANTS)[number];

export const tagFor = (v: Variant): string => `dbl-01-${v}:run`;
