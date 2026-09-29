# CLI Reference

All commands accept `--root <dir>` where supported; it defaults to the current directory.

## `map`

```sh
playwright-scout map [--root <dir>] [--out <file>] [--include <glob...>] [--no-timestamp] [--if-stale] [--json] [--verbose] [--quiet]
```

Builds `.scout/index.json` by default and creates `.scout/.gitignore` if absent. `--out` selects a different index file. `--include` adds root-relative support globs. `--no-timestamp` sets `generatedAt` to `null`; `--if-stale` skips a valid index newer than project source files. `--json` returns the summary object, `--verbose` writes diagnostics to stderr, and `--quiet` suppresses successful summary output.

## `find`

```sh
playwright-scout find <query...> [--kind helper|method|test|fixture|any] [--limit <n>] [--root <dir>] [--json]
```

Searches helpers, class methods, tests, and fixtures. Text mode prints ranked lines; `--json` prints result objects. No matches is a successful command with a message.

## `show`

```sh
playwright-scout show <id-or-label> [--root <dir>] [--json]
```

Shows an exact ID, a unique suffix after `#` or `::`, or a whole label. Ambiguous and missing entries return exit code 5.

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
