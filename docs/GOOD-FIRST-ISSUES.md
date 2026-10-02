# Good first issues

## Support CommonJS projects

Description: Detect `require` and `module.exports` patterns and index a small supported subset.

Acceptance criteria: add fixtures for the chosen patterns; document unsupported cases; preserve ESM behavior; all checks pass.

## Add search synonyms

Description: Extend the built-in synonym table for one clearly scoped domain vocabulary group.

Acceptance criteria: add exact and synonym ranking tests; synonym matches remain below equivalent exact matches; document the terms.

## Investigate `find --kind` edge cases

Description: Reproduce one real edge case where `find --kind` returns an unexpected result or wording.

Acceptance criteria: add a minimal fixture and regression test, define the expected kind behavior, and keep unrelated kind filters unchanged. If no edge case can be reproduced, close with the investigation notes.

## Score page-object method names

Description: Evaluate whether method names should receive a distinct search weight from helper class names.

Acceptance criteria: add a fixture demonstrating the desired ordering, implement the smallest scoring change, and keep existing scoring tests green.

## Add a Page Object Model example

Description: Add a concise README example showing a page object, fixture, and spec, using only supported syntax.

Acceptance criteria: the example is runnable or clearly marked as illustrative, includes `map` and `find`, and does not claim unsupported runtime behavior.

## Add CLI output-format coverage

Description: Add a regression test for one currently untested command's `--json` output contract.

Acceptance criteria: test exit code and parseable JSON fields, use a checked-in fixture, and document any intentional output contract covered.
