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
- [ ] T11 Docs
- [ ] T12 Dry run on real code
- [ ] T13 Release prep

## Fix phase
- Baseline recorded for F0: golden suite currently failing with 21/25 tests failing (4 passing), after the sample-suite regression test was added and before any fix work begins.
