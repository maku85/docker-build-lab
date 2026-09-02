# docker-build-lab

A small, personal lab for studying the Docker / BuildKit **build cache** through
reproducible experiments: layer invalidation, `RUN --mount=type=cache`, image
size, `.dockerignore` and build-context sensitivity.

It is a readable environment where I generate a build context from a fixed
template, run the real `docker build`, parse its `--progress=plain` log and
`docker history`, and write down what happened. Scope is build time, cache
behaviour and image size. Container runtime (cgroups, namespaces, networking) is
a separate investigation.

## Philosophy

- **Observe the real builder.** No mocked output, no invented numbers. Every
  number under `results/` comes from a real `docker build` on this machine.
- **Cache hits and layer sizes are the signal; wall-clock is noise.** Build time
  is recorded but treated as noisy (it moves with the daemon's mood, disk, and
  what else is running). Conclusions rest on which steps report `CACHED`, and on
  `docker history` sizes.
- **Reproducible.** Contexts are generated from one template per experiment; the
  only thing that varies along an axis is the axis value. A run-unique token
  goes into the app source so a "cold" build cannot silently hit a cache entry
  from a previous run.
- **Minimal.** Node.js + TypeScript (strict) + `tsx` + the `docker` CLI. No test
  framework, no build step.

## Stack

- Node.js (>= 20), run directly with `tsx`.
- Docker 23+ with BuildKit (the default builder). `buildx` is used for
  `--progress=plain` and `--load`.
- Base images are pinned by tag; digest pinning is a TODO.

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm exp:01
```

`pnpm exp:NN` writes to `results/NN-<name>/<timestamp>/`:

| file | contents |
| --- | --- |
| `comparison.txt` | the table |
| `build-log/<label>.<phase>.txt` | verbatim `docker build --progress=plain` |
| `context/<label>/` | the exact generated build context |
| `baseline.json` | toolchain + host snapshot |
| `summary.json` | parsed per-step records |

`results/` is committed on purpose.

## Experiments

| # | question | status |
| --- | --- | --- |
| [01](src/experiments/01-layer-cache-ordering) | after a source change, does `RUN npm install` stay cached? | **confirmed**. `naive` re-runs it, `ordered` keeps it cached |
| [02](src/experiments/02-invalidation-cascade) | how far down a `RUN` chain does one changed step invalidate? | **confirmed**. Rebuilt count is exactly `n - k + 1` at every swept position (n up to 16) |
| [03](src/experiments/03-run-cache-mount) | does `RUN --mount=type=cache` survive a dependency change without a layer? | design only |
| [04](src/experiments/04-image-size-myths) | does `rm` in a later `RUN` shrink the image? does multi-stage? | design only |
| [05](src/experiments/05-dockerignore-context) | how much does `.dockerignore` change context transfer and cache keys? | **confirmed**. 5.0 MB → 146 B context; shields `COPY . .` from an ignored-file change |

## Layout

```
src/lib/        harness: run docker build + parse --progress=plain, read image
                size / history, generate a context, daemon hygiene, render a report
src/experiments/NN-<name>/
                config.ts  axis + constants
                gen.ts     deterministic context generator
                index.ts   the runner
                README.md  question, method, results
results/        committed raw + parsed output, one dir per run
```
