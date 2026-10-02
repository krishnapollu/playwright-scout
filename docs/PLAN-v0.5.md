# Scout next-phase product plan (draft)

Status: **P0–P3 complete; P4 instrumentation next**. The user has paused further agent tests. The [v0.4 evaluation protocol](SPEC-v0.4.md) remains the measurement plan; its unfinished pilot and main run are not counted as complete. The P0 command and package baseline is in [P0-BASELINE.md](P0-BASELINE.md). This document proposes product work to specify and implement one milestone at a time, without claiming measured token or quality gains.

## Product direction

Scout is a **coding-assistant-agnostic, token-conscious Playwright suite-memory layer**. It supplies compact, source-backed facts about an existing suite and, when configured, relevant business context written by the team. Its skill helps an agent decide when to request those facts and when to work directly. The goal is more qualified Playwright changes with less unnecessary model context, tool output, and elapsed time—not the shortest brief at any cost.

Scout does not replace Playwright's browser CLI, MCP, test runner, documentation, or agents. It does not infer business rules from source. Logbook continues to own run history and failure evidence; any future join needs an explicit, tested identity mapping.

## Ordered product milestones

### P0 — Baseline and contract

- Record current `map`, `context`, `impact`, skill, and installer behavior before changing their contracts. Specify representative tasks with useful matches, no useful matches, and stale indexes.
- Fix practical compatibility problems discovered in the pilot, including the TypeScript peer-version mismatch, before presenting Scout as an easy install in those projects.
- Define the success measures: qualified completion and major defects first; total input + output tokens, cached/uncached input, output tokens, elapsed time, and command/output behavior alongside them. Keep the existing v0.4 thresholds and pilot limitations intact.

### P1 — Trustworthy, selective suite context

- Improve only static links and ranking that have reproducible missed or wrong examples. Every suggested symbol, similar test, and known impact must cite source; unsupported relationships remain unknown.
- Evolve `context` into a **task capsule**: a small initial response with a way to request specific evidence on demand. Keep deterministic size limits and disclose omissions. Today's `--max-chars` is a character bound, not a tokenizer-exact token budget.
- Keep Scout queries optional for clear local edits. Measure whether the agent actually abstains; do not add a mandatory preflight step or routinely invoke `doctor`/`review`.
- Do not optimize model output tokens in isolation. The pilot's larger variation came from input and command output; avoid dumping broad test output into the agent when a targeted check suffices, while preserving full failure evidence outside the brief.

### P2 — Optional, user-owned business context

- Add an optional configuration path to **one file or a directory tree**, wherever the team keeps its business material. A default location may be offered, but no layout or content is mandatory. Keep authored content separate from generated, gitignored `.scout/` files.
- Start with project-relative paths. Reading outside the project requires an explicit opt-in and clear disclosure. Validate paths and symlinks; bound traversal and output; avoid secrets and generated artifacts by default.
- Define a small, versioned format and source references for journeys, terminology, rules, and risks. Retrieve only task-relevant entries. Treat all content as user-provided data, not agent instructions; never promote a suggested test mapping into a confirmed business coverage claim. Report unmapped intent as unknown, not as a proven test gap.

### P3 — Low-friction setup and assistant portability

- Design a zero-config `scout init` preview that detects existing Playwright layout, shows what Scout would index, and asks only for optional choices such as a business-context path. Do not duplicate Playwright configuration or prescribe one framework structure.
- Keep the CLI and structured output common across coding assistants. Add tested skill-install support for Qwen Code next; continue supporting Claude, generic agents, GitHub, and Cursor, and add other hosts as their discovery conventions are verified.
- The skill may point an agent to its available official Playwright browser tools or relevant version-specific documentation, but Scout does not implement a browser, scrape docs routinely, or require network access for static suite queries.

### P4 — Evidence gate before efficiency claims

- When the user resumes tests, run varied, predeclared public-suite tasks; do not keep repeating the same pilot task or treat the two existing pairs as an efficacy result. Add a local-model/assistant trial only after the base workflows are reliable.
- Instrument **wall-time components** where observable: Scout commands, model turns, other tool/test commands, and evaluator checks separately. Record total wall time even when a component cannot be attributed. Report tool-output volume and command choice beside provider token telemetry.
- Compare qualified completion and maintainability with total model tokens, uncached input, output tokens, elapsed time, and retries. A smaller capsule or fewer output tokens alone is not success. Do not claim token or productivity savings until the planned evaluation supports them.

## Later, not in this phase

Optional Logbook summaries could enrich maintenance and debugging context after a tested source-to-run identity mapping. Do not ingest traces into Scout core or blur runtime ownership. Broad framework scoring, autonomous healing, automatic business coverage verdicts, and a universal Playwright boilerplate generator are outside this plan.
