export const EXPERIMENT = "02-invalidation-cascade";

/** Base image: tiny, and the RUN steps do no network work (just `echo`). */
export const BASE_IMAGE = "alpine:3";

/** Chain lengths. N=8 is swept fully; the others get spot-check positions. */
export const CHAINS: { n: number; positions: number[] }[] = [
  { n: 4, positions: [1, 2, 4] },
  { n: 8, positions: [1, 2, 3, 4, 5, 6, 7, 8] },
  { n: 16, positions: [1, 8, 16] },
];

export const tagFor = (n: number): string => `dbl-02-n${n}:run`;
