export const EXPERIMENT = "05-dockerignore-context";

export const BASE_IMAGE = "alpine:3";

/** Sizes of the ignorable tree (padded text files). */
export const NODE_MODULES_BYTES = 2_000_000;
export const LOGS_BYTES = 3_000_000;

export const VARIANTS = ["noignore", "ignored"] as const;
export type Variant = (typeof VARIANTS)[number];

export const tagFor = (v: Variant): string => `dbl-05-${v}:run`;
