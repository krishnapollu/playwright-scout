# Contributing

## Setup

```sh
npm ci
npm run check
```

The repository is an ESM TypeScript monorepo. Keep relative source imports suffixed with `.js`, avoid `any`, and preserve deterministic POSIX-relative paths in index output. The core library must not print, exit, or execute analyzed project code.

## Changes

- Follow the task order in `docs/SPEC.md` and update `docs/PROGRESS.md` when a task is complete.
- Add focused Vitest coverage for behavior changes; do not weaken the golden test.
- Record new dependency decisions in `docs/DECISIONS.md`.
- Run `npm run check` before submitting changes.
- Do not publish packages from a development change; release publishing is a human-only step.
