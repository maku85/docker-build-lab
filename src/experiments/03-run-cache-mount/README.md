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

The probe used is stronger than "count re-downloads": cold-build online to
populate, then bust the `RUN` layer with a changed `ARG` (`package.json`
untouched) and run `npm install --offline`.

- `plain`: the npm cache lived inside the `RUN` layer, which is now a fresh empty
  layer, so `--offline` cannot resolve anything and fails.
- `cachemount`: the cache is the persistent mount, still full, so `--offline`
  succeeds.

The mount `id` is run-unique so each run starts from an empty mount.

## Results

Docker 29.4.0, buildx 0.33.0, Apple M3 Pro. **Confirmed.**

| variant | cold | rebuild `npm install --offline` | image size |
| --- | --- | --- | --- |
| `plain` | ok | **exit 1** (`ENOTCACHED`) | 172.4 MB |
| `cachemount` | ok | **ok** (RUN 0.7 s) | 171.7 MB |

- Busting the `RUN` layer wipes `plain`'s npm cache; `cachemount` keeps it in the
  mount and an offline install still works.
- Image sizes are equal within noise (172.4 vs 171.7 MB). A `type=cache` mount is
  not a layer, so it adds nothing to the image.

Raw: `results/03-run-cache-mount/<timestamp>/`.
