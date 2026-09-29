# playwright-scout

> **Your coding agent finds your existing Playwright helpers before it writes new ones.**

[![CI](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml/badge.svg)](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/playwright-scout)](https://www.npmjs.com/package/playwright-scout)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`playwright-scout` is a **static-analysis CLI + agent skill** for Playwright test projects. It scans your suite *without running it*, builds a searchable JSON index of all tests, page objects, helpers, fixtures, and tags — then lets a coding agent query that index before writing new code, so it **reuses what already exists instead of creating duplicates**.

---

## Why

Large Playwright suites accumulate page objects, auth helpers, and fixture sets over time. When an agent writes a new test, it often re-implements `loginViaApi` or `uniqueEmail` because it can't see what already exists. `playwright-scout` solves that: one command indexes everything, and the agent queries the index before touching a file.

---

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `playwright-scout` | CLI | `map`, `find`, `show`, `install-skill` commands |
| `playwright-scout-core` | Library | Build + query the index programmatically |

---

## Install

```bash
npm install -D playwright-scout
# or use without installing:
npx playwright-scout map
```

---

## Quick start

```bash
# 1. Build the index (run from your project root)
npx playwright-scout map

# 2. Search for something
npx playwright-scout find login

# 3. Inspect a result
npx playwright-scout show LoginPage.login

# 4. Install the agent skill so your AI assistant uses it automatically
npx playwright-scout install-skill
```

---

## CLI commands

### `map` — build the index

```bash
npx playwright-scout map [--root <dir>] [--out <file>] [--include <glob...>] [--no-timestamp] [--if-stale] [--json] [--verbose] [--quiet]
```

Scans `--root` (default: `cwd`), reads `playwright.config.*` statically, discovers spec and support files, and writes `.scout/index.json`.

```
scout: indexed 4 spec files, 7 tests, 7 helpers (2 page objects), 3 fixtures in 0.0s
index: .scout/index.json (schema v1)
helper dirs: pages (2), utils (2), tests/support (1)
warnings: 1 (use --verbose to list)
```

**Flags**
- `--include <glob...>` — add support files matched relative to the project root
- `--if-stale` — skip rebuild if index is newer than all source files
- `--no-timestamp` — omit `generatedAt`; output is byte-identical for the same input (good for CI diffing)
- `--verbose` — print every diagnostic to stderr
- `--json` — print summary as JSON
- `--quiet` — suppress the successful summary

---

### `find` — search the index

```bash
npx playwright-scout find <query...> [--kind helper|method|test|fixture|any] [--limit <n>] [--root <dir>] [--json]
```

Tokenises the query, scores every entry by name / doc / file / tags / navigatesTo, and returns the top matches.

```
class    LoginPage  pages/login.page.ts:3 — Login screen of the app.
method   LoginPage.login(user: string, pass: string)  pages/login.page.ts:9 — Logs in through the UI form.
test     Login > logs in with valid credentials @smoke  tests/login.spec.ts:6  tags: @auth,@smoke — logs in with valid credentials @smoke
```

---

### `show` — inspect an entry

```bash
npx playwright-scout show <id-or-label> [--root <dir>] [--json]
```

Accepts a full id (`helper:pages/login.page.ts#LoginPage`), a unique suffix after `#` (`LoginPage`), or a method label (`LoginPage.login`). Short identifier-token matches can be ambiguous; list candidates with a more specific label.

```text
LoginPage.login(user: string, pass: string)
Logs in through the UI form.
class: helper:pages/login.page.ts#LoginPage
pages/login.page.ts:3
```

---

### `install-skill` — wire up the agent skill

```bash
npx playwright-scout install-skill [--target claude|agents|github|cursor|all] [--global] [--force]
```

Copies `SKILL.md` into the right directory for your AI tool so it automatically runs `map → find → show` before writing test code.

| Target | Path |
|--------|------|
| `agents` (default) | `.agents/skills/playwright-scout/SKILL.md` |
| `claude` | `.claude/skills/playwright-scout/SKILL.md` |
| `github` | `.github/skills/playwright-scout/SKILL.md` |
| `cursor` | `.cursor/skills/playwright-scout/SKILL.md` |

---

## How the index works

Two-phase static analysis — **no test execution, no LLM calls**:

1. **Facts** — each file is parsed once with the TypeScript compiler API (`ts.createSourceFile`). Extracts exports, test calls, describe blocks, fixture definitions, `.goto()` calls, JSDoc.
2. **Linking** — resolves imports across files, de-duplicates helpers re-exported through barrels, builds `referencedByFiles` and `usedBySpecCount` for every helper.

The result is `.scout/index.json` (schema v1, Zod-validated). It contains:

- `specs` — one entry per test file, with tag and test count
- `tests` — every test with title, suite path, modifiers, tags, fixtures, helper calls, URLs visited
- `helpers` — exported functions, classes (with methods), and constants — including page objects
- `fixtures` — every `.extend({…})` fixture with scope, auto, dependsOn
- `tags` — `@tag` counts across all tests
- `diagnostics` — parse errors, dynamic config values, unresolved imports

---

## What it does NOT do

- Run tests or evaluate code at runtime
- Make LLM or network calls
- Index CommonJS files (`require`/`module.exports`)
- Link fixture parameters to the classes they construct; calls made through fixtures are not recorded in `calls` (fixture names are recorded in `fixtures`)
- Capture dynamic `.goto()` values; only string and no-substitution-template arguments are included
- Fully resolve dynamic test titles; they are approximated
- Analyze multiple Playwright configs in one run; map one root at a time
- Follow CommonJS module relationships; only ESM-style imports and exports are followed
- Support Python, Java, or .NET test suites

---

## Using it as a library

```ts
import { buildIndex, readIndex, searchIndex } from 'playwright-scout-core';

// Build
const index = await buildIndex({ root: '/path/to/your/project' });

// Query
const results = searchIndex(index, 'login coupon', { kind: 'any', limit: 10 });
```

---

## Agent skill

Once installed, your AI assistant will automatically:

1. Run `npx playwright-scout map --if-stale --quiet` before touching test files
2. Search 2–3 times with different words before writing any helper
3. Reuse what exists, or explain why it didn't in one sentence

The installer paths are tool-specific and may change; verify the target directory your agent currently uses.

See [`skills/playwright-scout/SKILL.md`](skills/playwright-scout/SKILL.md) for the full skill spec.

---

## Development

```bash
npm ci           # install
npm run check    # lint + typecheck + build + test (run before every commit)
npm test         # tests only
npm run build    # compile TypeScript

# Try against the built-in sample suite
node packages/cli/dist/bin.js map --root fixtures/sample-suite
node packages/cli/dist/bin.js find login --root fixtures/sample-suite
node packages/cli/dist/bin.js show LoginPage.login --root fixtures/sample-suite
```

See [`docs/SPEC.md`](docs/SPEC.md) for the full build specification and [`docs/PROGRESS.md`](docs/PROGRESS.md) for task status.

---

## License

[MIT](LICENSE)
