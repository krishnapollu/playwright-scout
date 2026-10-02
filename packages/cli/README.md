<p align="center"><img src="https://raw.githubusercontent.com/krishnapollu/playwright-scout/main/docs/img/logo.svg" alt="Scout logo" width="128"></p>

<h1 align="center">playwright-scout</h1>

<p align="center">Give your coding agent a map of your Playwright suite.</p>

<p align="center">
  <a href="https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml"><img src="https://github.com/krishnapollu/playwright-scout/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/playwright-scout"><img src="https://img.shields.io/npm/v/playwright-scout" alt="npm"></a>
  <a href="https://github.com/krishnapollu/playwright-scout/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

`playwright-scout` is an agent skill, static index, and search tool for Playwright projects. It helps coding agents understand existing page objects, helpers, fixtures, tests, tags, routes, and relationships before they change or extend a suite. It can also provide a bounded, source-backed brief for a task.

The commands documented here are currently available from this repository, not yet published to npm. To try them from a checkout, run `npm ci`, `npm run build`, then `node packages/cli/dist/bin.js --help`. The npm quick start below installs the latest published version, which may not include them yet.

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

# Preview the existing Playwright layout without writing files
npx playwright-scout init

# Build or refresh the project index
npx playwright-scout map

# Search for existing code
npx playwright-scout find login
npx playwright-scout find checkout coupon

# Inspect a specific result
npx playwright-scout show LoginPage.login

# Get a small task capsule, then inspect cited evidence as needed
npx playwright-scout context "add expired coupon coverage"
npx playwright-scout show CheckoutPage.applyCoupon
npx playwright-scout impact --file pages/checkout.page.ts

# Optional team-authored business context
npx playwright-scout context "add expired coupon coverage" --business-context docs/business

# Optional, on-request framework guidance
npx playwright-scout doctor
npx playwright-scout review --file tests/checkout.spec.ts
```

Scout writes the index to `.scout/index.json`. Add `.scout/` to your repository’s `.gitignore`; the index can always be regenerated.

## Commands

| Command         | What it does                                                          | Example                                                    |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `init`          | Preview what Scout would index, without writing files.               | `npx playwright-scout init`                                |
| `map`           | Build or refresh the project index.                                   | `npx playwright-scout map`                                 |
| `find`          | Search helpers, methods, tests, fixtures, and tags.                   | `npx playwright-scout find login`                          |
| `context`       | Give an agent a bounded task capsule with cited reuse candidates. | `npx playwright-scout context "authenticated checkout"`    |
| `show`          | Inspect a result by ID or readable label.                             | `npx playwright-scout show LoginPage.login`                |
| `impact`        | Show known static links for a symbol or source file.                   | `npx playwright-scout impact --file pages/checkout.page.ts` |
| `plan`          | Create an evidence-based reuse plan for an agent task.                | `npx playwright-scout plan "add checkout coupon coverage"` |
| `doctor`        | Check a narrow set of static config facts on request.                 | `npx playwright-scout doctor`                               |
| `review`        | Review one chosen file for a few supported test-code patterns.        | `npx playwright-scout review --file tests/checkout.spec.ts`  |
| `install-skill` | Install the agent instructions for a supported coding assistant.      | `npx playwright-scout install-skill --target claude`       |

### Common options

- `--json` — return structured output for agents and scripts.
- `--root <dir>` — run Scout against a different project directory.
- `--if-stale` — with `map`, rebuild the index only when the source has changed.
- `--max-chars <n>` — with `context`, bound the complete response (default 1800 characters, not an exact model token count). Use `show` on a cited ID for more evidence.
- `--target <agent>` — with `install-skill`, choose `claude`, `agents`, `github`, `cursor`, `qwen`, or `all`.

See the [CLI reference](https://github.com/krishnapollu/playwright-scout/blob/main/docs/CLI.md) for all options.

By default, the skill is installed inside the current project:

| Target   | Location                                   |
| -------- | ------------------------------------------ |
| `agents` | `.agents/skills/playwright-scout/SKILL.md` |
| `claude` | `.claude/skills/playwright-scout/SKILL.md` |
| `github` | `.github/skills/playwright-scout/SKILL.md` |
| `cursor` | `.cursor/skills/playwright-scout/SKILL.md` |
| `qwen`   | `.qwen/skills/playwright-scout/SKILL.md`   |

Use `--global` with `--target claude` to install it at `~/.claude/skills/playwright-scout/SKILL.md` instead.

## How it works

Scout performs two static-analysis passes:

1. It parses source files to identify tests, page objects, helpers, fixtures, tags, and navigation routes.
2. It resolves local imports, exports, and direct fixture providers to connect tests with the code they use.

The result is a deterministic JSON index that can be searched from the CLI or used through the library API.

`init` previews the Playwright layout and counts before indexing, without writing files. It accepts an optional business-context path and does not create one or change Playwright configuration.

`context` gives an agent a small task capsule for creation or maintenance work. It lists omissions when the character bound cuts details; `show <cited-id>` retrieves a specific indexed entry. `impact --file` reports tests linked by the static index and the reason for each link. These results are advisory: dynamic calls and unsupported fixture shapes can leave relationships unknown. Scout does not infer business coverage requirements from source code.

Teams can optionally point `context` at a JSON file or directory of [versioned business entries](https://github.com/krishnapollu/playwright-scout/blob/main/docs/BUSINESS-CONTEXT.md) covering journeys, terminology, rules, and risks. Scout retrieves only task-relevant entries with file and line citations. These are user-provided data, never proof that a test covers a rule. The path defaults to the project; reading outside it requires an explicit flag.

When reuse or change impact is unclear, the installed skill guides an agent to refresh the index, inspect source-backed matches, and reuse suitable code. For a straightforward local edit with a clear nearby example, it can work directly without Scout queries; `context` is not a mandatory step.

`doctor` and `review` are separate, opt-in commands. They make suggestions only when asked and never block ordinary suite work. Their findings are based on a deliberately small set of static checks; an empty result is not proof that a framework has no issues.

## Using the library

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: '/path/to/your/project' });
const matches = searchIndex(index, 'login coupon', { kind: 'any', limit: 10 });
```

