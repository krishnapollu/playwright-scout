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

- [x] V0 Baseline and fixture cases — `npm run check` passes with 78 tests. Existing `context coupon --json` is 871 characters and lists the method, constant, test and class, but no fixture provider or evidence reasons. Existing `impact LoginPage.login --json` is 373 characters with no tests, despite the sample login test calling it through `loginPage`. Added seven fixture syntax baseline cases covering direct, barrel, function, options tuple, unresolved, conditional and same-name test objects. Implementation has not changed.
- [x] V1 Fixture graph and index v2 — direct `use(new Class())` and `use(function())` providers link through imports and barrels; fixture method calls resolve only through the imported test object. Dynamic/unresolved providers stay unlinked, duplicate fixture names receive distinct IDs, and v1 indexes remap. `npm run check` passes with 80 tests.
- [x] V2 Bounded task context — CLI returns deterministic text/JSON briefs with source references, one similar test, setup/data, repeated local observations, unknowns and omission counts. `--max-chars` bounds the full output; new source/config files trigger a stale warning. Legacy core `buildContext` remains exported. `npm run check` passes with 85 tests.
- [x] V3 File impact — `impact --file` reports sorted known linked tests with direct spec, helper call, and fixture provider reasons. CLI rejects absolute, traversal, missing and symlink-escape paths; empty results explain the analysis limit. `npm run check` passes with 89 tests.
- [x] V4 Agent skill, evaluation, docs and packaging — updated the bundled skill and v0.2 docs; five checked-in evaluation tasks passed, four of five task briefs were shorter in characters than the old context JSON, and no model-token/agent-quality claim was made. Microsoft and Checkly public suites mapped without crashes; sizes and one-off timings are in `docs/EVALUATION-v0.2.md`. Both 0.2.0 tarballs passed content review and a fresh local-tarball install exercised map, context, impact and install-skill. `npm run check` passes with 90 tests. No package was published.

## v0.3 opt-in suite guidance

- [x] D0 Contract and baselines — Drafted `docs/SPEC-v0.3.md` and added a small fixture with a literal missing `testDir`, two review patterns, a web-first assertion that must not be flagged, and an unrelated method name that must not be flagged. No production behavior changed. `npm run check` passes with 90 tests.
- [x] D1 Doctor — Added opt-in `doctor` with static config-path finding, source line and official guidance link; missing/dynamic config and outside-root paths remain unknown rather than defects. No index or Playwright execution is required. Text/JSON output is deterministic and findings leave exit code 0. `npm run check` passes with 96 tests.
- [x] D2 Review — Added explicit single-file `review` with two conservative AST checks for page fixed waits and manual inline-locator visibility assertions; unrelated names and assertions are ignored. The CLI validates root-relative source paths and symlink containment, needs no index, and does not edit code. `npm run check` passes with 101 tests.
- [x] D3 Docs, skill and packaging — Updated the opt-in skill instructions and CLI/README, versioned both workspaces to 0.3.0, and recorded public-suite smoke results and limits in `docs/EVALUATION-v0.3.md`. Both tarballs passed content review and a fresh temporary install exercised new and existing commands; the installed skill matched source byte-for-byte. The optional Python skill validator lacked PyYAML, so frontmatter and placeholders were checked manually. No publish. `npm run check` passes with 101 tests.

## v0.4 controlled agent evaluation

