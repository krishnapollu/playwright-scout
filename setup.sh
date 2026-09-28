#!/bin/bash
set -e

# Layout directories
mkdir -p packages/core/src packages/core/test
mkdir -p packages/cli/src/commands packages/cli/scripts packages/cli/test
mkdir -p .github/workflows
mkdir -p docs
mkdir -p skills/playwright-scout
mkdir -p fixtures/sample-suite

# Root package.json
cat << 'PKG' > package.json
{
  "name": "playwright-scout-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b && tsc -p tsconfig.test.json --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "check": "npm run lint && npm run typecheck && npm run test"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "eslint": "^9.0.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.0",
    "typescript": "^5.4.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^2.0.0"
  }
}
PKG

# packages/core/package.json
cat << 'PKG' > packages/core/package.json
{
  "name": "playwright-scout-core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "dependencies": {
    "fast-glob": "^3.3.2",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
PKG

# packages/cli/package.json
cat << 'PKG' > packages/cli/package.json
{
  "name": "playwright-scout",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "playwright-scout": "dist/bin.js",
    "scout": "dist/bin.js"
  },
  "files": ["dist", "skills"],
  "scripts": {
    "build": "node scripts/copy-skill.mjs"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "playwright-scout-core": "*"
  }
}
PKG

# tsconfig.base.json
cat << 'TSB' > tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "composite": true,
    "forceConsistentCasingInFileNames": true
  }
}
TSB

# tsconfig.json (solution file)
cat << 'TS' > tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/cli" }
  ]
}
TS

# packages/core/tsconfig.json
cat << 'TS' > packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
TS

# packages/cli/tsconfig.json
cat << 'TS' > packages/cli/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../core" }
  ]
}
TS

# tsconfig.test.json
cat << 'TS' > tsconfig.test.json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["packages/core/test/**/*.ts", "packages/cli/test/**/*.ts", "packages/core/src/**/*.ts", "packages/cli/src/**/*.ts"]
}
TS

# .prettierrc.json
cat << 'PR' > .prettierrc.json
{
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all"
}
PR

# eslint.config.js
cat << 'ESL' > eslint.config.js
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'fixtures/**']
  }
);
ESL

# .gitignore
cat << 'GI' > .gitignore
node_modules
dist
.scout
coverage
*.tsbuildinfo
GI

# LICENSE
cat << 'LIC' > LICENSE
MIT License

Copyright (c) 2026 <YOUR NAME>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LIC

# AGENTS.md
cat << 'AGT' > AGENTS.md
# AGENTS.md

Project: playwright-scout — static index of a Playwright suite + agent skill. Full spec: docs/SPEC.md.

