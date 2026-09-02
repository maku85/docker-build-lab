# 05: .dockerignore and the build context

## Question

The build context is tarred and sent to the daemon before the build starts, and
`COPY` cache keys are computed over what the context contains. How much does a
`.dockerignore` change:

1. context transfer size and time,
2. whether an unrelated file change (a log, a `node_modules` edit) busts a
   `COPY . .` layer?

## Fixtures

An app directory padded with a large ignorable tree (`node_modules/`, `.git/`, a
`logs/` dir with a big file). Two setups: no `.dockerignore`, and a
`.dockerignore` that excludes all of it.

## Method

Build both, read `transferring context: <size>` from `--progress=plain`. Then
touch a file inside the ignorable tree and rebuild each; check whether
`COPY . .` reports `CACHED`.

Expected: with `.dockerignore`, the context is a few kB instead of tens of MB,
and a change inside the ignored tree does not bust `COPY . .`. Without it, both
get worse.

## Results

Docker 29.4.0, buildx 0.33.0, Apple M3 Pro. **Confirmed.**

`node_modules/` (2 MB) + `logs/app.log` (3 MB) alongside a tiny real file.

| variant | context transfer | image size | `COPY . .` after touching `logs/app.log` |
| --- | --- | --- | --- |
| `noignore` | 5.0 MB | 15.3 MB | re-run |
| `ignored` | 146 B | 10.3 MB | CACHED |

- `.dockerignore` cut the context transfer from 5.0 MB to 146 B, and the image
  from 15.3 MB (base + 5 MB copied) to 10.3 MB (base only).
- With no `.dockerignore`, touching a file the build never uses (`logs/app.log`)
  still busts `COPY . .`: the layer's cache key is a checksum over everything the
  context contains.
- With the `.dockerignore`, that file is not in the context, so `COPY . .` stays
  a cache hit.

### Note on `docker image inspect .Size`

For buildx images built with attestations it under-reports (it does not sum the
platform layers): it read 4.2 MB for both variants. The lab computes total size
from the sum of `docker history` layer sizes instead.

Raw: `results/05-dockerignore-context/<timestamp>/`.
