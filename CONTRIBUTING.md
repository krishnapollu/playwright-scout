# Contributing

## Setup

```sh
npm ci
npm run check
```

The repository is an ESM TypeScript monorepo. Keep relative source imports suffixed with `.js`, avoid `any`, and preserve deterministic POSIX-relative paths in index output. The core library must not print, exit, or execute analyzed project code.

`packages/core` holds parsing, linking, search, and the index schema. `packages/cli` holds commands and the bundled skill. `fixtures/sample-suite` is the canonical input for golden tests; `fixtures/guidance-suite` covers optional guidance commands. `docs/` contains current contracts and historical plans; start with [the documentation index](docs/README.md).

## Changes

- Follow the task order in `docs/SPEC.md` and update `docs/PROGRESS.md` when a task is complete.
- Add focused Vitest coverage for behavior changes; do not weaken the golden test.
- For a new parsing case, add a small source fixture under `fixtures/`, then add a focused test in `packages/core/test`. Keep `fixtures/sample-suite` source coordinates stable because golden assertions cite them.
- Record new dependency decisions in `docs/DECISIONS.md`.
- Run `npm run check` before submitting changes.
- Use one Conventional Commit per task, for example `fix(core): recognize exported test aliases`.
- Do not publish packages from a development change; release publishing is a human-only step.

To exercise the built CLI against the included suite:

```sh
npm run build
node packages/cli/dist/bin.js map --root fixtures/sample-suite
node packages/cli/dist/bin.js find login --root fixtures/sample-suite
```
