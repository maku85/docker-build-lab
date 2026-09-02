# 02: Invalidation cascade

## Question

When one step in a chain of `RUN` instructions changes, how many downstream steps
rebuild? The expectation is "all of them": a cache miss on step `k` invalidates
`k` and everything after it, regardless of whether the later steps' commands are
byte-identical.

## Fixtures

One Dockerfile with `N` sequential `RUN` steps (`N ∈ {4, 8, 16}`), each writing a
distinct marker file. A build arg selects which step `k` gets a changed command.

Axis: the position `k` of the changed step.

## Method

Cold build, then rebuild with `--build-arg CHANGE_AT=k`, count `CACHED` vs
rebuilt steps from `--progress=plain`. Sweep `k` from 1 to `N`.

Expected: rebuilt count is exactly `N - k + 1` for every `k`. A corollary check:
put the changed step last and confirm only one step rebuilds.

Each chain's `RUN` commands are scoped to `(runId, n)`. Identical commands off the
same base would otherwise let a short chain prime a longer one's cache: the first
version of this experiment shared `echo "step i"` across `n = 4 / 8 / 16` and
`n = 8`'s first four steps hit cache from the `n = 4` run.

## Results

Docker 29.4.0, buildx 0.33.0, Apple M3 Pro. **Confirmed.**

| n | k | rebuilt `RUN` steps | `n - k + 1` |
| --- | --- | --- | --- |
| 8 | 1 | 8 | 8 |
| 8 | 4 | 5 | 5 |
| 8 | 8 | 1 | 1 |
| 16 | 1 | 16 | 16 |
| 16 | 8 | 9 | 9 |
| 16 | 16 | 1 | 1 |

All 14 swept positions matched `n - k + 1` exactly (`n = 4` full, `n = 8` full,
`n = 16` at k = 1 / 8 / 16). A `RUN` cache miss rebuilds itself and every step
below it; the later steps' commands being byte-identical does not save them,
because each `RUN`'s cache key includes its parent's result digest.

### Parser note

BuildKit right-pads the step number once the total reaches two digits: `[ 3/10]`,
not `[3/10]`. The step parser had to tolerate the whitespace inside the brackets;
without it, chains of 10+ steps were mis-counted.

Raw: `results/02-invalidation-cascade/<timestamp>/` (one `--progress=plain` log
per position).
