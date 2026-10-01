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

| Command         | What it does                                                          | Example                                                    |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `map`           | Build or refresh the project index.                                   | `npx playwright-scout map`                                 |
| `find`          | Search helpers, methods, tests, fixtures, and tags.                   | `npx playwright-scout find login`                          |
| `context`       | Show matching code plus related specs, fixtures, helpers, and routes. | `npx playwright-scout context "authenticated checkout"`    |
| `show`          | Inspect a result by ID or readable label.                             | `npx playwright-scout show LoginPage.login`                |
| `impact`        | See tests and helpers related to a helper or page-object change.      | `npx playwright-scout impact CheckoutPage.applyCoupon`     |
| `plan`          | Create an evidence-based reuse plan for an agent task.                | `npx playwright-scout plan "add checkout coupon coverage"` |
| `install-skill` | Install the agent instructions for a supported coding assistant.      | `npx playwright-scout install-skill --target claude`       |

### Common options

- `--json` — return structured output for agents and scripts.
- `--root <dir>` — run Scout against a different project directory.
- `--if-stale` — with `map`, rebuild the index only when the source has changed.
- `--target <agent>` — with `install-skill`, choose `claude`, `agents`, `github`, `cursor`, or `all`.

See the [CLI reference](docs/CLI.md) for all options.

By default, the skill is installed inside the current project:

| Target   | Location                                   |
| -------- | ------------------------------------------ |
| `agents` | `.agents/skills/playwright-scout/SKILL.md` |
| `claude` | `.claude/skills/playwright-scout/SKILL.md` |
| `github` | `.github/skills/playwright-scout/SKILL.md` |
| `cursor` | `.cursor/skills/playwright-scout/SKILL.md` |

Use `--global` with `--target claude` to install it at `~/.claude/skills/playwright-scout/SKILL.md` instead.

## How it works

Scout performs two static-analysis passes:

1. It parses source files to identify tests, page objects, helpers, fixtures, tags, and navigation routes.
2. It resolves local imports and exports to connect tests with the code they use.

The result is a deterministic JSON index that can be searched from the CLI or used through the library API.

When you ask an agent to extend your Playwright suite, the installed skill tells it to refresh the Scout index, search for relevant existing code, inspect promising matches, and reuse suitable helpers, fixtures, and page objects before creating anything new.

## Using the library

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: '/path/to/your/project' });
const matches = searchIndex(index, 'login coupon', { kind: 'any', limit: 10 });
```

All query commands support `--json` for structured agent output. See the [schema reference](docs/SCHEMA.md) for the index format and the [CLI reference](docs/CLI.md) for all options.

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

## Publishing (maintainers)

Put your npm publish token in a local `.env` file as `npm_pat=...`. The file is ignored by Git. Then run:

```bash
npm run release:publish -- --dry-run
npm run release:publish
```

The script checks the release, confirms the contents of both packages, and prompts before publishing core followed by the CLI. It skips a version that is already on npm, so you can rerun it if the second package fails. Bump the package you are releasing; if core changes, update the CLI's core dependency too. For prereleases, use `--tag next`.

## License

[MIT](LICENSE)
