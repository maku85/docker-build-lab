# 04: Image size myths

## Question

Two widespread beliefs, measured:

1. Cleaning up in a **later** `RUN` (`RUN rm -rf /var/cache/...` after the
   `RUN apt-get install`) shrinks the image.
2. A multi-stage build with a slim final stage is meaningfully smaller than a
   single-stage build of the same app.

## Fixtures

A context that installs a handful of OS packages and builds a trivial artifact.
Dockerfile variants:

- `inline-clean`: install and clean in one `RUN`
- `late-clean`: install in one `RUN`, `rm` in a later `RUN`
- `single-stage`: everything in the final image
- `multi-stage`: build in stage 1, `COPY --from` only the artifact into a slim
  base

## Method

Build each, read total size and the per-layer breakdown from
`docker history --no-trunc`. Point at the layer that carries the weight.

Expected: `late-clean` is the same size as (or larger than) `inline-clean` (the
files are already committed to the earlier layer; a later `rm` adds a whiteout
layer, it does not remove bytes). `multi-stage` is smaller by roughly the size
of the build toolchain.

## Results

Docker 29.4.0, buildx 0.33.0, Apple M3 Pro. **Both confirmed.**

### A. Cleanup

| variant | image size | biggest layer |
| --- | --- | --- |
| `inline-clean` | 10.3 MB | 10.3 MB, the alpine base (`dd && rm` in one RUN nets 0) |
| `late-clean` | 62.7 MB | 52.4 MB, `RUN dd … of=/blob` |

`late-clean` is **52.4 MB larger**. The 50 MB blob is committed to the first
`RUN`'s layer; the later `RUN rm /blob` adds a whiteout layer that hides the file
and reclaims nothing.

### B. Multi-stage

| variant | image size | biggest layer |
| --- | --- | --- |
| `single-stage` | 265.3 MB | 255.0 MB, `RUN apk add build-base` |
| `multi-stage` | 10.3 MB | 10.3 MB, the alpine base |

`multi-stage` is **255 MB smaller**. `build-base` is installed in a build stage;
the final image only `COPY --from`s the artifact, so the toolchain never lands in
it.

Raw: `results/04-image-size-myths/<timestamp>/` (per-variant `docker history` in
`summary.json`).
