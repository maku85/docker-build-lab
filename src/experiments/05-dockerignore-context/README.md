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

Design only.
