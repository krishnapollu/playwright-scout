# Index Schema

The generated `.scout/index.json` uses schema version `1`. `readIndex()` validates every field with Zod. Paths are POSIX and relative to the indexed project root; output arrays and derived string lists use deterministic ordering.

## Top-Level Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Index format version, currently `1` |
| `generator` | Generator name and package version |
| `generatedAt` | ISO timestamp, or `null` for deterministic builds |
| `project` | Config path, test directory/matches, Playwright projects, language, helper directories |
| `stats` | Counts for specs, tests, helpers, methods, page objects, fixtures, tags, parsed/skipped files |
| `specs` | Spec file path, test count, and tags |
| `tests` | Test ID, source position, title, suite path, modifiers, tags, fixtures, helper calls, and navigation URLs |
| `helpers` | Exported function, class, and constant metadata; classes include public/protected methods |
| `fixtures` | Fixture name, scope, options, dependencies, and extended test object |
| `tags` | Tag names and number of tests carrying each tag |
| `diagnostics` | Static-analysis warnings and informational messages |

## IDs

- Spec: `spec:<file>`
- Test: `test:<file>::<suite path > title>`
- Helper: `helper:<file>#<declaration>`
- Method: `helper:<file>#<Class>.<method>`
- Fixture: `fixture:<file>#<name>`

Helper usage counts are distinct referencing spec files. `referencedByFiles` is distinct, sorted, capped at 25, and reports truncation separately. See [SPEC.md](SPEC.md) for the complete field definitions and analysis rules.
