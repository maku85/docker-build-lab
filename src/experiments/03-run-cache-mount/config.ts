export const EXPERIMENT = "03-run-cache-mount";

export const BASE_IMAGE = "node:22-alpine";

/** A handful of tiny real deps, enough that a full re-download is visible. */
export const DEPENDENCIES: Record<string, string> = {
  "is-odd": "3.0.1",
  "is-number": "7.0.0",
  "is-even": "1.0.0",
  "left-pad": "1.3.0",
  "pad-left": "2.1.0",
  "dot-prop": "6.0.1",
  ms: "2.1.3",
  bytes: "3.1.2",
};

export const VARIANTS = ["plain", "cachemount"] as const;
export type Variant = (typeof VARIANTS)[number];

export const tagFor = (v: Variant): string => `dbl-03-${v}:run`;
