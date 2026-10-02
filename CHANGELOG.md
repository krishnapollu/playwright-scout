## 0.5.2 - Unreleased

- Documentation and repository cleanup.

## 0.5.1 - 2026-10-02

- Fix exported aliases of local Playwright test objects being indexed as helpers.
- Add built-in search synonyms and CLI `--version` output.
- Refresh launch documentation and mark `doctor` and `review` experimental.

## 0.5.0 - 2026-10-02

- Improve compatibility with TypeScript 7 host projects by using core's own TypeScript compiler dependency.
- Make task capsules selective and bounded; add optional business-context retrieval.
- Add `init` preview and Qwen Code skill installation.
- Add offline timing and output instrumentation for future agent evaluation, without an efficacy claim.

## 0.4.0 - Unpublished

- Specify the controlled agent evaluation protocol and run two feasibility pilots with inconsistent token results.

## 0.3.0 - Unpublished

- Add opt-in `doctor` for static Playwright config-path guidance.
- Add opt-in single-file `review` for conservative fixed-wait and manual visibility assertion suggestions.
- Keep guidance outside normal agent context/reuse workflows and non-blocking.

## 0.2.0 - Unpublished

- Link direct fixture providers and fixture-mediated page object calls in index schema v2.
- Produce bounded, source-backed `context` task briefs with freshness and omission indicators.
- Report known static test impact for a source file with `impact --file`.
- Update the installed agent skill for creation and maintenance workflows.

## 0.1.1 - 2026-10-01

- Include the full project README on the npm CLI package page.

## 0.1.0 - 2026-10-01

- Add a static Playwright suite index with helper, test, fixture, and tag linking.
- Add the `map`, `find`, `show`, and `install-skill` CLI commands.
- Add deterministic search, source diagnostics, and the bundled agent skill.
