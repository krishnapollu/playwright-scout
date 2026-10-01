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
| [formkit/auto-animate](https://github.com/formkit/auto-animate) `06882a8e69ba9bc8456d8f2ae6010f697fd7a37c` | 12 / 22 / 8 | No POMs/fixtures; 19 tests have linked calls | Real library with reusable test utilities but no POM | One Chromium baseline passes with a pinned browser and root Vite binary on `PATH` |
| [withastro/starlight](https://github.com/withastro/starlight) `e4a3d82262d62677665cf2dd5ad9a1ba3ae2aa6a`, Scout root `packages/starlight` | 7 / 62 / 8 | One test has a linked call; no indexed fixtures | Real product with deliberately weak current links | Tabs and SSR not-found baselines pass; exact proposed changes remain unverified |

The older Microsoft and Checkly example checkouts are too small and fragmented for the main result. [frontendrelease/playwright-enterprise-framework](https://github.com/frontendrelease/playwright-enterprise-framework) and [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps) were also screened as backups: the former is another demonstration framework, while the latter has seven spec files and no linked test calls at the screened revision. Neither is frozen into the main set. The three candidates above are diverse but still not proof of generality; only one is a POM-heavy framework.

## Ambiguities before freezing

- All three suites have representative baseline checks, but exact task-specific checks remain unverified. A case whose check depends on unavailable browsers, network services, or unstable fixtures must be replaced or explicitly marked `runtime not assessed` **before** any agent result is seen.
- The agent/model, reliable token telemetry, run budget, and two blind reviewers are undecided. No model run is authorized yet.
- Main-task prompts and gold evidence must be stored separately in the harness so an agent cannot read the answer key. These candidate cases are for human design review only.
- The first four cases below are pilot candidates. The remaining eight bring the design inventory to 12, but none are frozen until their individual baseline check, gold evidence, and independent review are complete. One suite has no POM and another has weak indexed links.

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

## Additional main-set candidates (not for the pilot)

```yaml
id: TC-005
scenario: Add API coverage for reports activity after user creation
objective: Measure reuse of the authenticated API fixture, activity client method, and unique data helper.
preconditions: Public suite playwright-suite-demo at the pinned revision; local app and targeted API check verified.
test_data: One new user with a unique name and email, not a seeded user.
steps:
  - Add an API test that creates a user and then reads the reports activity endpoint.
  - Assert an add activity entry refers to that same unique user.
expected_result: The test checks the matching action/user without assuming global activity-log length or ordering and relies on fixture cleanup.
priority: Medium
test_type: Integration
requirement_traceability: [REQ-001]
suite: playwright-suite-demo
source_evidence: src/api/endpoints/UsersApi.ts#getReportsActivity/createUser; src/fixtures/index.ts#authedApi; app/routes/api.ts GET /reports/activity
check_to_verify: Targeted API spec and typecheck; unique-user behavior and baseline pending.
```

```yaml
id: TC-006
scenario: Cover unauthenticated reports API access
objective: Measure whether an agent follows the existing API auth-test convention without creating new fixtures.
preconditions: Public suite playwright-suite-demo at the pinned revision; local API check verified.
test_data: No auth token.
steps:
  - Add one API test for unauthenticated GET /api/reports/summary.
  - Assert the response is unauthorized without relying on exact error text.
expected_result: The test uses the existing unauthenticated API client fixture and verifies the route's 401 status.
priority: Medium
test_type: Negative
requirement_traceability: [REQ-001]
suite: playwright-suite-demo
source_evidence: tests/api/users.spec.ts Users auth guard; src/fixtures/index.ts#usersApi; app/routes/api.ts requireAuth on /reports/summary
check_to_verify: Targeted API spec and typecheck; exact baseline pending.
```

```yaml
id: TC-007
scenario: Cover replacing a fruit without changing list length
objective: Measure a new state-transition test where no page object exists to reuse.
preconditions: Public suite auto-animate at the pinned revision; local docs server and Chromium check verified.
test_data: The /lists page with its initial fruit basket.
steps:
  - Add a Playwright test that records list count and item texts, then clicks Replace Fruit once.
  - Assert the count is unchanged and the item-text set changes.
expected_result: The test checks the observable replacement without relying on insertion position or a hard-coded initial count.
priority: Medium
test_type: Functional
requirement_traceability: [REQ-003]
suite: auto-animate
source_evidence: docs/src/pages/PageList.vue#replace; tests/e2e/animations.spec.ts /lists setup
check_to_verify: Targeted Chromium spec; replacement behavior and baseline pending.
```

```yaml
id: TC-008
scenario: Cover the disable and re-enable control state
objective: Measure incremental authoring around an existing test and utility without expanding to POM advice.
preconditions: Public suite auto-animate at the pinned revision; local docs server and Chromium check verified.
test_data: The home-page disable example, initially enabled.
steps:
  - Extend or add a test that checks the disable button's label before and after two clicks.
  - Check that console errors were not emitted during the interaction.
expected_result: The label switches from Disable to Enable and back, and the existing console-error helper is reused.
priority: Medium
test_type: Regression
requirement_traceability: [REQ-001, REQ-003]
suite: auto-animate
source_evidence: docs/src/examples/disable/ActualDisable.vue; tests/e2e/disable.spec.ts; tests/e2e/utils.ts#assertNoConsoleErrors
check_to_verify: Targeted Chromium spec; exact accessible label and baseline pending.
```

```yaml
id: TC-009
scenario: Replace fixed sleeps in two animation assertions
objective: Measure maintenance of existing tests using observable animation state instead of elapsed time.
preconditions: Public suite auto-animate at the pinned revision; two targeted animation tests verified.
test_data: The /lists and /tests demo interactions already exercised by animations.spec.ts.
steps:
  - Replace the 50 ms fixed waits preceding the active-animation assertions in both tests with bounded condition-based waiting.
  - Preserve the assertion that each interaction triggers at least one active animation.
expected_result: Both tests keep checking active animation behavior and pass without those fixed 50 ms sleeps; no product code is changed.
priority: High
test_type: Regression
requirement_traceability: [REQ-002, REQ-003]
suite: auto-animate
source_evidence: tests/e2e/animations.spec.ts; tests/e2e/utils.ts#withAnimationObserver/waitForActiveAnimations
check_to_verify: Both targeted Chromium animation tests; baseline and flake check pending.
```

```yaml
id: TC-010
scenario: Assert the SSR not-found response status
objective: Measure a small Playwright assertion change in a fixture-driven product suite with weak Scout call links.
preconditions: Public suite starlight at the pinned revision; package-level SSR test verified.
test_data: Existing /not-found fixture route.
steps:
  - Extend the SSR not-found test to assert the navigation response status as well as the existing server-rendered marker.
expected_result: The test verifies the route's actual HTTP status without dropping its existing content assertion.
priority: Medium
test_type: Regression
requirement_traceability: [REQ-003]
suite: starlight
source_evidence: packages/starlight/__e2e__/ssr.test.ts Render 404 page; packages/starlight/__e2e__/test-utils.ts#StarlightPage.goto
check_to_verify: Confirm the pinned route returns 404, then run targeted package-level Playwright test; otherwise replace this case before freezing.
```

```yaml
id: TC-011
scenario: Consolidate repeated SSR/prerender comparison setup
objective: Measure maintenance of shared Playwright test setup without changing product code or behavior.
preconditions: Public suite starlight at the pinned revision; both comparison tests verified.
test_data: Existing /content and / routes under SSR and prerender modes.
steps:
  - Extract the repeated server creation, response text retrieval, and equivalent-HTML assertion into a local helper.
  - Use it from both existing SSR/prerender comparison tests.
expected_result: Both tests still compare normalized HTML for their original routes, keep the required environment-mode handling, and pass without duplicated setup blocks.
priority: Medium
test_type: Regression
requirement_traceability: [REQ-002, REQ-003]
suite: starlight
source_evidence: packages/starlight/__e2e__/ssr.test.ts two comparison tests and expectEquivalentHTML
check_to_verify: Both targeted package-level Playwright tests; baseline pending.
```

```yaml
id: TC-012
scenario: Exercise keyboard selection of a tab absent from its synced peer
objective: Measure new browser-test design using an existing analogous click case and keyboard pattern.
preconditions: Public suite starlight at the pinned revision; tabs fixture and targeted Chromium check verified.
test_data: Existing /tabs fixture with two package tab groups, one containing a bun-only item.
steps:
  - Add a Playwright test that selects the bun-only tab in the second group by keyboard.
  - Assert the second group selects bun while the first group remains on its existing shared selection.
expected_result: Keyboard interaction does not force a nonexistent tab selection in the peer group; the test uses the existing tabs fixture and helper style.
priority: Medium
test_type: Functional
requirement_traceability: [REQ-001, REQ-003]
suite: starlight
source_evidence: packages/starlight/__e2e__/basics.test.ts keyboard event and different-tab-items cases
check_to_verify: Targeted package-level Playwright test; exact keyboard path and baseline pending.
```

## Baseline setup observed so far

For `playwright-suite-demo`, `npm ci --ignore-scripts`, `npm run typecheck`, and Playwright test listing passed. A targeted API test (`GET /api/users` returns an array and total count) passed. The first Chromium UI attempt failed because its pinned Playwright version needed a different browser binary; after installing that Chromium build in temporary storage, the reports summary-card baseline passed. The local web server needed an unsandboxed loopback bind in this environment. Neither attempt is an agent result, and the temporary browser path must be supplied consistently to both future arms.

For `auto-animate`, the pinned pnpm 10.14.0 installed locked dependencies with lifecycle scripts disabled, and the Chromium test list loaded. Its first test attempt failed because the config changes directory before launching Vite and the root binary was not on `PATH`. With the root `node_modules/.bin` prepended and a pinned headless Chromium downloaded to temporary storage, `Animations on examples › list page animates on add/remove` passed. Both arms must receive this same environment setup; the failure is an instrumentation/setup issue, not a Scout result.

For `starlight`, pinned pnpm 11.22.0 installed the 16-workspace lockfile with lifecycle scripts disabled. Package-level Playwright test listing loaded. With its pinned headless Chromium in temporary storage, one tabs sync baseline and the existing SSR not-found baseline passed. Its `testFactory` builds a fixture site during each targeted run, so wall time and build side effects must be measured consistently in both arms. The not-found test currently checks rendered content, not response status; TC-010 remains conditional until the 404 status is confirmed.

## Coverage analysis

- Dimensions covered in the candidate inventory: new test authoring, negative API coverage, POM and test maintenance, fixture/API reuse, animation state transitions, and weak-link/no-POM projects.
- Traceability: `REQ-001` → TC-001, TC-003, TC-005, TC-006, TC-008, TC-012; `REQ-002` → TC-002, TC-004, TC-009, TC-011; `REQ-003` → TC-003, TC-004, TC-007, TC-008, TC-009, TC-010, TC-011, TC-012.
- Missing: verified task-specific checks for every case, a deliberately low-context/no-reuse task, independently checked gold evidence, and blind-review rubric assignment. The 12 cases are candidates, not the frozen main set; the pilot cannot support a token/productivity claim.
- Assumption: the source code at the pinned revisions describes the intended behavior; runtime behavior remains unverified.
- Next step: validate task-specific checks, replace weak or infeasible cases before agent runs, then review and freeze the 12-task main set. Choose the agent/model, token telemetry, run budget, and reviewers only after that design review.

## Regression and security notes

Run evaluation changes only in isolated copies of these public repositories. Do not use live shops, real accounts, external credentials, or mutable shared services. Existing tests may launch local servers or write artifacts; inspect and constrain each targeted command before use.
