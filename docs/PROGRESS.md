# Progress

- [x] T0 Scaffold
  - Scaffolded initial repo layout as per Section 3.
  - Setup ESLint flat config, Prettier, TypeScript configuration.
  - Created initial workspace `package.json` for root and two packages (core, cli).
  - Configured test runner (Vitest) with trivial passing test for each package.
  - Generated LICENSE, README, AGENTS.md, docs and CI GitHub Action.
  - Verified `npm run check` passes completely.
- [x] T1 Schema & IO
  - Implemented zod schemas, ScoutError, posix paths, and io helpers.
- [x] T2 Discovery & config — static config reading via TS compiler API; fast-glob spec/support discovery; tsconfig paths; 17 tests passing.
- [x] T3 Parsing & resolution
  - Added a TypeScript source-file parser wrapper and parse-diagnostic helper.
  - Implemented relative and alias import resolution with `.ts/.js` fallback behavior.
  - Implemented export resolution across barrel files and default re-exports.
  - Verified with focused regression tests covering local and alias resolution paths.
- [x] T4 Helper & fixture facts
  - Extracted exported helper metadata, page-object classification, and fixture definitions from parsed files.
- [x] T5 Test-tree facts
  - Built test tree extraction for suite paths, modifiers, tags, fixtures, dynamic titles, and callback references.
- [x] T6 Linking & build
  - Linked helper/test/fixture references across files and built the deterministic index from discovered Playwright project data.
- [x] T7 CLI map
  - Wired the CLI map command to the core builder and verified output against the sample suite.
- [x] T8 Search & show
  - Implemented index search and lookup flows used by the CLI commands.
- [x] T9 Robustness
  - The parser and builder handle empty/comment-only files, large files, and config/path edge cases without crashing.
- [x] T10 Skill & installer
  - Implemented the bundled skill installer and wired the CLI install-skill command to copy the correct SKILL.md into agent target directories.
- [x] T11 Docs — README examples, known limitations, and installer path guidance synchronized with verified CLI behavior.
- [x] T12 Dry run on real code — Mapped public Microsoft and Checkly Playwright examples without crashes; timings and counts are in `docs/DECISIONS.md`.
- [x] T13 Release prep — Both 0.1.0 tarballs pass dry-run contents review and installed-package smoke tests; publish is intentionally left to the human maintainer.

## Fix phase
- Baseline recorded for F0: golden suite currently failing with 21/25 tests failing (4 passing), after the sample-suite regression test was added and before any fix work begins.
- [x] F1 — Fix the test-tree extraction (`facts.ts`): corrected Playwright `describe`/`test` detection, 1-based coordinates, inherited tags and modifiers, dynamic title rendering, loop detection, and `.goto()` capture; verified with the F1 golden subset.
- [x] F2 — Clean up `build.ts`: parse each file once, use discovered specs and source language, report skipped files and dynamic titles, and sort diagnostics deterministically; `npx tsc -b` and the F2 golden subset pass.
- [x] F3 — Build the reachable module graph, resolve imports/exports from cached facts, and link helpers to files and individual tests; facts/resolver regressions and the golden acceptance slice pass.
- [x] F4 — Verified fixture extraction and test-object exclusion against the golden suite; all three targeted assertions pass.
- [x] F5 — Implemented weighted search fields, deterministic ordering, strict show resolution, and ambiguity reporting; `npm run check` passes with 57 tests.
- [x] F6 — Wired the compiled CLI options, output formatting, injected writers, and documented exit codes; verified built map/find/show/missing-index commands and `npm run check` passes with 60 tests.
- [x] F7 — Added parse, build, and link tests plus empty/comment, oversized, CRLF, non-UTF8, Windows-path, and 1,000-spec robustness coverage; `npm run check` passes with 70 tests.
- [x] F8 — Updated README and skill commands from fresh sample-suite runs, added known limitations and installer-path verification guidance, and recorded helper-directory counting; `npm run check` passes with 70 tests.
- [x] F9 — Completed public-project dry runs, package metadata and contents review, and fresh-project installation/execution of both tarballs; publishing remains a human-only step.

## Maintainer tooling
- Added a human-run npm release script with PAT loading, authentication and version checks, package-content validation, confirmation, and core-first publishing. Its dry run passed with 71 tests; no package was published by the script during verification.
- Prepared CLI 0.1.1 with a generated copy of the root README for npm. The release script now supports independent core and CLI versions; its dry run passed with 71 tests and both package contents verified.

## v0.2 suite context
- [ ] Draft specification for review: `docs/SPEC-v0.2.md`. Implementation cards V0–V4 have not started.
