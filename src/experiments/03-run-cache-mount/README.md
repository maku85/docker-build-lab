# 03: RUN --mount=type=cache

## Question

`RUN --mount=type=cache,target=/root/.npm npm ci` keeps the package manager's
download cache across builds without putting it in a layer. When `package.json`
changes (busting the `RUN` layer), does the mount still spare the network
re-download, and does it keep the image the same size as the no-mount version?

## Fixtures

Same app as experiment 01 with a few more (still small) dependencies. Two
Dockerfiles:

- `plain`: `COPY package.json`, `RUN npm ci`
- `cachemount`: `COPY package.json`, `RUN --mount=type=cache,target=/root/.npm npm ci`

Requires `# syntax=docker/dockerfile:1` frontmatter.

## Method

Cold build both. Add one dependency to `package.json`, rebuild both. From
`--progress=plain` and the `RUN` step's own output, record: did `npm` hit its
cache (no "added N packages" download lines for the unchanged deps)? Compare
final image sizes via `docker history`.

Expected: `cachemount` re-runs the `RUN` layer (its input changed) but `npm`
reuses the mounted cache for the unchanged packages; the image is no larger than
`plain` because the mount is not a layer.

## Results

Design only.
