# v0.4 Codex feasibility pilot — one paired task

Status: **one-task pilot, not an efficacy result**. This does not complete the 4–6-task pilot or the main evaluation in [SPEC-v0.4.md](SPEC-v0.4.md). No Scout release or product behavior changed.

## Setup and task

The owner authorized sharing local `pw-test` source with Codex for this pilot. Two identical temporary source snapshots were made with `bench/prepare-pw-test.mjs`; the allowlist excluded credentials, `.env`, `node_modules`, prior reports, and artifacts. Both arms installed the same locked dependencies and passed `tsc --noEmit` before the run. Only the Scout arm had the installed skill and a temporary CLI shim. The shim pointed at Scout's built 0.3 CLI because Scout core declares a TypeScript 5 peer while `pw-test` currently uses TypeScript 7; this trial does **not** validate ordinary Scout package installation in that project. No source copies, raw JSONL, or browser artifacts are committed here.

The identical task prompt asked Codex to add a Products-page jeans-search test that verifies at least one displayed product and case-insensitive matching of every displayed product name, without fixed counts or private credentials. This was a small, read-only live-site task. The Codex CLI was `0.155.0-alpha.16.3` with the locally configured `gpt-5.6-luna` model alias, fresh ephemeral sessions, and a 10-minute cap per arm. Order was **control, then Scout**. Scout package source was at `7f95950` (no core/CLI source changes in the pilot). The exact model snapshot behind the alias was not independently verified.

## Observations

| Measure | Control | Scout |
| --- | ---: | ---: |
| Provider-reported input tokens | 228,120 | 181,264 |
| Of those, cached input tokens | 204,032 | 150,272 |
| Output tokens | 1,941 | 2,334 |
| Total input + output tokens | 230,061 | 183,598 |
| Uncached input + output tokens | 26,029 | 33,326 |
| Agent wall time | 60.4 s | 65.6 s |
| Completed shell commands | 7 | 11 |
| Typecheck / targeted Chromium test | Pass / pass | Pass / pass |

Both agents made **the same byte-for-byte change** to one existing spec, reusing its product page object and test data. Scout read its installed skill and successfully ran `map` and `context`; control did not use Scout. After the agent runs, both new tests passed in headless Chromium against the public practice site, and both typechecks passed. An initial browser attempt failed in the evaluation sandbox before Chromium launched; the same targeted checks were rerun with browser permission and passed. The agents' own time measurement excludes these later evaluator checks.

Scout's reported total was 20.2% lower in this pair, but its **uncached input plus output was 28.0% higher**. Cached-input amounts differed substantially, and Scout took slightly longer and used more commands. These measurements show that the telemetry and treatment work; one task in one suite, without repeats or blind review, cannot establish a token-efficiency or productivity benefit. The live site may also change. No billed-cost claim is made.

## Instrumentation notes and next decision

Early launch attempts failed before model work because this installed Codex CLI did not accept the documented `--full-auto` option and then could not initialize inside the outer sandbox. The runner was updated to use its supported bounded approval mode and the pair was rerun with permission. These setup failures had zero completed turns and are excluded as instrumentation failures, not task failures. Raw event logs stay in the temporary pilot directory; the checked-in report contains only aggregate usage and outcomes.

The next useful trial is a different task shape (for example POM maintenance) and a public suite with a locally hosted app. Freeze its prompt and checks first, repeat each arm, and compare both total and uncached token use. Keep the original main-study thresholds unchanged; do not infer a broad claim from this feasibility pair.
