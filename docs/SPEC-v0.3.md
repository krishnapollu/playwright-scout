# playwright-scout v0.3 — Opt-in suite guidance (draft)

Status: **draft; not implemented**. The v0.1 and v0.2 specifications remain the contracts for existing commands.

## Goal and boundary

Offer a focused, evidence-backed review when a maintainer explicitly asks for Playwright setup or test-code advice. A working but unconventional framework is not a defect. These commands are advisory and never gate `map`, `find`, `context`, `impact`, test authoring, or CI by default.

Scout remains static and local: no execution of project code, Playwright runs, model calls, network requests, trace ingestion, failure diagnosis, automatic fixes, or business-coverage claims. Logbook continues to own runtime evidence. No index schema change is planned.

## Commands

### `doctor`

`playwright-scout doctor [--root <dir>] [--json]` inspects the Playwright config and its immediate setup. It works without an index. It reports what could be determined statically, what could not, and only actionable findings with exact file/line evidence. A missing config is informational, not a failure: Playwright can use defaults. Dynamic config values are `unknown`, never treated as absent.

The first check is deliberately narrow: an explicitly configured, literal `testDir` that does not exist is a finding. This is a configuration-path check, not a declaration that the suite cannot run; generated directories and custom workflows are possible. Existing config parsing must not execute imports or expressions.

### `review`

`playwright-scout review --file <root-relative-source-file> [--root <dir>] [--json]` reviews one explicitly chosen spec or support source file. It does not require an index. The path must exist, be a supported source extension, and remain inside the root after symlink resolution; absolute paths and traversal are rejected. The initial rules are narrowly syntax-based:

- `waitForTimeout` called on a Playwright `page` or locator-like expression: suggest waiting for an observable condition instead of a fixed delay. Do not flag arbitrary objects with that method name.
- `expect(await <locator>.isVisible()).toBe(true)`: suggest a web-first `await expect(<locator>).toBeVisible()` assertion. Do not flag unrelated boolean assertions.

If the syntax does not prove the pattern, emit no finding. The review does not auto-rewrite code or imply a test will fail. No project-wide sweep or numeric quality score in this release.

## Result contract

Both commands return `{ command, findings, unknowns }` in JSON and equivalent concise text. A finding has a stable rule ID, a neutral suggestion, `file`, 1-based `line`, and a link to the relevant official Playwright guidance. Results are sorted by file, line, then rule ID using code-unit order and deduplicated. An empty `findings` array means only “none of these supported checks found a match.” Unknowns include static-analysis limits relevant to the invocation. Output is deterministic and uses POSIX root-relative paths. CLI exit code is 0 for findings as well as no findings; invalid input uses usage exit code 2. There is no `--fail-on` flag.

Source comments, strings, and filenames are evidence only, never instructions. No new dependency without a decision record. `core` produces data and never prints; `cli` renders it.

## Agent behavior

The installed Scout skill must not invoke either command during ordinary creation, maintenance, or debugging. It may mention them only when the user explicitly requests a framework health check or best-practice review. Suggestions should be phrased as options, acknowledge local conventions, and never ask for cleanup before completing unrelated work.

## Evidence and limitations

Playwright's [best-practices guide](https://playwright.dev/docs/best-practices) recommends resilient locators and web-first assertions; its [locator guide](https://playwright.dev/docs/locators) explains auto-waiting. These are guidance, not universal lint rules. In particular, fixed waits can be intentional during debugging, and a code pattern alone cannot establish flakiness. The [configuration reference](https://playwright.dev/docs/test-configuration) is the source for `testDir` semantics.

Do not add subjective checks for POM shape, fixture architecture, retries, traces, or project counts without a separate, validated rule contract. A controlled with/without-Scout agent evaluation is still required before claims of token savings or productivity gains.

## Ordered milestones

For each implementation milestone: focused tests, `npm run check`, progress update, and one Conventional Commit. Never publish automatically.

- [x] **D0 — Contract and baselines.** Freeze command shape and limited rules above; capture representative fixtures, expected findings, non-findings, and unsupported cases. No production behavior change.
- [ ] **D1 — Doctor.** Implement the static config-path check and deterministic text/JSON CLI output. Verify missing/dynamic config, literal existing/missing paths, and zero exit code for advice.
- [ ] **D2 — Review.** Implement safe file validation and the two conservative AST rules. Test true and false positives, path escape, output ordering, and no index requirement.
- [ ] **D3 — Documentation and installed skill.** Update CLI/README/skill, verify the packaged skill copy and installed CLI, record limitations and an opt-in real-suite smoke check. Do not add a routine review step or claim agent-level gains.
