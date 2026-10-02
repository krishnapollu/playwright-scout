# CLI Reference

All commands accept `--root <dir>` where supported; it defaults to the current directory.

## `map`

```sh
playwright-scout map [--root <dir>] [--out <file>] [--include <glob...>] [--no-timestamp] [--if-stale] [--json] [--verbose] [--quiet]
```

Builds `.scout/index.json` by default and creates `.scout/.gitignore` if absent. `--out` selects a different index file. `--include` adds root-relative support globs. `--no-timestamp` sets `generatedAt` to `null`; `--if-stale` skips a valid v2 index newer than project source files and rebuilds a v1 index. `--json` returns the summary object, `--verbose` writes diagnostics to stderr, and `--quiet` suppresses successful summary output.

## `find`

```sh
playwright-scout find <query...> [--kind helper|method|test|fixture|any] [--limit <n>] [--root <dir>] [--json]
```

Searches helpers, class methods, tests, and fixtures. Text mode prints ranked lines; `--json` prints result objects. No matches is a successful command with a message.

## `context`

```sh
playwright-scout context <task...> [--limit <n>] [--max-chars <n>] [--root <dir>] [--json]
```

Returns a small task capsule with source-backed reuse candidates, one similar test when evidence is sufficient, setup/data references, observed patterns, and unknowns. The default `--max-chars` is 1800 (minimum 500), including the final newline and JSON syntax. This is a character bound, not a model-specific token count. Omitted items are counted; use `show <cited-id>` for specific evidence or raise `--max-chars` when needed. A stale index is flagged but not rewritten; run `map --if-stale` first. Findings are advisory and do not establish business coverage gaps.

## `show`

```sh
playwright-scout show <id-or-label> [--root <dir>] [--json]
```

Shows an exact ID, a unique suffix after `#` or `::`, or a whole label. Ambiguous and missing entries return exit code 5.

## `impact`

```sh
playwright-scout impact <id-or-label> [--root <dir>] [--json]
playwright-scout impact --file <root-relative-source-file> [--root <dir>] [--json]
```

The entry form shows indexed tests and helpers related to a helper or method. Missing or ambiguous entries return exit code 5. The file form reports `knownAffectedTests` with `direct_spec`, `helper_call`, or `fixture_provider` reasons, plus analysis limits. It accepts only an existing source file inside the root; absolute paths, traversal, and symlink escapes are rejected. An empty list means no affected tests were proven by the index, not that other tests are safe to skip.

## `plan`

```sh
playwright-scout plan <query...> [--limit <n>] [--root <dir>] [--json]
```

Builds a deterministic, evidence-based reuse plan from matching indexed code and its relationships.

## `doctor` and `review` (opt-in)

```sh
playwright-scout doctor [--root <dir>] [--json]
playwright-scout review --file <root-relative-source-file> [--root <dir>] [--json]
```

These advisory commands do not need an index, run tests, or edit code. `doctor` checks whether a literal configured `testDir` exists; missing and dynamic configs are reported as unknown, not defects. `review` inspects one explicitly chosen source file for a fixed wait on a Playwright `page` fixture and an inline-locator manual visibility assertion. It rejects absolute, traversal, missing, and symlink-escape paths and files over 1 MiB. Findings include a rule ID, source line, and official guidance link. Exit code 0 applies even when findings exist. An empty list means only that these limited checks found no match; it is not a suite-quality verdict. Neither command is part of ordinary Scout context/reuse workflows.

## `install-skill`

```sh
playwright-scout install-skill [--target claude|agents|github|cursor|all] [--global] [--force] [--root <dir>]
```

Installs the bundled skill. `--global` is available only for the Claude target.

## Exit Codes

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | Unexpected error |
| 2 | Usage error |
| 3 | No tests found |
| 4 | Index missing or invalid |
| 5 | Entry not found or ambiguous |
