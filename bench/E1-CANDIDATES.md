# v0.4 E1 — Public-suite and pilot-task candidates

Status: **candidate design, not frozen and not scored**. The user chose public suites only. No agent/model runs have been performed. Source checkouts and baseline dependencies used for screening are temporary and are not part of this repository.

## Scope and interpretation

This is a candidate set for the controlled with/without-Scout evaluation in [the v0.4 protocol](../docs/SPEC-v0.4.md). The following trace labels are generated for this design, not business requirements:

- `REQ-001`: A test-authoring task offers an appropriate existing helper, fixture, or analogous test that an agent might reuse.
- `REQ-002`: A maintenance task changes an existing helper/POM contract while preserving the intended test behavior.
- `REQ-003`: Include a suite with weak or absent Scout links, so the workload does not select only favorable cases.

## Candidate suite screening

All counts are from `playwright-scout map --no-timestamp` at the pinned checkout. They describe what Scout currently indexes, not the total quality or coverage of the projects.

| Public suite and pinned revision | Indexed specs / tests / helpers | Link shape | Candidate role | Unverified setup risk |
| --- | ---: | --- | --- | --- |
| [DJLatkas/playwright-suite-demo](https://github.com/DJLatkas/playwright-suite-demo) `85584bd2cf01da87fec35ff48a18883f7e160bdb` | 9 / 108 / 16 | 9 fixtures, 8 with proven providers; 56 tests have linked calls | POM/fixture-rich local-app tasks | One API and one Chromium UI baseline pass; full task-specific checks still need validation |
| [formkit/auto-animate](https://github.com/formkit/auto-animate) `06882a8e69ba9bc8456d8f2ae6010f697fd7a37c` | 12 / 22 / 8 | No POMs/fixtures; 19 tests have linked calls | Real library with reusable test utilities but no POM | pnpm/docs server and browser setup not yet verified |
| [withastro/starlight](https://github.com/withastro/starlight) `e4a3d82262d62677665cf2dd5ad9a1ba3ae2aa6a`, Scout root `packages/starlight` | 7 / 62 / 8 | One test has a linked call; no indexed fixtures | Real product with deliberately weak current links | Monorepo install/build and targeted checks may be expensive |

The older Microsoft and Checkly example checkouts are too small and fragmented for the main result. [frontendrelease/playwright-enterprise-framework](https://github.com/frontendrelease/playwright-enterprise-framework) and [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps) were also screened as backups: the former is another demonstration framework, while the latter has seven spec files and no linked test calls at the screened revision. Neither is frozen into the main set. The three candidates above are diverse but still not proof of generality; only one is a POM-heavy framework.

## Ambiguities before freezing

- Only the first suite's installation and representative API/UI baseline checks have been verified. A case whose check depends on unavailable browsers, network services, or unstable fixtures must be replaced or explicitly marked `runtime not assessed` **before** any agent result is seen.
- The agent/model, reliable token telemetry, run budget, and two blind reviewers are undecided. No model run is authorized yet.
- Main-task prompts and gold evidence must be stored separately in the harness so an agent cannot read the answer key. These candidate cases are for human design review only.
- Four pilot cases below are not the 12 main tasks required by E1. They are not selected because Scout succeeds on them; one suite has no POM and another has weak indexed links.

## Conditional pilot task cases

These are intended agent work requests, not tests already executed. `steps` describe the requested work. Exact run commands and baseline pass/fail must be verified in E1 before a case is frozen.

```yaml
id: TC-001
scenario: Add API coverage for reports summary arithmetic
objective: Measure reuse of an existing authenticated API fixture and client method when authoring a new test.
preconditions: Public suite playwright-suite-demo at the pinned revision; local app and Chromium check verified before freezing.
test_data: Existing seeded users; do not require a fixed total count.
steps:
  - Add one API test for GET /api/reports/summary in the existing API spec.
  - Check that total equals active plus inactive and equals the sum of the three role counts.
expected_result: The new test checks a successful response and both arithmetic invariants without hard-coded user counts or a duplicate API client.
priority: High
test_type: Integration
requirement_traceability: [REQ-001]
suite: playwright-suite-demo
source_evidence: src/api/endpoints/UsersApi.ts#getReportsSummary; src/fixtures/index.ts#authedApi; app/routes/api.ts GET /reports/summary
check_to_verify: Targeted API spec plus typecheck; exact command pending baseline setup.
```

```yaml
id: TC-002
scenario: Complete the ReportsPage summary reader API
objective: Measure maintenance of an existing POM method pattern and its dependent test.
preconditions: Public suite playwright-suite-demo at the pinned revision; targeted reports check verified before freezing.
test_data: Existing reports fixture and seeded users.
steps:
  - Add a ReportsPage method for reading the inactive summary count, consistent with the existing total and active readers.
  - Update the summary-card test to use that method instead of parsing the locator in the test.
expected_result: The arithmetic assertion remains intact, the test no longer parses the inactive count inline, and no second ReportsPage class is introduced.
priority: Medium
test_type: Regression
requirement_traceability: [REQ-002]
suite: playwright-suite-demo
source_evidence: src/pages/ReportsPage.ts#getSummaryTotal/getSummaryActive; tests/e2e/reports.spec.ts summary-card test
check_to_verify: Targeted reports spec plus typecheck; exact command pending baseline setup.
```

```yaml
id: TC-003
scenario: Add list item-count regression coverage
objective: Measure test authoring in a suite with reusable utilities but no POM/fixture layer.
preconditions: Public suite auto-animate at the pinned revision; docs server and Chromium check verified before freezing.
test_data: The existing /lists demo page and its Add Fruit and Remove controls.
steps:
  - Add a Playwright test that records the initial fruit-item count, adds one fruit, then removes one fruit.
  - Assert the count increases by one and returns to the initial value, and check for console errors using the suite's existing utility.
expected_result: The test verifies both count transitions without assuming the initial count or adding a new page object.
priority: Medium
test_type: Functional
requirement_traceability: [REQ-001, REQ-003]
suite: auto-animate
source_evidence: tests/e2e/animations.spec.ts; tests/e2e/offscreen.spec.ts; tests/e2e/utils.ts#assertNoConsoleErrors
check_to_verify: Targeted Chromium spec; exact command pending baseline setup.
```

```yaml
id: TC-004
scenario: Cover relative URL resolution in the Starlight test helper
objective: Measure a focused maintenance/test task where Scout currently has few linked test calls.
preconditions: Public suite starlight at the pinned revision; package-level Playwright setup verified before freezing.
test_data: Relative paths /tabs and tabs, with an optional query and fragment supplied by the test.
steps:
  - Add coverage showing that StarlightPage.resolveUrl produces the same local-server URL for leading and non-leading slash forms.
  - Include a query-and-fragment case without hard-coding the ephemeral server port.
expected_result: Both forms resolve to the same server-relative URL and preserve query/fragment text; no duplicate URL-building helper is added.
priority: Medium
test_type: Regression
requirement_traceability: [REQ-002, REQ-003]
suite: starlight
source_evidence: packages/starlight/__e2e__/test-utils.ts#StarlightPage.resolveUrl; packages/starlight/__e2e__/basics.test.ts testFactory/getProdServer usage
check_to_verify: Targeted package-level Playwright check; exact command pending baseline setup.
```

## Baseline setup observed so far

For `playwright-suite-demo`, `npm ci --ignore-scripts`, `npm run typecheck`, and Playwright test listing passed. A targeted API test (`GET /api/users` returns an array and total count) passed. The first Chromium UI attempt failed because its pinned Playwright version needed a different browser binary; after installing that Chromium build in temporary storage, the reports summary-card baseline passed. The local web server needed an unsandboxed loopback bind in this environment. Neither attempt is an agent result, and the temporary browser path must be supplied consistently to both future arms.

## Coverage analysis

- Dimensions covered so far: new test authoring, POM maintenance, fixture/API reuse, reusable test utility, and weak-link/no-POM projects.
- Traceability: `REQ-001` → TC-001, TC-003; `REQ-002` → TC-002, TC-004; `REQ-003` → TC-003, TC-004.
- Missing: eight more main-task cases, verified baseline commands for every case, a true no-relevant-match task, independently checked gold evidence, and blind-review rubric assignment. The pilot cannot support a token/productivity claim.
- Assumption: the source code at the pinned revisions describes the intended behavior; runtime behavior remains unverified.
- Next step: validate the remaining suites and task-specific checks, replace any infeasible case before agent runs, then complete and freeze the 12-task main set.

## Regression and security notes

Run evaluation changes only in isolated copies of these public repositories. Do not use live shops, real accounts, external credentials, or mutable shared services. Existing tests may launch local servers or write artifacts; inspect and constrain each targeted command before use.
