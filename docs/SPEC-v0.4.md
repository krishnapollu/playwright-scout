# playwright-scout v0.4 — Controlled agent evaluation (draft)

Status: **two feasibility pairs on one task completed; planned pilot and main evaluation not completed**. See [the pilot report](PILOT-v0.4.md). This is an evaluation milestone, not a new Scout command or package release. The v0.1–v0.3 specifications remain the product contracts.

## 1. Decision to answer

Does giving a coding agent Scout's installed skill and CLI access help it complete real Playwright suite-creation and maintenance tasks with less total model-token use **without reducing change quality**? The current five-task context smoke test measures brief size and evidence presence only. It cannot answer this question.

The experiment must be specified and scored before outcomes are inspected. Negative or mixed results are useful: they should direct changes to indexing, ranking, skill instructions, or output size. Do not turn shorter text alone into a productivity claim.

## 2. Boundary

- Keep the experiment under `bench/` and its report under `docs/`. It must not be a Scout runtime dependency, a mandatory skill step, or a new product CLI command.
- Keep evaluated Playwright projects standalone. Prepare two isolated copies of the same external source snapshot rather than embedding their suites in this repository.
- Use Codex as the sole agent in both arms. No second agent is needed for this evaluation.
- Scout remains a static, local analyzer. The harness may invoke an external coding agent **only when a maintainer explicitly runs it**; core and CLI never call a model, run analyzed project code, or ingest Logbook artifacts.
- Logbook owns run and failure records. The harness may run task-specific Playwright tests for scoring, but does not add runtime ingestion to Scout.
- Never publish, push, or send source to a hosted model as part of an automatic check. Obtain the suite owner's permission before using private code with any external provider. Do not store secrets, prompts containing credentials, raw traces, or full private diffs in checked-in results.
- Preserve ordinary test-project conventions. Do not use `doctor` or `review` in the treatment unless the task explicitly asks for framework guidance; they are not part of the authoring workflow being measured.

## 3. Units, sample, and arms

The unit of comparison is a **task at a pinned project revision**, not a context query. A pilot of 4–6 tasks checks that tasks and instrumentation work; it does not support a product claim. The main evaluation targets at least 12 independently specified tasks across at least three non-trivial suites, with at least four tasks per suite and two fresh runs per arm per task (minimum 48 runs). Small public example repos and `fixtures/sample-suite` may validate the harness but cannot be the only evidence for a general claim. If suitable suites or consent are unavailable, stop at a feasibility report and do not claim efficacy.

Task mix: new tests that should reuse existing POM/fixture/helper code; maintenance of an existing helper/POM/fixture; and impact-aware changes. Include tasks where Scout might have no relevant match, to measure unhelpful overhead. Do not choose tasks solely because current Scout output looks good. Exclude tasks requiring live business knowledge unless the same written acceptance criteria are supplied to both arms.

For each task, start both arms from the same immutable base commit and identical task request, acceptance criteria, tool permissions, model/version, inference settings, time limit, and total context-window cap:

- **Control:** ordinary repository and coding tools; no Scout skill or Scout CLI/index. The agent may inspect the suite normally.
- **Scout:** the same environment plus the installed Scout skill and local CLI/index. The agent decides which Scout queries to use. Do not inject a hand-picked brief into its prompt or require it to call every command.

Prepare fresh isolated worktrees or copies per run. Do not let runs share generated indexes, agent memory, cache entries containing prior task answers, test outputs, or modified files. Randomize arm order within each task/repetition, and record the order and random seed. Freeze the exact Scout package commit, skill text, task manifest, scoring rules, and model version before the main evaluation. If the provider changes the model mid-run, label the affected runs and do not pool them silently.

## 4. Task manifest and evidence

Each checked-in public task manifest entry contains: stable task ID, suite identifier and pinned revision, task prompt, allowed paths/actions, acceptance criteria, expected reusable symbol(s) where objectively known, forbidden duplicate patterns where applicable, deterministic checks, and a note explaining why the task is representative. Private task manifests may stay outside the repo; checked-in reports use redacted IDs and aggregates.

Scoring must not rely on title similarity alone. Before the agent runs, a maintainer records the gold evidence for each task: relevant source references, expected behavior, and whether reuse is appropriate. A second reviewer checks ambiguous cases. Gold evidence is hidden from both arms. For tests requiring an app or credentials, use a reproducible local fixture or mark the runtime check unavailable in advance; do not change the scoring rule after seeing a result.

The harness records per run: task/arm/repetition IDs; pinned hashes and configuration; agent exit status; elapsed wall time; tool-call count; input and output tokens **as reported by the provider**; cached-input and reasoning-token breakdowns when available; billed cost if available; Scout command calls and their output sizes; check results; final diff hash; and any instrumentation failure. Keep local raw logs separate from sanitized checked-in summaries. If actual token usage is unavailable for an arm, label the pair unmeasured for token claims; character-count proxies are not substitutes.