All query commands support `--json` for structured agent output. See the [schema reference](https://github.com/krishnapollu/playwright-scout/blob/main/docs/SCHEMA.md) for the index format and the [CLI reference](https://github.com/krishnapollu/playwright-scout/blob/main/docs/CLI.md) for all options.

## Scope and limitations

Scout is intentionally focused on static discovery. It does not:

- run tests or execute project code;
- make network or LLM calls;
- support CommonJS-only projects (`require` / `module.exports`);
- fully resolve dynamic test titles or navigation URLs;
- resolve every fixture shape, indirect call, or runtime dependency;
- analyze multiple Playwright configs in one run.

For the complete behavior and supported patterns, see the [v0.3 guidance specification](https://github.com/krishnapollu/playwright-scout/blob/main/docs/SPEC-v0.3.md), [v0.2 specification](https://github.com/krishnapollu/playwright-scout/blob/main/docs/SPEC-v0.2.md), and [evaluation notes](https://github.com/krishnapollu/playwright-scout/blob/main/docs/EVALUATION-v0.2.md). The [v0.1 specification](https://github.com/krishnapollu/playwright-scout/blob/main/docs/SPEC.md) remains the baseline for earlier commands.

## Evaluation status

Two same-task Codex feasibility pairs are documented in the [pilot report](https://github.com/krishnapollu/playwright-scout/blob/main/docs/PILOT-v0.4.md); they do not establish token or quality gains. Controlled agent runs are paused. The [P4 measurement notes](https://github.com/krishnapollu/playwright-scout/blob/main/docs/P4-MEASUREMENT.md) describe the offline instrumentation and the quality-first criteria required before any efficiency claim.

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

[MIT](https://github.com/krishnapollu/playwright-scout/blob/main/LICENSE)
