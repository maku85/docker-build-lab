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

## Results

Design only.
