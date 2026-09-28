# AGENTS.md

Project: playwright-scout — static index of a Playwright suite + agent skill. Full spec: docs/SPEC.md.

## Commands
- Install: `npm ci`
- Full check (run before every commit): `npm run check`
- Tests only: `npm test`   · Build: `npm run build`
- Try the CLI: `node packages/cli/dist/bin.js map --root fixtures/sample-suite`

## Rules
- ESM only. Relative imports in source end with `.js`. Use `import type` for types.
- `core` never prints, never exits, never executes analysed code. Only `cli` prints.
- All paths in output are POSIX and relative to the root. Sort with code-unit comparison, never localeCompare.
- Output must be deterministic. No Date/Random in the index (except generatedAt, nullable).
- No `any`. No new dependencies without recording why in docs/DECISIONS.md.
- One task at a time from docs/SPEC.md section 10. Update docs/PROGRESS.md. One Conventional Commit per task.
- Never run `npm publish`.

## Layout
packages/core = library, packages/cli = commands, skills/ = SKILL.md, fixtures/sample-suite = test input.