- [x] E0 Protocol draft — Specified the paired with/without-Scout evaluation, task and suite requirements, actual token telemetry, blind quality review, predeclared thresholds, privacy boundaries, and ordered milestones in `docs/SPEC-v0.4.md`. No agent runs or product behavior changes. Execution awaits suite/model/budget/reviewer decisions.
- [ ] E1 Freeze task set — User selected public suites only. Screened three pinned candidate projects: a POM/fixture-rich local-app demo (9 specs, 108 tests), auto-animate (12 specs, 22 tests), and Starlight (7 specs, 62 tests at its package root). Drafted 12 candidate tasks (four pilot, eight additional) with source evidence in `bench/E1-CANDIDATES.md`. Representative targeted baselines pass in all three public suites after documented temporary setup. No agent runs. Exact task checks, independent gold review, low-context case selection, and final freeze remain.
- [ ] E2 Reproducible harness — User chose Codex-only and authorized sharing local `pw-test` source for a small pilot, while keeping evaluated projects outside this repo. An allowlist copier makes identical temporary arms without credentials, prior reports, artifacts, or `node_modules`. Both copies installed dependencies and typechecked. A temporary Scout-arm CLI shim and installed skill passed a map smoke check. The capped runner passed a fake-CLI instrumentation smoke test and recorded one real pair's usage. Scout 0.3's TypeScript 5 peer conflicts with `pw-test`'s TypeScript 7, so the shim is a pilot workaround. Repeatable public-suite setup, fixture-based harness tests, and complete scoring remain.
- [ ] E3 Pilot — Ran one capped Codex pair on standalone `pw-test` snapshots; identical test changes passed typecheck and the targeted Chromium check in both arms. Scout invoked its skill, map, and context. Provider usage was measurable, but total tokens and uncached tokens moved in opposite directions. Setup failures before model work and browser sandbox reruns are documented in `docs/PILOT-v0.4.md`. This is an instrumentation/feasibility result, not the planned 4–6-task pilot or an efficacy claim.
- [x] E3a Focused pilot refinement — Made Scout queries optional for obvious local edits and changed analogous-test selection to prefer more matched method calls, with a same-file tie-break. A regression test reproduces the prior add-to-cart/API-web misranking; the real `pw-test` context now cites the existing dress-search example. The optional Python skill validator lacks PyYAML, so frontmatter and the packaged skill copy were checked manually. `npm run check` passed with 102 tests.
- [x] E3b Same-task follow-up — Ran a fresh capped Codex pair after `373ac3e`; both arms passed typecheck and the targeted live Chromium check. Scout's uncached-plus-output tokens were lower rather than higher, but the control agent ran the full products suite and saw much more output, so this is not evidence of causal token savings. Scout still invoked `map` and `context`; abstention remains unverified on this task. See `docs/PILOT-v0.4.md`.
- [x] README presentation — Centered the logo, title, tagline, and badges in that order in both repository and package READMEs.

## Next-phase product planning

- [x] Draft direction — Recorded the token-conscious, coding-assistant-agnostic product milestones in `docs/PLAN-v0.5.md`: selective suite context, optional configurable business files, low-friction setup and Qwen support, plus a later evidence gate that measures wall-time components as well as tokens and quality. Further agent tests remain paused; no product behavior changed.
- [x] P0 Baseline and contract — Recorded command/skill/installer behavior, a reproducible unrelated-query suggestion, three representative P1 tasks, and the existing evaluation measures in `docs/P0-BASELINE.md`. Core now declares its TypeScript 5 compiler API as a runtime dependency instead of an incompatible peer for TypeScript 7 host projects. `npm run check` passed with 102 tests; packed core and CLI installed beside a TypeScript 7.0.2 host and mapped the sample suite with core's own TypeScript 5.9.3.
- [x] P1 Selective suite context — The default capsule is bounded to 1800 characters with omission counts; agents can inspect cited IDs with `show` and request a larger bound when needed. A similar test now needs two matching task words for multiword queries, fixing the P0 unrelated-query suggestion. Focused tests cover the false match and existing ranking behavior. Agent abstention measurement awaits resumed agent runs.
- [x] P2 Optional business context — `context --business-context` reads a versioned JSON file or bounded directory tree of user-authored journeys, terms, rules, and risks. Relevant entries include source lines and explicit uncertainty about test mapping; outside-project reads require an opt-in flag. Traversal, symlink escapes, generated/secret-looking paths, malformed files, and oversized input are rejected. See `docs/BUSINESS-CONTEXT.md`.
- [x] P3 Setup and assistant portability — `init` previews detected Playwright config, test directory, counts, helper directories, and diagnostics without writing files. `install-skill --target qwen` now copies the bundled skill to Qwen Code's documented project discovery path. Existing assistant targets remain available. CLI tests cover both paths and no-write preview behavior.
- [x] P4 Measurement instrumentation — The opt-in pilot runner records observed Scout/other command durations, output characters, a model-or-unattributed residual, evaluator typecheck time, and full arm wall time alongside provider token telemetry. Synthetic tests cover missing intervals and output fields. `docs/P4-MEASUREMENT.md` defines quality-first reporting and limits. Controlled agent runs and blind review remain paused by user choice; P4 efficacy gate is not complete.
- [x] 0.5.0 release preparation — Aligned both package versions and the CLI core dependency; full checks, package-content review, a fresh TypeScript 7 host install, installed CLI/skill smoke tests, and the authenticated release dry-run passed. Evidence and remaining evaluation limit are in `docs/RELEASE-v0.5.md`. Nothing was published or pushed.
- [x] Public-launch cleanup — Added version output, local test-object alias handling, and search synonyms with regression tests; updated docs, contributor templates, and the experimental command labels. Registry timestamps were checked for the changelog. Formatting excludes the coordinate-sensitive sample suite. The completed checks and commits are recorded in Git history.
- [x] 0.5.1 patch release preparation — Updated both workspace versions and the CLI core dependency to ship the post-0.5.0 fixes. The CLI version regression was observed failing at 0.5.0 before the bump.