## 5. Outcomes and scoring

Primary outcomes are measured over **all scheduled runs**, including failures and timeouts:

1. **Qualified completion:** the requested change meets prewritten acceptance criteria, passes the task's applicable deterministic checks, and has no major defect in blind review. Missing runtime checks are `not assessed`, never `pass`.
2. **Total model tokens per task:** provider-reported input + output tokens, including exploration, Scout interactions, retries, and final response. Reasoning tokens are normally a subset of output tokens and cached tokens a subset of input tokens; report those breakdowns separately and never add them twice. Also report billed cost if available. Tool output that enters the model context is counted through provider usage; CLI output characters are a diagnostic, not the token metric.

Secondary outcomes: elapsed time, number of model turns/tool calls, reuse of appropriate existing code, unnecessary new helpers/POMs, test maintainability, and known-impact accuracy where applicable. Two reviewers, blind to arm and Scout logs, score each final diff against a short rubric (behavior, maintainability, unnecessary duplication, major defect). Resolve disagreements before unblinding and report agreement/disagreements. Reviewers should not infer treatment from filenames or generated comments; redact these where practical without changing the code being judged.

Report per-task paired data and aggregate medians/ranges, not just a mean or a single headline percentage. Show completion and token distributions by suite and task type. Do not discard failed runs from the token denominator; a successful-only token comparison is secondary and labeled as such. Record exclusions, instrument failures, and any deviations from the frozen protocol.

## 6. Predeclared interpretation

The main report may say Scout improved **this evaluated workload** only if:

- qualified-completion count is no lower than control across the scheduled runs, and blind review finds no greater count of major defects; and
- median paired total-token use across **all** comparable runs is at least 15% lower in the Scout arm; and
- the direction is not driven by a single suite (report each suite separately).

These are practical decision thresholds, not a statistical proof of generality. If a run lacks trustworthy token telemetry, the token claim is withheld even if proxy sizes are smaller. If quality improves but tokens do not, describe the quality result without a token-efficiency claim. If tokens fall but quality worsens, do not claim productivity. If results are mixed or the sample is too small, state that plainly and choose a focused follow-up; do not relax thresholds after seeing results.

## 7. Ordered milestones

Each completed milestone updates `docs/PROGRESS.md`, passes `npm run check` when repository code changes, and receives a Conventional Commit. No automated npm publish or GitHub push is part of the evaluation.

- [x] **E0 — Protocol draft.** Record the question, arms, task mix, telemetry, scoring, thresholds, privacy boundary, and open decisions here. No agent runs.
- [ ] **E1 — Freeze task set.** Select/obtain permission for suitable suites; pin revisions; write at least 12 task manifests and gold evidence; define deterministic checks and blind rubric. Review tasks for leakage and representativeness before seeing treatment results.
- [ ] **E2 — Reproducible harness.** Build isolated-run setup, arm configuration, order randomization, provider-usage capture, sanitized result format, and deterministic scorer. Add fixture-based tests; keep external agent invocation opt-in and out of CI.
- [ ] **E3 — Pilot.** Run 4–6 tasks with both arms; fix only protocol/instrumentation failures, then freeze the main protocol and task set. Report pilot separately, without efficacy claims.
- [ ] **E4 — Main run and blind review.** Complete the scheduled paired runs, collect token/quality data, resolve blind-review disagreements, and publish the full aggregate plus exclusions and limitations in `docs/EVALUATION-v0.4.md`.
- [ ] **E5 — Product decision.** Based on the frozen criteria, choose one focused next step: improve context/ranking, strengthen missing static links, simplify the skill, or proceed to a user-facing release. Do not add speculative features to v0.4.

## 8. Decisions required before E1/E2

1. **Resolved in part:** use Codex for both arms; freeze its exact CLI/model configuration and verify reported token telemetry before paired runs.
2. **Resolved in part:** use public suites for the eventual main evaluation. Candidate repositories and pinned revisions are screened in `bench/E1-CANDIDATES.md`. The owner also authorized sharing local `pw-test` source with Codex for a small pilot; exclude credentials, reports, artifacts, and other non-source data. Do not silently generalize from this one suite.
3. What run budget (money and wall time) is authorized? Forty-eight main runs plus pilot may be substantial; the harness must enforce a per-run cap and stop at the approved total.
4. Who will provide independent blind review, especially for business behavior not inferable from source?

These are execution prerequisites, not reasons to delay drafting the protocol. Do not start agent runs until they are settled.
