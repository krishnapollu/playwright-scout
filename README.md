# playwright-scout

> Your coding agent finds the Playwright helpers that already exist before it writes new ones.

[![CI](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml/badge.svg)](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/playwright-scout)](https://www.npmjs.com/package/playwright-scout)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`playwright-scout` is a static-analysis CLI and agent skill for Playwright projects. It scans your suite without running tests, builds a searchable index of specs, page objects, helpers, fixtures, and tags, and helps coding agents reuse existing code instead of re-implementing it.

Requires Node.js 20 or newer.

---

## Why this exists

Large Playwright suites accumulate helpers over time: login flows, auth utilities, fixtures, page objects, and test data. When an AI agent writes a new test, it often misses those existing building blocks and creates duplicates.

`playwright-scout` solves that by indexing the project once and letting the agent query it before writing code.

---

## Features

- Static indexing of Playwright specs, helpers, page objects, fixtures, and tags
- No test execution required
- Search across names, docs, tags, and file relationships
- Agent skill support so your assistant can discover existing code automatically
- Library API for building and querying the index programmatically

---

## Install

```bash
npm install -D playwright-scout
# or run without installing:
npx playwright-scout map
```

---

## Quick start

```bash
# 1. Build the index
npx playwright-scout map

# 2. Search for an existing helper or test
npx playwright-scout find login

# 3. Inspect the match
npx playwright-scout show LoginPage.login

# 4. Install the agent skill
npx playwright-scout install-skill
```

Typical output:

```text
$ npx playwright-scout find login
class    LoginPage  pages/login.page.ts:3 — Login screen of the app.
method   LoginPage.login(user: string, pass: string)  pages/login.page.ts:9 — Logs in through the UI form.
test     Login > logs in with valid credentials @smoke  tests/login.spec.ts:6
```

---

## CLI commands

### `map`

Build the static index for a project.

```bash
npx playwright-scout map [--root <dir>] [--out <file>] [--include <glob...>] [--no-timestamp] [--if-stale] [--json] [--verbose] [--quiet]
```

This scans `--root` (default: current working directory), reads `playwright.config.*` statically, and writes `.scout/index.json`.

### `find`

Search the index for helpers, tests, fixtures, methods, and tags.

```bash
npx playwright-scout find <query...> [--kind helper|method|test|fixture|any] [--limit <n>] [--root <dir>] [--json]
```

### `show`

Inspect a matched entry in detail.

```bash
npx playwright-scout show <id-or-label> [--root <dir>] [--json]
```

Accepts a full id such as `helper:pages/login.page.ts#LoginPage`, a suffix like `LoginPage`, or a method label like `LoginPage.login`.

### `install-skill`

Install the agent skill so your AI assistant can automatically follow the recommended workflow before writing new test code.

```bash
npx playwright-scout install-skill [--target claude|agents|github|cursor|all] [--global] [--force]
```

---

## How it works

`playwright-scout` uses a two-phase static analysis pass:

1. Facts: parse source files with the TypeScript compiler API to extract exports, tests, fixtures, page objects, and docs.
2. Linking: resolve imports and re-exports to connect helpers, fixtures, and specs across the project.

The result is a structured JSON index with entries for specs, tests, helpers, fixtures, and diagnostics. This gives an agent a much more accurate picture than plain grep while avoiding runtime execution.

See the [schema reference](docs/SCHEMA.md) and [CLI reference](docs/CLI.md) for the details.

---

## What it does not do

- Run tests or execute project code
- Make network or LLM calls
- Index CommonJS-only projects (`require` / `module.exports`)
- Fully resolve every dynamic value in test titles or `.goto()` calls
- Analyze multiple Playwright configs in one run

These limits are intentional and documented so expectations stay realistic.

---

## Using it as a library

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: '/path/to/your/project' });
const results = searchIndex(index, 'login coupon', { kind: 'any', limit: 10 });
```

---

## Agent skill

Once installed, the skill tells the agent to:

1. run `npx playwright-scout map --if-stale --quiet`
2. search a few times using different words
3. reuse existing helpers before creating new ones

See [`skills/playwright-scout/SKILL.md`](skills/playwright-scout/SKILL.md) for the full spec.

---

## Monorepo layout

This repository is organized as a small monorepo:

- `packages/cli` — the CLI commands
- `packages/core` — the static-analysis library and index builder
- `skills/playwright-scout` — the agent skill definition
- `fixtures/sample-suite` — example Playwright project used for tests and demos

---

## Development

```bash
npm ci
npm run check
npm test
npm run build

# Try against the included sample suite
node packages/cli/dist/bin.js map --root fixtures/sample-suite
node packages/cli/dist/bin.js find login --root fixtures/sample-suite
node packages/cli/dist/bin.js show LoginPage.login --root fixtures/sample-suite
```

See [`docs/SPEC.md`](docs/SPEC.md) and [`docs/PROGRESS.md`](docs/PROGRESS.md) for deeper implementation details.

---

## License

[MIT](LICENSE)
