export const EXPERIMENT = "04-image-size-myths";

export const BASE_IMAGE = "alpine:3";

/** Size of the throwaway blob (MB) for the clean-up comparison. */
export const BLOB_MB = 50;

export const VARIANTS = [
  "inline-clean",
  "late-clean",
  "single-stage",
  "multi-stage",
] as const;
export type Variant = (typeof VARIANTS)[number];

export const tagFor = (v: Variant): string => `dbl-04-${v}:run`;
