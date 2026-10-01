# playwright-scout

> Give your coding agent a map of your Playwright suite.

[![CI](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml/badge.svg)](https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/playwright-scout)](https://www.npmjs.com/package/playwright-scout)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`playwright-scout` is an agent skill, static index, and search tool for Playwright projects. It helps coding agents understand existing page objects, helpers, fixtures, tests, tags, routes, and relationships before they change or extend a suite.

Scout reads your source code without running your tests or project code, giving agents a reliable map they can query before writing new code. That means new tests can build on what is already there instead of creating duplicates.

## Why use it?

As Playwright suites grow, useful code becomes hard to find. Scout gives you a quick map of the suite and lets you ask questions such as:

- “Do we already have a login helper?”
- “Which fixture provides an authenticated page?”
- “Where is checkout coverage implemented?”

That makes it especially useful as a pre-flight step for AI coding agents.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install -D playwright-scout

# Build or refresh the project index
npx playwright-scout map

# Search for existing code
npx playwright-scout find login
npx playwright-scout find checkout coupon

# Inspect a specific result
npx playwright-scout show LoginPage.login
```

Scout writes the index to `.scout/index.json`. Add `.scout/` to your repository’s `.gitignore`; the index can always be regenerated.

## Commands

### `map`

Scan a project and create its index.

```bash
npx playwright-scout map [--root <dir>] [--no-timestamp]
```

Useful options include `--include <glob...>` for additional helper files, `--if-stale` to avoid unnecessary work, and `--json` for scripting.

### `find`

Search helpers, methods, tests, fixtures, and tags.

```bash
npx playwright-scout find <words...>
npx playwright-scout find login --kind helper --limit 5
```

Search results include the matching item, source location, and a short summary.

### `show`

Display the details of a result by its ID or a readable label.

```bash
npx playwright-scout show LoginPage.login
npx playwright-scout show helper:pages/login.page.ts#LoginPage --json
```

### `install-skill`

Install the bundled agent skill so your coding assistant can use Scout automatically before changing Playwright code.

```bash
npx playwright-scout install-skill
```

Use `--target claude|agents|github|cursor|all` to choose the destination.

## How it works

Scout performs two static-analysis passes:

1. It parses source files to identify tests, page objects, helpers, fixtures, tags, and navigation routes.
2. It resolves local imports and exports to connect tests with the code they use.

The result is a deterministic JSON index that can be searched from the CLI or used through the library API.

## Using the library

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: '/path/to/your/project' });
const matches = searchIndex(index, 'login coupon', { kind: 'any', limit: 10 });
```

See the [schema reference](docs/SCHEMA.md) for the index format and the [CLI reference](docs/CLI.md) for all options.

## Scope and limitations

Scout is intentionally focused on static discovery. It does not:

- run tests or execute project code;
- make network or LLM calls;
- support CommonJS-only projects (`require` / `module.exports`);
- fully resolve dynamic test titles or navigation URLs;
- analyze multiple Playwright configs in one run.

For the complete behavior and supported patterns, see the [build specification](docs/SPEC.md).

## Development

```bash
npm ci
npm run check
npm test
npm run build
```

Try it against the included sample suite:

```bash
node packages/cli/dist/bin.js map --root fixtures/sample-suite
node packages/cli/dist/bin.js find login --root fixtures/sample-suite
```

## License

[MIT](LICENSE)
