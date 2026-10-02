# P0 baseline and contract

Recorded on 2026-10-02 against the checked-in sample suite and the CLI before P0's package change. This is a product behavior baseline, not an agent evaluation. The v0.4 pilot remains incomplete.

## Current command and skill behavior

| Surface         | Current contract and observed limit                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `map`           | Reads Playwright source statically and writes `.scout/index.json`; `--if-stale` skips an unchanged index. On `fixtures/sample-suite`, `map --no-timestamp --json` reports 4 specs, 7 tests, 7 helpers and `.scout/index.json`. `--no-timestamp` makes `generatedAt` null.                                                            |
| `context`       | Reads an existing index; returns text or JSON. Default `--limit` is 8 and `--max-chars` is 6000 (minimum 500). The bound applies to serialized characters, with omission counts, not exact model tokens. It reports `staleIndex` when source/config files changed since mapping. Missing/invalid index exits 4.                      |
| `impact`        | A symbol query reports known direct specs and linked tests; `--file` reports known affected tests with reasons. Static links are incomplete, so an empty result does not prove no impact. `LoginPage.login` on the sample reports two login tests in `tests/login.spec.ts`.                                                          |
| Bundled skill   | Scout queries are optional for a narrow local edit. When reuse or impact is unclear, it recommends `map --if-stale`, a bounded `context`, inspection of cited source, then targeted `find`/`show`/`impact` as needed. `doctor` and `review` require an explicit setup or code-review request.                                        |
| `install-skill` | Copies the bundled `SKILL.md` into `.claude/skills/playwright-scout`, `.agents/skills/playwright-scout`, `.github/skills/playwright-scout`, or `.cursor/skills/playwright-scout` under `--root`. Default target is `agents`; `all` copies to all four. Existing files are skipped unless `--force`; only Claude supports `--global`. |

The sample `context coupon --json` currently cites `CheckoutPage.applyCoupon` at `pages/checkout.page.ts:5`, `COUPON_CODE` at `utils/data.ts:2`, and the coupon test at `tests/checkout.spec.ts:7`. Its current JSON is 824 characters including the trailing newline. An unrelated query, `unrelated new visual layout`, yields no reuse symbols but still cites the registration test as an analogous test. This is a reproducible false suggestion for P1 to address; it must not be treated as a useful match.

## Representative P1 tasks

1. Useful match: add or maintain a coupon checkout test in the sample suite. Expected evidence: existing coupon helper, data constant, and checkout test, each with a source location. Inspect source before reuse.
2. No useful match: ask for an unrelated visual-layout test. Expected behavior: no suggested analogue or reuse symbol unless source evidence supports it. Report uncertainty and let the assistant inspect the suite directly.
3. Stale index: map the sample, add or change a source/config file, then query `context coupon`. Expected behavior: mark the index stale and recommend refresh before relying on citations. The CLI test suite already exercises new source, new config, and removed source cases.

## Measurement contract

Judge qualified task completion and major defects first. When the user resumes agent trials, record provider-reported total input plus output tokens, cached and uncached input separately, output tokens, elapsed time, Scout calls and output size, other command/output behavior, and retries. Preserve the v0.4 protocol's thresholds and label the two existing same-task pairs as feasibility observations only. A smaller character-limited brief is not a token or quality result.

## P0 verification

`npm run check` passed (102 tests). Both local package tarballs installed in a fresh temporary project with host TypeScript 7.0.2; npm installed TypeScript 5.9.3 under Scout core, and the packed CLI mapped the sample suite with the expected 4 specs, 7 tests, and 7 helpers. This verifies the package shape and parser at that host version; it does not validate the full paused agent workflow.
