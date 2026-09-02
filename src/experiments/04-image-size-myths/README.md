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

Design only.