## Commands
- Install: \`npm ci\`
- Full check (run before every commit): \`npm run check\`
- Tests only: \`npm test\`   · Build: \`npm run build\`
- Try the CLI: \`node packages/cli/dist/bin.js map --root fixtures/sample-suite\`

## Rules
- ESM only. Relative imports in source end with \`.js\`. Use \`import type\` for types.
- \`core\` never prints, never exits, never executes analysed code. Only \`cli\` prints.
- All paths in output are POSIX and relative to the root. Sort with code-unit comparison, never localeCompare.
- Output must be deterministic. No Date/Random in the index (except generatedAt, nullable).
- No \`any\`. No new dependencies without recording why in docs/DECISIONS.md.
- One task at a time from docs/SPEC.md section 10. Update docs/PROGRESS.md. One Conventional Commit per task.
- Never run \`npm publish\`.

## Layout
packages/core = library, packages/cli = commands, skills/ = SKILL.md, fixtures/sample-suite = test input.
AGT

# .github/workflows/ci.yml
cat << 'CI' > .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
CI

# docs/PROGRESS.md
cat << 'PROG' > docs/PROGRESS.md
# Progress

- [x] T0 Scaffold
  - Initial repository layout, config rules, trivial tests passing.
- [ ] T1 Schema & IO
- [ ] T2 Config reading
- [ ] T3 Parsing & resolution
- [ ] T4 Helper & fixture facts
- [ ] T5 Test-tree facts
- [ ] T6 Linking & build
- [ ] T7 CLI map
- [ ] T8 Search & show
- [ ] T9 Robustness
- [ ] T10 Skill & installer
- [ ] T11 Docs
- [ ] T12 Dry run on real code
- [ ] T13 Release prep
PROG

# docs/DECISIONS.md
cat << 'DEC' > docs/DECISIONS.md
# Decisions

| Date | Question | Choice | Reason |
|---|---|---|---|
| 2026-09-28 | How to scaffold? | Used bash script | Simplest way to generate initial structure |
DEC

# README.md
cat << 'RD' > README.md
# playwright-scout
*Your coding agent finds your existing Playwright helpers before it writes new ones.*
RD

touch CHANGELOG.md CONTRIBUTING.md

# Trivial tests and placeholder src files
echo "export const core = true;" > packages/core/src/index.ts
cat << 'TEST' > packages/core/test/index.test.ts
import { expect, test } from 'vitest';
import { core } from '../src/index.js';

test('core is true', () => {
  expect(core).toBe(true);
});
TEST

echo "export const cli = true;" > packages/cli/src/bin.ts
cat << 'TEST' > packages/cli/test/bin.test.ts
import { expect, test } from 'vitest';
import { cli } from '../src/bin.js';

test('cli is true', () => {
  expect(cli).toBe(true);
});
TEST

# scripts/copy-skill.mjs
cat << 'MJS' > packages/cli/scripts/copy-skill.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootSkillPath = path.resolve(__dirname, '../../../skills/playwright-scout/SKILL.md');
const destDir = path.resolve(__dirname, '../skills/playwright-scout');
const destSkillPath = path.resolve(destDir, 'SKILL.md');

await fs.mkdir(destDir, { recursive: true });
try {
  await fs.copyFile(rootSkillPath, destSkillPath);
} catch (e) {
  // Ignore if it doesn't exist yet during scaffold
}
MJS

# SKILL.md
cat << 'SKILL' > skills/playwright-scout/SKILL.md
---
name: playwright-scout
description: Use before writing or changing any Playwright test, page object, fixture, or test helper in this repo. Searches an index of existing helpers, page objects, fixtures and tests so you reuse what exists instead of creating duplicates.
---

# playwright-scout

Find what already exists before you write test code.

## When to use
Any time you are about to create or modify: a Playwright test, a page object, a fixture, or a test helper/util.

## Steps
1. Make sure the index is fresh (fast, safe to repeat):
   `npx playwright-scout map --if-stale --quiet`
2. Search 2-3 times using different words (actions and page names, e.g. "login", "checkout coupon", "create user api"):
   `npx playwright-scout find <words>`
3. For each promising result, inspect it:
   `npx playwright-scout show <id-or-label>`
4. Decide:
   - A helper/page object/fixture already does it → **reuse it**. Import it; do not re-implement.
   - Nothing fits → create a new one in the directory shown on the `helper dirs:` line printed by `map`, following the naming and style of the neighbouring files.
5. After adding or changing exported helpers, re-run `npx playwright-scout map`.

## Rules
- Never read or edit `.scout/index.json` directly; it is large. Use `find` and `show`.
- If `find` returned a relevant match and you did not use it, say why in one sentence in your final message.
- The index is static analysis: fixture parameters are not linked to their classes, and CommonJS files are not indexed. If something seems missing, search the code normally.
- Do not commit `.scout/`.

## Examples
- Task "add a test for applying a coupon at checkout" → `find coupon checkout` → reuse `CheckoutPage.applyCoupon`.
- Task "need a unique email for signup" → `find unique email` → reuse `uniqueEmail`.
SKILL

bash -c "npm install && npm run check"

