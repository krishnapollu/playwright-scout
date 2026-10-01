# v0.3 opt-in guidance smoke evaluation

The checks below exercise static advice, not test execution, flakiness detection, or agent productivity. All findings remain non-blocking.

## Deterministic fixture

`fixtures/guidance-suite` has a literal `testDir` pointing to a missing directory. `doctor --json` returns one `config.test-dir-missing` finding at `playwright.config.ts:3` and exit code 0. `review --file tests/example.spec.ts --json` returns `test.fixed-wait` at line 4 and `test.manual-visibility-assertion` at line 5, also with exit code 0. The existing web-first assertion and unrelated method named `waitForTimeout` produce no findings. Focused tests cover missing/dynamic config, aliases, malformed source, and invalid/escaping paths.

## Public-suite smoke checks

The same local checkouts used in [v0.2 evaluation](EVALUATION-v0.2.md) were inspected without running analyzed code or changing those repositories:

| Suite | `doctor` | Single-file `review` |
| --- | --- | --- |
| Microsoft Playwright examples | No findings or unknowns | `tests/clock/clock.spec.ts`: no findings |
| Checkly Playwright examples | No root config found; reported as unknown | `fixtures-rock/tests/example-1.spec.ts`: no findings |

These empty results do **not** validate the suites or the recall of the rules. The rules intentionally match only a small, provable syntax subset.

## Package and skill verification

Both 0.3.0 tarballs passed content review. A fresh temporary consumer installed both tarballs, ran `doctor` and `review` on the guidance fixture, and exercised existing `map`, `context`, and `impact --file` on the sample suite. `install-skill` produced a byte-identical copy of the source skill. The skill's frontmatter and placeholder check passed manually; the bundled Python validator could not run because PyYAML is not installed in this environment. No package was published.

No controlled agent comparison or model-token measurement was performed. Scout still makes no token-savings or productivity claim.
