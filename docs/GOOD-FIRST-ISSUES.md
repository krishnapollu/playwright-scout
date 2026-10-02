# Good first issues

## Support CommonJS projects

Description: Detect `require` and `module.exports` patterns and index a small supported subset.

Acceptance criteria: add fixtures for the chosen patterns; document unsupported cases; preserve ESM behavior; all checks pass.

## Add search synonyms

Description: Extend the built-in synonym table for one clearly scoped domain vocabulary group.

Acceptance criteria: add exact and synonym ranking tests; synonym matches remain below equivalent exact matches; document the terms.

## Clarify `find --kind helper` result labels

Description: `--kind helper` filters the helper collection, but matching results expose their subtype (`class`, `function`, or `constant`) as `kind`. Add a small CLI regression test and clarify this behavior in the CLI reference so users understand the filter and output labels.

Acceptance criteria: `find coupon --kind helper --json` on the sample suite has a test asserting a helper result and its subtype; `docs/CLI.md` explains the distinction; method and test filters remain unchanged.

## Score page-object method names

Description: Evaluate whether method names should receive a distinct search weight from helper class names.

Acceptance criteria: add a fixture demonstrating the desired ordering, implement the smallest scoring change, and keep existing scoring tests green.

## Add a Page Object Model example

Description: Add a concise README example showing a page object, fixture, and spec, using only supported syntax.

Acceptance criteria: the example is runnable or clearly marked as illustrative, includes `map` and `find`, and does not claim unsupported runtime behavior.

## Add `plan --json` output-format coverage

Description: `packages/cli/test/bin.test.ts` has no `plan` command coverage, including its `--json` output contract. Add a focused regression test using the sample suite.

Acceptance criteria: assert exit code 0 and parseable JSON with stable plan fields; use `fixtures/sample-suite`; do not change the JSON schema.
