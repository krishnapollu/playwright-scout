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
playwright-scout context <query...> [--limit <n>] [--root <dir>] [--json]
```

Combines ranked search matches with related specs, helpers, fixtures, and routes for an agent task.

## `show`

```sh
playwright-scout show <id-or-label> [--root <dir>] [--json]
```

Shows an exact ID, a unique suffix after `#` or `::`, or a whole label. Ambiguous and missing entries return exit code 5.

## `impact`

```sh
playwright-scout impact <id-or-label> [--root <dir>] [--json]
```

Shows indexed tests and helpers related to a helper or method. Missing or ambiguous entries return exit code 5.

## `plan`

```sh
playwright-scout plan <query...> [--limit <n>] [--root <dir>] [--json]
```

Builds a deterministic, evidence-based reuse plan from matching indexed code and its relationships.

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
