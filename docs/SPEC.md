# playwright-scout — Build Specification v0.1

> Audience: an AI coding assistant (any model) building this repo from scratch.
> Goal of this document: remove guesswork. Where it says MUST, follow it exactly. Where it leaves a choice, take the simplest option and log it in `docs/DECISIONS.md`.

---

## 0. How to work (read first)

1. Work **one task at a time**, in the order of section 10 (T0 → T13). Do not start a task before the previous one passes its acceptance criteria.
2. After every task: run `npm run check` (lint + typecheck + build + tests). It MUST pass. Then make **one git commit** using Conventional Commits (`feat(core): ...`, `test: ...`, `chore: ...`, `docs: ...`).
3. Keep `docs/PROGRESS.md` updated: a checklist of T0–T13, each marked `[ ]` or `[x]`, plus one line of notes per finished task. This lets a different model or session resume the work.
4. If something is ambiguous, pick the simplest option consistent with this document, record it in `docs/DECISIONS.md` (date, question, choice, reason), and continue. Do not stop to ask unless a task is impossible.
5. Do NOT: run `npm publish`, add network calls, execute analysed user code, add dependencies not listed in section 4, add features listed under Non-goals, or use `any` (use `unknown` and narrow).
6. Never hardcode dependency versions from memory. At scaffold time run `npm view <pkg> version` and install the current release with `npm install`; keep caret ranges.

---

## 1. Product summary

**playwright-scout** is a static-analysis tool plus an agent skill. It scans a Playwright test project **without running it**, builds a JSON **index** of what already exists (tests, page objects, helpers, fixtures, tags, routes visited), and lets a coding agent **query** that index before writing new test code, so the agent **reuses existing helpers instead of writing duplicates**.

Headline promise (use in README first line): _"Your coding agent finds your existing Playwright helpers before it writes new ones."_

Deliverables of v0.1:

- `playwright-scout-core` (npm library): builds and reads the index.
- `playwright-scout` (npm CLI): commands `map`, `find`, `show`, `install-skill`.
- `skills/playwright-scout/SKILL.md`: the agent skill that tells an agent when and how to call the CLI.
- Docs, tests, CI.

### Non-goals for v0.1 (do NOT build)

No test execution. No LLM/API calls. No run results or history (that is a different project). No lint/audit rules. No MCP server. No watch mode or caching. No Python/Java/.NET suites. No evaluation of `playwright.config` code (static reading only). No TypeScript type checker (`ts.Program`); syntax-level parsing only. No CommonJS (`require`, `module.exports`) support (emit a diagnostic instead).

### Success criteria

- `npx playwright-scout map` on a 500-spec-file project finishes in under 5 seconds on a modern laptop.
- Output is **deterministic**: same input → byte-identical index (with `--no-timestamp`).
- An agent using the skill can find `LoginPage.login` from the query "log in" in one `find` call.

---

## 2. Glossary

- **Root**: the directory being analysed (`--root`, default `process.cwd()`).
- **Spec file**: a file matching the test-file globs (section 6.1).
- **Support file**: a non-spec source file that is a candidate for helpers (section 6.2).
- **Helper**: an exported function, class or constant from a support file. A class method is indexed as a **method** under its class.
- **Page object**: a class whose constructor takes a parameter typed `Page` (section 6.5).
- **Fixture**: a property defined in the object literal passed to `<something>.extend({...})`.
- **Test object**: an exported value created by `.extend(...)` or `mergeTests(...)`, or `test` re-exported from `@playwright/test`.
- **Index**: the JSON document defined in section 5.
- **Facts**: per-file extracted data (phase 1). **Linking**: cross-file resolution (phase 2).

---

## 3. Repository layout (MUST match)

```
playwright-scout/
├─ package.json                 # private root, npm workspaces
├─ tsconfig.base.json
├─ tsconfig.json                # solution file with references
├─ tsconfig.test.json           # typechecks test files (noEmit)
├─ eslint.config.js
├─ .prettierrc.json
├─ .gitignore                   # node_modules, dist, .scout, coverage, *.tsbuildinfo
├─ .github/workflows/ci.yml
├─ AGENTS.md                    # copy from section 12.2 verbatim
├─ README.md  LICENSE(MIT)  CHANGELOG.md  CONTRIBUTING.md
├─ docs/  SPEC.md (copy of this file)  SCHEMA.md  CLI.md  DECISIONS.md  PROGRESS.md
├─ skills/playwright-scout/SKILL.md
├─ fixtures/sample-suite/       # section 9
├─ packages/
│  ├─ core/    (npm: playwright-scout-core)
│  │  ├─ package.json  tsconfig.json
│  │  ├─ src/
│  │  │  ├─ index.ts            # public API re-exports only
│  │  │  ├─ schema.ts           # zod schemas + inferred types (section 5)
│  │  │  ├─ errors.ts           # ScoutError
│  │  │  ├─ paths.ts            # posix normalisation helpers
│  │  │  ├─ discover.ts         # section 6.1, 6.2
│  │  │  ├─ config.ts           # static playwright.config reading, tsconfig paths
│  │  │  ├─ parse.ts            # createSourceFile wrapper + parse-error detection
│  │  │  ├─ facts.ts            # phase 1 extraction (per file)
│  │  │  ├─ resolve.ts          # module + export resolution
│  │  │  ├─ link.ts             # phase 2 linking, reverse index
│  │  │  ├─ build.ts            # buildIndex() orchestration
│  │  │  ├─ io.ts               # readIndex / writeIndex / freshness check
│  │  │  ├─ search.ts           # tokenizer + scoring (section 7.3)
│  │  │  └─ show.ts             # id lookup + detail views
│  │  └─ test/  *.test.ts
│  └─ cli/     (npm: playwright-scout, bins: playwright-scout, scout)
│     ├─ package.json  tsconfig.json
│     ├─ src/ bin.ts  program.ts  commands/{map,find,show,installSkill}.ts  format.ts
│     ├─ scripts/copy-skill.mjs   # copies ../../skills into packages/cli/skills at build
│     └─ test/  *.test.ts
```

Dependency direction: `cli → core`. `core` MUST NOT import from `cli`. `core` MUST NOT call `console.*`, `process.exit`, or read `process.argv`. Only `cli` prints and sets exit codes.

---

## 4. Tooling and conventions

- **Node** `>=20`. **Module system**: ESM only (`"type": "module"` in every package.json).
- **TypeScript**, strict. `tsconfig.base.json` compilerOptions MUST include: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `skipLibCheck: true`, `composite: true`, `forceConsistentCasingInFileNames: true`.
- Because of NodeNext, **relative imports in source MUST include the `.js` extension** (`import { x } from './paths.js'`) even though the file is `.ts`. Use `import type` for type-only imports.
- Each package: `rootDir: "src"`, `outDir: "dist"`, `include: ["src"]`. `packages/cli/tsconfig.json` has `references: [{ "path": "../core" }]`.
- **Dependencies (only these)**:
  - core: `typescript` (runtime dependency: it is the parser), `fast-glob`, `zod`.
  - cli: `playwright-scout-core` (workspace), `commander`.
  - root devDependencies: `vitest`, `eslint`, `typescript-eslint`, `prettier`, `eslint-config-prettier`, `@types/node`.
- `import ts from 'typescript'` (default import works under NodeNext). `import fg from 'fast-glob'`.
- **Root scripts**: `build` = `tsc -b`; `typecheck` = `tsc -b && tsc -p tsconfig.test.json --noEmit`; `lint` = `eslint .`; `format` = `prettier --write .`; `test` = `vitest run`; `check` = `npm run lint && npm run typecheck && npm run test`. The cli `build` also runs `node scripts/copy-skill.mjs`.
- **Tests**: vitest. Test files live in `packages/*/test/*.test.ts` and import from `../src/x.js`.
- **Code rules**: no `any`; no default exports (except where analysed fixtures need them); functions ≤ 60 lines (split otherwise); pure functions where possible; every exported function has a one-line TSDoc; no `console` in `core`; errors are `ScoutError` (section 6.9), never bare strings.
- **Paths**: all paths stored in the index and printed by the CLI are **POSIX, relative to root**, never absolute. Internally convert with `p.split(path.sep).join('/')`. Sorting of strings MUST use plain code-unit comparison (`a < b ? -1 : a > b ? 1 : 0`), never `localeCompare`.

---

## 5. Data model (index schema v1)

Define with **zod** in `schema.ts`; export both schemas and inferred types. The file is written to `<root>/.scout/index.json` by default (2-space indented JSON, trailing newline). The field order below is the serialisation order (build objects in this order).

```ts
SCHEMA_VERSION = 1

Index = {
  schemaVersion: 1,
  generator: { name: 'playwright-scout-core', version: string },
  generatedAt: string | null,            // ISO-8601 UTC; null when deterministic mode
  project: ProjectInfo,
  stats: Stats,
  specs: SpecEntry[],
  tests: TestEntry[],
  helpers: HelperEntry[],
  fixtures: FixtureEntry[],
  tags: TagEntry[],
  diagnostics: Diagnostic[]
}

ProjectInfo = {
  configFile: string | null,             // e.g. "playwright.config.ts"
  testDir: string,                       // posix relative, "." if unknown
  testMatch: string[] | null,            // only if statically literal
  playwrightProjects: string[],          // literal project names, [] if unknown
  language: 'typescript' | 'javascript' | 'mixed',
  helperDirs: { dir: string, count: number }[]   // top 5 dirs by helper count, desc, then dir asc
}

Stats = { specFiles: number, tests: number, helpers: number, methods: number,
          pageObjects: number, fixtures: number, tags: number,
          filesParsed: number, filesSkipped: number }

SpecEntry = { id: string,                // "spec:<file>"
              file: string, testCount: number, tags: string[] }

TestEntry = {
  id: string,                            // section 6.8
  file: string, line: number, column: number, endLine: number,   // 1-based line/column
  title: string | null,                  // dynamic parts rendered as "{…}"
  titleDynamic: boolean,
  titleSource: string | null,            // source text (≤80 chars) only when title is null
  suitePath: string[],                   // enclosing describe titles, outermost first
  modifiers: ('fail'|'fixme'|'only'|'skip'|'slow')[],   // own + inherited from describes; sorted
  tags: string[],                        // "@x" form; own + inherited; sorted unique
  fixtures: string[],                    // destructured param names of the callback; sorted unique
  calls: string[],                       // helper/method ids referenced in body; sorted unique
  navigatesTo: string[],                 // string-literal args of .goto(...) in body; sorted unique
  inLoop: boolean
}

HelperEntry = {
  id: string,                            // "helper:<file>#<name>"
  kind: 'function' | 'class' | 'constant',
  name: string,                          // declared name; "default" only if anonymous default export
  exportName: string,                    // "default" for default exports
  file: string, line: number, endLine: number,
  isAsync: boolean,                      // functions only, else false
  params: string | null,                 // functions: text between parentheses, whitespace-collapsed, ≤200 chars
  returns: string | null,                // annotated return type text, ≤120 chars
  valuePreview: string | null,           // constants only: source text collapsed to one line, ≤80 chars
  extends: string | null,                // classes only
  category: 'page-object' | 'helper',
  doc: string | null,                    // first sentence of leading JSDoc, ≤160 chars
  methods: MethodEntry[],                // classes only (public + protected, no private/#private)
  navigatesTo: string[],                 // .goto literals inside the helper body (incl. methods)
  usedBySpecCount: number,               // distinct spec files referencing it directly
  referencedByFiles: string[],           // distinct files (spec or support) referencing it; max 25, sorted
  referencedByTruncated: boolean
}

MethodEntry = { id: string,              // "helper:<file>#<Class>.<method>"
                name: string, params: string | null, returns: string | null,
                isAsync: boolean, isStatic: boolean, visibility: 'public'|'protected',
                doc: string | null, line: number }

FixtureEntry = { id: string,             // "fixture:<file>#<name>"
                 name: string, file: string, line: number,
                 scope: 'test' | 'worker', auto: boolean, option: boolean,
                 dependsOn: string[],    // destructured param names of the fixture fn, sorted
                 testObject: string | null }   // exported name of the extended test object

TagEntry = { tag: string, testCount: number }         // sorted by tag asc

Diagnostic = { code: DiagnosticCode, severity: 'info'|'warn'|'error',
               message: string, file: string | null, line: number | null }

DiagnosticCode = 'CONFIG_NOT_FOUND' | 'CONFIG_DYNAMIC' | 'PARSE_ERROR' | 'FILE_TOO_LARGE'
               | 'UNRESOLVED_IMPORT' | 'DYNAMIC_TITLE' | 'CJS_UNSUPPORTED' | 'NO_TESTS_FOUND'
```

Rules:

- Arrays inside objects that are described as "sorted" use code-unit order. Top-level arrays are sorted: `specs` by file; `tests` by (file, line, column); `helpers` by (file, line); `fixtures` by (file, line, name); `diagnostics` by (severity rank error<warn<info, code, file, line, message).
- `readIndex()` MUST validate with zod and throw `ScoutError('INDEX_INVALID')` when invalid, and `ScoutError('INDEX_SCHEMA_MISMATCH')` when `schemaVersion !== 1`.
- Never put absolute paths, usernames, or timestamps (except `generatedAt`) in the index.

---

## 6. Analysis algorithms

Two phases. **Phase 1 (facts)**: for each file independently, parse once and extract a `FileFacts` object (pure function of file text + relative path). **Phase 2 (linking)**: resolve imports across files, resolve re-exports, build tests/helpers/fixtures with cross-references. Never keep ASTs after phase 1 (memory), only facts.

### 6.1 Spec-file discovery

1. Root = resolved `--root`. Ignore always: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/out/**`, `**/.git/**`, `**/.scout/**`, `**/playwright-report/**`, `**/test-results/**`, `**/blob-report/**`, `**/coverage/**`, `**/.next/**`, `**/.turbo/**`, `**/.cache/**`.
2. Find config: first existing in root of `playwright.config.{ts,mts,cts,js,mjs,cjs}` (that order). If none: diagnostic `CONFIG_NOT_FOUND` (info), `testDir = "."`.
3. Read config statically (section 6.3) → `testDir`, `testMatch`.
4. Spec globs: if `testMatch` is a literal (string or array of strings; regex literals are ignored → fallback) use it relative to `testDir`; otherwise default `**/*.{spec,test}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}` under `testDir`.
5. Files larger than 1 MiB are skipped with diagnostic `FILE_TOO_LARGE` (warn); count in `filesSkipped`.
6. `language`: `typescript` if all spec + support files are TS-family, `javascript` if all JS-family, else `mixed`.

### 6.2 Support-file discovery

Support files (helper candidates) = union of:

- (a) all source files (`**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}`, minus ignores, minus spec files, minus `*.d.ts`) under `testDir` **when `testDir` is not `.`**;
- (b) files **reachable** from any spec file by following resolvable local imports and re-exports (breadth-first, cycle-safe), even outside `testDir`;
- (c) files matched by any `--include <glob>` CLI flag (globs relative to root).
  Files in (b)/(c) outside root are ignored. If `testDir` is `.`, only (b) and (c) apply.

### 6.3 Static config reading (`config.ts`)

- Parse the config with `ts.createSourceFile`. Find the default export: `export default defineConfig({...})`, `export default {...}`, or `export default <identifier>` whose top-level `const` initializer is one of those.
- From the object literal read ONLY: `testDir` (string literal), `testMatch` (string literal or array of string literals), `projects` (array of object literals → collect `name` string literals; also collect each project's `testDir` if literal and add it as an extra spec root).
- Any property whose value is not a literal → diagnostic `CONFIG_DYNAMIC` (info) once per property, and fall back to defaults. **Never execute the config.**
- `testDir` is normalised to posix relative to root; leading `./` removed; empty → `.`.
- tsconfig: look for `tsconfig.json` in root, then in `testDir`. Use `ts.readConfigFile` + `ts.parseJsonConfigFileContent(config, ts.sys, dirname)` to obtain `options.paths` and `options.baseUrl` (this resolves `extends`). Store as `{ baseUrl: string | undefined (absolute), paths: Record<string,string[]> | undefined, pathsBasePath: string }` for the resolver. Missing/invalid tsconfig → no aliases, no error.

### 6.4 Parsing (`parse.ts`)

- `parseFile(relPath, text)`: `ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, /*setParentNodes*/ true, kind)` where kind by extension: `.tsx`→TSX, `.jsx`→JSX, `.ts/.mts/.cts`→TS, `.js/.mjs/.cjs`→JS.
- Parse errors: `getParseErrors(sf)` reads `(sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []` (internal field; keep behind this one helper and comment why). If non-empty: emit `PARSE_ERROR` (warn, with first error's line) and **discard the file's facts** (treated as having no tests/exports). Its spec entry is kept with `testCount: 0`.

### 6.5 Phase 1: per-file facts (`facts.ts`)

`extractFacts(relPath, sourceFile, isSpec): FileFacts` returns a plain object with:

- `imports`: `{ specifier, kind: 'named'|'default'|'namespace', imported: string|null, local: string, typeOnly: boolean, line }[]` (skip side-effect imports).
- `localDecls`: map local name → `{ kind: 'function'|'class'|'constant', node summary }` for **all top-level** function declarations, classes, and `const/let/var` declarations (names only for destructuring patterns are skipped).
- `exports`: `{ exportName, localName | null, from: string | null, importedName: string | null, star: boolean }[]` covering: `export function/class/const`, `export { a, b as c }`, `export default <decl|expr>`, `export { a as b } from './x'`, `export * from './x'`. (`export * as ns from` is ignored.)
- `helperDetails`: for each exported-or-locally-exported declaration: everything needed for `HelperEntry` (line, endLine, isAsync, params, returns, valuePreview, extends, doc, methods, `gotos`).
- `fixtureDefs`, `testObjectExports` (section 6.6).
- `testTree` (spec files only; section 6.7).
- `references`: for the whole file, the set of identifier names referenced (excluding declarations of those names); plus, for each test, the set of identifiers referenced inside its callback; plus member accesses on namespace imports (`ns.name`).
- `cjs`: true if the file contains `module.exports` or `require(` → emit `CJS_UNSUPPORTED` (info) once; continue with what ESM syntax exists.

**Helper details rules**

- `function` kind: function declarations, and `const x = (…) => …` / `const x = function …` (also `async`). `params` = the text between the parentheses, whitespace collapsed (`/\s+/g` → single space, trimmed), truncated to 200 chars with `…`. `returns` = annotated return type text (else `null`).
- `class` kind: `methods` = methods and getters excluded; include only `public` (explicit or default) and `protected` methods; skip `private`, `#private`, constructors, and property arrow functions. `extends` = expression text of the heritage clause.
- `constant` kind: exported `const X = <non-function>`; `valuePreview` = initializer text collapsed to one line and truncated at 80 chars with `…`. **Exclude** constants that are test objects (6.6) and constants whose initializer is a re-used import identifier alias.
- `doc` = leading JSDoc (`/** … */`) of the declaration (for `export const`, the doc on the statement). Strip leading `*`, drop lines starting with `@`, join lines with a space, take text up to the first `. ` or end, truncate to 160 chars. No JSDoc → `null`.
- `gotos`: for every call `X.goto(<arg0>)` inside the declaration body where `arg0` is a string literal or a no-substitution template literal, collect the text. Sorted unique.
- `category`: `page-object` if the class has a constructor parameter whose type text (`param.type.getText()`) matches `/\bPage\b/`, or a constructor parameter property (`private readonly page: Page`) — otherwise `helper`. Functions and constants are always `helper`.

### 6.6 Fixtures and test objects

- A **test object** is an exported name (or local const) whose initializer is a call `<expr>.extend(...)` (any type arguments), or a call to `mergeTests(...)`, or an alias `const t = <known test object|test binding>`, or `export { test } from '@playwright/test'`, or `export { test as X } from '@playwright/test'`.
- For each `.extend(<obj>)` call with a single object-literal argument, every property (identifier or string-literal key) is a **fixture**:
  - value is a function/arrow → `scope: 'test'`, `auto: false`, `option: false`.
  - value is an array literal `[fn|value, { … }]` → read literal booleans/strings from the second element: `scope: 'worker'|'test'` (default `'test'`), `auto` (default false), `option` (default false).
  - `dependsOn` = property names in the **first parameter's** object-binding pattern of the fixture function (`async ({ page, loginPage }, use) =>`), sorted. No destructuring → `[]`.
  - `testObject` = name of the variable the `.extend` result is assigned to when it is exported; else `null`.

### 6.7 Test tree extraction (spec files only)

**Test bindings** for a file: (1) local names imported as `test` (or `test as X`) from `@playwright/test`; (2) local names imported (named or default) from a local module whose resolved export is a test object; (3) local consts that are test objects (6.6); (4) the bare identifier `test` (always, as a fallback, because the file is a spec file).

Recursive visitor with context `{ suitePath, tags, modifiers, inLoop }`. For each `CallExpression`:

- **describe call**: callee is `T.describe`, or `T.describe.<m>` where `<m>` ∈ {`only`,`skip`,`fixme`,`serial`,`parallel`,`configure`} — `configure` is ignored (not a describe); `serial`/`parallel` add no modifier; `only`/`skip`/`fixme` add that modifier. Title = first argument (rules below). Visit the callback body with extended context.
- **test call**: callee is `T`, or `T.<m>` with `<m>` ∈ {`only`,`skip`,`fixme`,`fail`,`slow`}. For `T.skip|fixme|fail|slow` it is a **declaration only if the first argument is a string literal, no-substitution template, or template expression**; otherwise it is a runtime call inside a test (`test.skip(cond, 'reason')`) and MUST be ignored. Record a `TestEntry`. Do not look for tests inside the callback.
- Hooks (`T.beforeEach/afterEach/beforeAll/afterAll`), `T.use`, `T.step`, `T.setTimeout`: ignored for tests (their identifiers still count as file-level references).
- **Loops**: entering `ForStatement`, `ForOfStatement`, `ForInStatement`, `WhileStatement`, `DoStatement`, or a callback passed to `.forEach/.map/.flatMap` sets `inLoop = true` for everything inside.
- **Title rules**: first arg string literal / no-substitution template → text. Template expression → head + `{…}` for each substitution + literal spans; `titleDynamic = true`, emit `DYNAMIC_TITLE` (info). Any other expression → `title = null`, `titleDynamic = true`, `titleSource` = trimmed source ≤80 chars.
- **Details argument** (applies to both describe and test calls): if the second argument is an object literal (i.e. not a function), read `tag`: a string literal or array of string literals; ignore other properties.
- **Tags** = union of: describe-level tags (inherited) + details `tag` values + tokens in the title matching `/(?:^|\s)(@[\w:-]+)/g` (from literal parts only). Each tag keeps its leading `@`; values without `@` get `@` prepended.
- **Callback**: the last argument that is an arrow function or function expression. `fixtures` = names in its first parameter's object-binding pattern. No callback → `fixtures: []`, `calls: []`.
- `navigatesTo`: `.goto('<literal>')` calls inside the callback (string / no-substitution template only).
- `endLine`: line of the closing of the call expression.

### 6.8 IDs

- test: `test:<file>::<suitePath joined with " > ">` + (`" > "` only if suitePath non-empty) + `<title>`. If `title` is null → `test:<file>:L<line>`. If the same id occurs twice, append `#2`, `#3`, … in source order.
- helper: `helper:<file>#<name>`, where `name` is the declared name (for `export default class CheckoutPage`, `name` is `CheckoutPage` and `exportName` is `default`). For an anonymous default export, `name` is `default` and the id is `helper:<file>#default`.
- method: `helper:<file>#<Class>.<method>`. fixture: `fixture:<file>#<name>`. spec: `spec:<file>`.

### 6.9 Module resolution (`resolve.ts`)

`resolveSpecifier(fromFile, specifier, aliasConfig): string | null` returns a root-relative posix path of an existing local source file, or `null` for external/unresolvable specifiers.

1. If specifier starts with `.` → candidate base = `path.resolve(dirname(fromFile), specifier)`.
2. Else if it matches a tsconfig `paths` pattern (pattern with at most one `*`; try patterns in declaration order; substitute into each target; targets are relative to `pathsBasePath`) → candidate bases from targets. Else if `baseUrl` is set → try `baseUrl/specifier`. Otherwise external → `null` (silent).
3. Probing for each candidate base, in this order, first existing **file** wins:
   a. If base ends with `.js|.mjs|.cjs|.jsx`: try the same name with `.ts|.mts|.cts|.tsx` respectively first, then the file as written.
   b. If base already has a known source extension and exists → it.
   c. Base + each of `.ts .tsx .mts .cts .js .jsx .mjs .cjs`.
   d. Base as directory: `index` + the same extension list.
4. Result outside root or under an ignored directory → `null`.
5. A **relative** specifier that fails to resolve → diagnostic `UNRESOLVED_IMPORT` (info), max 50 such diagnostics per run (then stop emitting, no summary needed).

`resolveExport(file, exportName, seen = Set)`: returns `{ file, localName }` of the original declaration or `null`.

- Guard cycles with `seen` keyed `file#exportName`.
- Direct export with `localName` → return it. `export { a as b }` (no `from`) → `localName = a`.
- `export { a as b } from './x'` matching `exportName` → `resolveExport(resolve('./x'), a)`.
- `export { default as Foo } from './x'` → resolve `default` in x. `export { default } from './x'` likewise.
- `export * from './x'` (in source order) → first non-null `resolveExport(x, exportName)`; never re-exports `default` through `*`.
- `export default X` (identifier) → `localName = X`. Anonymous default → `localName = null`, helper name `default`.

### 6.10 Linking (`link.ts`)

1. Build the file set: spec files + support files (6.2, computing reachability with the resolver over `imports` and `exports.from`).
2. Build `HelperEntry` for every exported symbol of every support file, **de-duplicated by original declaration** (a helper re-exported through barrels is one entry, defined in its original file). Barrel files (only re-exports) produce no helpers.
3. **References**: for each file, for each import binding whose specifier resolves locally: `resolveExport(targetFile, importedName)` → helper id. Named/default bindings count when the local name appears in that file's `references`. Namespace imports: each `ns.member` access resolves `member`.
4. `referencedByFiles` = distinct files referencing a helper (any file except itself), sorted, cap 25 (`referencedByTruncated` if more). `usedBySpecCount` = number of those that are spec files (compute before truncation).
5. **Test `calls`**: for each test, for each import binding referenced inside the test callback → helper id (constant/function/class). Additionally, inside the callback track simple variable bindings `const|let x = new C(...)` where `C` resolves to a class helper; for each `x.m(...)` where `m` is a public/protected method of that class, add the method id. Also add the class id for `new C(...)`. Fixture parameters are NOT resolved to classes (documented limitation).
6. `Stats`, `tags` (count of tests per tag), `helperDirs`.
7. If `specs` is empty or the total test count is 0 → diagnostic `NO_TESTS_FOUND` (error).

### 6.11 Determinism and performance

- Same input tree → byte-identical `index.json` when `generatedAt` is `null` (deterministic mode: `--no-timestamp` flag or env `SCOUT_DETERMINISTIC=1`).
- Read files with `fs.promises.readFile(…, 'utf8')` using a concurrency limit of 32 (simple pool; no extra dependency). Parse each file once.
- No use of `Date.now()`, `Math.random()`, or object-key iteration order that depends on filesystem order (always sort).

### 6.12 Errors (`errors.ts`)

`class ScoutError extends Error { code: ScoutErrorCode }` with codes: `ROOT_NOT_FOUND`, `NO_TESTS_FOUND`, `INDEX_MISSING`, `INDEX_INVALID`, `INDEX_SCHEMA_MISMATCH`, `NOT_FOUND`, `AMBIGUOUS`, `USAGE`. The CLI maps codes to exit codes (section 7.1).

---

## 7. CLI specification

Binary names: `playwright-scout` and `scout` (both → `dist/bin.js`, first line `#!/usr/bin/env node`). Docs always show `npx playwright-scout`. Built with `commander`; use `exitOverride()` so usage errors map to exit code 2.

**Streams**: results → stdout; progress, warnings, diagnostics → stderr. `--quiet` suppresses stderr except errors.

### 7.1 Exit codes

`0` ok · `1` unexpected error · `2` usage error · `3` no tests found · `4` index missing/invalid (message: `Run: npx playwright-scout map`) · `5` not found / ambiguous.

### 7.2 `map`

`playwright-scout map [--root <dir>] [--out <file>] [--include <glob>...] [--no-timestamp] [--if-stale] [--json] [--verbose] [--quiet]`

- Default `--out`: `<root>/.scout/index.json`. Create the directory and a `.scout/.gitignore` containing `*` (only if absent).
- `--if-stale`: if the index exists, is valid, and its file mtime is newer than every discovered source file and config file → print `scout: index is up to date` and exit 0 without rebuilding.
- If no tests found (exit 3): print the `NO_TESTS_FOUND` message to stderr, do **not** write the index.
- Default stdout (exactly this shape):

```
scout: indexed 4 spec files, 7 tests, 7 helpers (2 page objects), 3 fixtures in 0.3s
index: .scout/index.json (schema v1)
helper dirs: pages (2), utils (2), tests/support (1)
warnings: 2 (use --verbose to list)
```

`helper dirs` line lists `helperDirs` as `<dir> (<count>)`, comma-separated; omit the line if empty. `warnings` line only if diagnostics of severity warn/error exist. `--verbose` prints each diagnostic to stderr as `<severity> <code> <file>:<line> <message>`.

- `--json`: print the summary as JSON `{ "specFiles":…, "tests":…, "helpers":…, "indexPath":… }` instead.

### 7.3 `find`

`playwright-scout find <query...> [--kind helper|method|test|fixture|any] [--limit <n>] [--root <dir>] [--json]`

- Loads the index (exit 4 if missing/invalid). Query = all positional words joined by spaces. Default `--kind any`, `--limit 10`.
- **Candidates**: every helper (`helper`), every class method (`method`), every test (`test`), every fixture (`fixture`).
- **Tokenizer** `tokenize(text)`: split on non-alphanumeric characters; then split camelCase boundaries with `/([a-z0-9])([A-Z])/g → "$1 $2"` and `/([A-Z]+)([A-Z][a-z])/g → "$1 $2"`; lowercase; drop tokens of length 1 and stopwords `a an the for to of and or in on with is are`; unique.
- **Scoring** (all integer math except the half-weights, which round down at the end): for each query token `q` and each field of a candidate, with field weight `w`: exact token match → `+w`; else if `q.length >= 3` and some field token starts with `q` (or `q` starts with a field token of length ≥ 4) → `+floor(w/2)`. Total = sum. **Bonus** `+2` if every query token matched at least once. Candidates with score 0 are dropped.
- **Field weights**: name 5 (helper/method/fixture name; test → none) · methods' names (class only) 3 · title/suitePath joined (test) 4 · tags 3 · navigatesTo 3 · file path 2 · doc 2 · params 1.
- Sort: score desc, then id asc. Apply `--kind` filter **before** scoring, then `--limit`.
- **Kind display vs filter**: the `--kind helper` filter matches all three helper kinds (function, class, constant). In output, the displayed kind is the helper's own `kind` (`function`, `class`, `constant`), or `method`, `test`, `fixture`.
- **Text output**, one line per result, ≤ 200 chars (truncate with `…`):

```
<kind padded to 8> <label>  <file>:<line>  [used in N specs]  [tags: a,b]  — <summary>
```

- `label`: helper → `Name(params)` for functions, `Name` for classes/constants; method → `Class.method(params)`; test → the title (with suite path `A > B > title`); fixture → `name` .
- `used in N specs` only for helpers/methods that have a count > 0 (methods use their class's count). `tags:` only for tests with tags. `summary`: helper/method `doc`, else `returns`/`valuePreview`, else omitted (also omit the `—`).
- Example: `method   LoginPage.login(user: string, pass: string)  pages/login.page.ts:12  used in 1 specs  — Logs in through the UI form.`
- No results: print `scout: no matches for "<query>"` to stdout, exit 0.
- `--json`: array of `{ id, kind, label, file, line, score, usedBySpecCount, summary }`.

### 7.4 `show`

`playwright-scout show <id> [--root <dir>] [--json]`

- `<id>` is a full id, or a **unique suffix** after `#` or `::` or the whole label (e.g. `LoginPage.login`, `uniqueEmail`). Zero matches → exit 5 with `scout: not found: <id>`. More than one → exit 5, list candidate ids (max 10) one per line on stderr.
- Text output by kind:
  - helper/class: `kind name`, `file:line-endLine`, `doc`, `params`/`returns`, `extends`, `category`, methods list (`name(params)`), `navigatesTo`, `used in <usedBySpecCount> specs`, `referenced by:` up to 10 files.
  - method: signature, doc, owning class id, class file:line.
  - test: title, suite path, `file:line`, modifiers, tags, fixtures, `calls:` (ids), `navigatesTo`.
  - fixture: name, scope, auto, option, dependsOn, file:line, testObject.
- `--json`: the raw entry.

### 7.5 `install-skill`

`playwright-scout install-skill [--target claude|agents|github|cursor|all] [--global] [--force] [--root <dir>]`

- Copies the bundled `SKILL.md` (from `packages/cli/skills/playwright-scout/SKILL.md`, populated at build by `scripts/copy-skill.mjs`) into: `claude` → `.claude/skills/playwright-scout/SKILL.md`; `agents` → `.agents/skills/playwright-scout/SKILL.md`; `github` → `.github/skills/playwright-scout/SKILL.md`; `cursor` → `.cursor/skills/playwright-scout/SKILL.md`. Default target: `agents`. `all` = all four. `--global` is valid only with `claude` → `~/.claude/skills/playwright-scout/SKILL.md`.
- Existing file without `--force` → skip and print `skipped (exists): <path>`. Print `installed: <path>` per file.
- Keep the target→directory mapping in **one constant object** so it can be corrected later (agent tools change their skill directories; mention in docs that users should verify their tool's current path).

---

## 8. The skill (`skills/playwright-scout/SKILL.md`) — write exactly this

```markdown
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
```

---

## 9. Sample suite fixture (`fixtures/sample-suite/`)

Create these files exactly (they are parsed, never run; `@playwright/test` need not be installed).

`package.json`: `{ "name": "sample-suite", "private": true, "type": "module" }`

`tsconfig.json`: `{ "compilerOptions": { "baseUrl": ".", "paths": { "@pages/*": ["pages/*"], "@utils/*": ["utils/*"] } } }`

`playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  projects: [{ name: 'chromium' }, { name: 'mobile' }],
});
```

`pages/login.page.ts`

```ts
import type { Page, Locator } from '@playwright/test';
/** Login screen of the app. */
export class LoginPage {
  readonly submit: Locator;
  constructor(private readonly page: Page) {
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }
  /** Logs in through the UI form. */
  async login(user: string, pass: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.getByLabel('User').fill(user);
    await this.page.getByLabel('Password').fill(pass);
    await this.submit.click();
  }
  async errorText(): Promise<string> {
    return this.page.getByRole('alert').innerText();
  }
  private secret() {}
}
```

`pages/checkout.page.ts`

```ts
import type { Page } from '@playwright/test';
export default class CheckoutPage {
  constructor(readonly page: Page) {}
  async open() {
    await this.page.goto('/checkout');
  }
  async applyCoupon(code: string) {
    await this.page.getByPlaceholder('Coupon').fill(code);
  }
}
```

`pages/index.ts`

```ts
export * from './login.page';
export { default as CheckoutPage } from './checkout.page';
```

`utils/auth.ts`

```ts
import type { APIRequestContext } from '@playwright/test';
/** Creates a unique test user email. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}+${Date.now()}@example.com`;
}
export const loginViaApi = async (request: APIRequestContext, user: string) => {
  await request.post('/api/login', { data: { user } });
};
```

`utils/data.ts`

```ts
export const USERS = {
  admin: { name: 'admin', pass: 'secret' },
  guest: { name: 'guest', pass: 'guest' },
};
export const COUPON_CODE = 'SAVE10';
```

`fixtures/index.ts`

```ts
import { test as base, expect } from '@playwright/test';
import { LoginPage, CheckoutPage } from '@pages/index';
type Fx = { loginPage: LoginPage; checkoutPage: CheckoutPage; adminToken: string };
export const test = base.extend<Fx>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  adminToken: [
    async ({}, use) => {
      await use('t');
    },
    { scope: 'worker', auto: true },
  ],
});
export { expect };
```

`tests/login.spec.ts`

```ts
import { test, expect } from '../fixtures/index';
import { USERS } from '../utils/data';
import { uniqueEmail } from '@utils/auth';

test.describe('Login', { tag: '@auth' }, () => {
  test('logs in with valid credentials @smoke', async ({ loginPage, page }) => {
    await loginPage.login(USERS.admin.name, USERS.admin.pass);
    await expect(page).toHaveURL('/home');
  });
  test.skip('shows error for bad password', async ({ loginPage }) => {
    await loginPage.errorText();
  });
  test('registers new user', { tag: ['@auth', '@regression'] }, async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(uniqueEmail());
  });
});

for (const role of ['admin', 'guest']) {
  test(`dashboard for ${role}`, async ({ page }) => {
    await page.goto(`/dashboard`);
  });
}
```

`tests/checkout.spec.ts`

```ts
import { test } from '../fixtures/index';
import { CheckoutPage } from '@pages/index';
import { COUPON_CODE } from '../utils/data';
import * as auth from '../utils/auth.js';

test.describe.serial('Checkout', () => {
  test('applies coupon', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.open();
    await checkout.applyCoupon(COUPON_CODE);
    await auth.loginViaApi(page.request, 'x');
  });
  test.fixme('pays with saved card', async ({ page }) => {});
});
```

`tests/legacy.spec.js`

```js
import { test } from '@playwright/test';
import { uniqueEmail } from '../utils/auth.js';
test('legacy signup', async ({ page }) => {
  await page.goto('/signup');
  uniqueEmail('legacy');
});
```

`tests/broken.spec.ts`: `import { test } from '@playwright/test';` newline `test('broken', async ({ page }) => {` (deliberately unterminated).

`tests/support/unused.ts`

```ts
import type { Page } from '@playwright/test';
/** Waits until the network is idle. */
export async function waitForIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}
```

### 9.1 Expected results (golden test asserts these)

- `project`: `configFile: "playwright.config.ts"`, `testDir: "tests"`, `playwrightProjects: ["chromium","mobile"]`, `language: "mixed"`.
- `stats`: specFiles 4, tests 7, helpers 7, methods 4 (`login`, `errorText`, `open`, `applyCoupon`), pageObjects 2, fixtures 3, tags 3, filesSkipped 0.
- Specs: `tests/broken.spec.ts` (testCount 0, `PARSE_ERROR` warn), `tests/checkout.spec.ts` (2), `tests/legacy.spec.js` (1), `tests/login.spec.ts` (4).
- Helpers (by file): `pages/checkout.page.ts#CheckoutPage` (class, exportName `default`, page-object), `pages/login.page.ts#LoginPage` (class, page-object, doc "Login screen of the app.", navigatesTo `["/login"]`), `tests/support/unused.ts#waitForIdle` (usedBySpecCount 0), `utils/auth.ts#loginViaApi` (async function), `utils/auth.ts#uniqueEmail` (doc "Creates a unique test user email.", params `prefix = 'user'`, returns `string`, usedBySpecCount 2: `tests/login.spec.ts` and `tests/legacy.spec.js`), `utils/data.ts#COUPON_CODE`, `utils/data.ts#USERS` (constants). `fixtures/index.ts#test` and `expect` are NOT helpers. `pages/index.ts` yields no helpers.
- Fixtures: `loginPage` (test, dependsOn `["page"]`), `checkoutPage`, `adminToken` (worker, auto, dependsOn `[]`), all with `testObject: "test"`.
- Tags: `@auth` 3, `@regression` 1, `@smoke` 1 (the `@auth` tag on the describe is inherited by all three tests inside it).
- Test `logs in with valid credentials @smoke`: tags `["@auth","@smoke"]`, fixtures `["loginPage","page"]`, calls `["helper:utils/data.ts#USERS"]`, modifiers `[]`, suitePath `["Login"]`.
- Test `shows error for bad password`: modifiers `["skip"]`.
- Test `dashboard for {…}`: `titleDynamic: true`, `inLoop: true`, `navigatesTo ["/dashboard"]`, suitePath `[]`.
- Test `applies coupon`: calls sorted = `helper:pages/checkout.page.ts#CheckoutPage`, `helper:pages/checkout.page.ts#CheckoutPage.applyCoupon`, `helper:pages/checkout.page.ts#CheckoutPage.open`, `helper:utils/auth.ts#loginViaApi`, `helper:utils/data.ts#COUPON_CODE`; suitePath `["Checkout"]`.
- Test `pays with saved card`: modifiers `["fixme"]`.
- `find coupon` → first two results are `method CheckoutPage.applyCoupon` then `constant COUPON_CODE`.
- `find login` → the first result is `helper:pages/login.page.ts#LoginPage` or `LoginPage.login` (either; assert the top 3 contain `LoginPage.login`).
- `show LoginPage.login` → exact match resolves; `show login` → ambiguous (exit 5).

---

## 10. Task plan (do in order)

**T0 Scaffold.** Create the layout in section 3, root/package configs, ESLint flat config (typescript-eslint recommended + eslint-config-prettier), Prettier (`singleQuote`, `printWidth: 100`, trailing commas `all`), `.gitignore`, MIT LICENSE (`<YOUR NAME>` placeholder), `AGENTS.md`, CI workflow (12.3), `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/SPEC.md` (this file). Add one trivial passing test per package. _Accept:_ `npm ci && npm run check` passes on a fresh clone.

**T1 Schema & IO.** `schema.ts` (zod for every type in section 5), `errors.ts`, `paths.ts`, `io.ts` (`writeIndex`, `readIndex`, deterministic serialisation, `.scout/.gitignore`). _Tests:_ valid minimal index round-trips byte-identically; invalid JSON → `INDEX_INVALID`; `schemaVersion: 2` → `INDEX_SCHEMA_MISMATCH`. _Accept:_ 100% of schema types exported from `index.ts`.

**T2 Discovery & config.** `discover.ts`, `config.ts` (6.1–6.3). _Tests (using the sample suite):_ finds 4 spec files; ignores `node_modules`; reads `testDir` `tests` and both project names; dynamic `testDir: process.env.X` → default + `CONFIG_DYNAMIC`; missing config → `CONFIG_NOT_FOUND`; tsconfig paths loaded.

**T3 Parse & resolve.** `parse.ts`, `resolve.ts` (6.4, 6.9). _Tests:_ `../utils/auth.js` resolves to `utils/auth.ts`; alias `@utils/auth` resolves; `@pages/index` resolves; directory import resolves to `index`; external package → null; `resolveExport` follows `export *`, `export { default as X } from`, cycles terminate; broken file → parse errors detected.

**T4 Helper & fixture facts.** `facts.ts` helper/fixture/test-object parts (6.5, 6.6). _Tests:_ every helper expectation in 9.1 at the facts level (params text, docs, methods excluding private, category, valuePreview).

**T5 Test-tree facts.** Test extraction (6.7). _Tests:_ the four login tests, loop, modifiers, `test.skip(cond)` inside a body is ignored, `test.describe.configure` ignored, tag parsing from title and details, dynamic title rendering, unrecognised second-argument shapes do not crash.

**T6 Linking & build.** `link.ts`, `build.ts` (6.10, 6.11). `buildIndex({ root, include?, deterministic? })` returns `Index`. _Tests:_ the complete 9.1 expectations; running twice yields identical serialised output; helper dirs correct; `NO_TESTS_FOUND` error path.

**T7 CLI `map`.** `bin.ts`, `program.ts`, `commands/map.ts`, `format.ts` (7.1, 7.2). _Tests:_ run `program` in-process (inject stdout/stderr writers and root) for: normal output shape, `--json`, `--if-stale` (up to date vs stale after touching a file), exit code 3 on an empty dir, `.scout/.gitignore` created. _Accept:_ `node packages/cli/dist/bin.js map --root fixtures/sample-suite` prints the summary.

**T8 Search & show.** `search.ts`, `show.ts`, commands `find`, `show` (7.3, 7.4). _Tests:_ tokenizer (`applyCoupon` → `apply`,`coupon`; `COUPON_CODE` → `coupon`,`code`; `getByRole` → `get`,`by`,`role`), scoring examples in 9.1, `--kind`, `--limit`, `--json`, ambiguous/unique-suffix `show`, exit codes 4 and 5.

**T9 Robustness.** Tests: empty file; file with only comments; huge file (>1 MiB) skipped; CRLF line endings give the same line numbers; Windows-style paths normalised (unit-test `paths.ts` with `path.win32`); 1,000 generated tiny spec files build in under 5 s (assert < 15 s in CI to avoid flakiness); non-UTF8 file does not crash.

**T10 Skill & installer.** Write `SKILL.md` (section 8), `scripts/copy-skill.mjs`, `install-skill` command (7.5). _Tests:_ installs into a temp dir for each target; skips existing; `--force` overwrites; `--global` with a non-claude target → usage error 2.

**T11 Docs.** `README.md` (headline, 60-second quickstart: `npx playwright-scout map` → `find` → `show`, how the skill works, limitations list, supported platforms, comparison to "just grepping"), `docs/SCHEMA.md` (generated by hand from section 5), `docs/CLI.md`, `CONTRIBUTING.md`, `CHANGELOG.md` (`0.1.0` entry). README MUST list the known limitations from section 14.

**T12 Dry run on real code.** Run `map` on 2–3 public Playwright projects (network access may be unavailable — if so, skip and note it in `PROGRESS.md` as a human task). Record wall time, counts, and any crash or wrong result in `docs/DECISIONS.md`; fix crashes; add a regression test for each.

**T13 Release prep (human does the publish).** Set both package versions to `0.1.0`; `files`, `exports`, `types`, `bin`, `engines`, `repository`, `license`, `keywords` (`playwright`, `testing`, `agent-skill`, `ai`, `test-automation`), `publishConfig.access: public` filled in; `npm pack --dry-run` in each package shows only `dist`, `README`, `LICENSE` (plus `skills/` for cli). **Do not publish.**

---

## 11. Testing strategy

- Prefer testing `core` functions directly over CLI. CLI tests run the commander `program` in-process with injectable `stdout`/`stderr` write functions and a `cwd/root` parameter, so no child processes are needed except one smoke test of the built binary.
- Golden approach: build the sample-suite index in deterministic mode and assert on **specific fields** from 9.1 (not a whole-file snapshot), plus one whole-file snapshot stored at `packages/core/test/__snapshots__/sample-suite.index.json` for change visibility.
- Every bug fixed gets a test first.
- Coverage is not gated, but every exported function in `core` MUST have at least one test.

---

## 12. Boilerplate to copy

### 12.1 Package manifest essentials

Root `package.json`: `{ "name": "playwright-scout-monorepo", "private": true, "type": "module", "workspaces": ["packages/*"], "engines": { "node": ">=20" }, "scripts": { … section 4 … } }`.
`packages/core/package.json`: name `playwright-scout-core`, `type: module`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`, `exports: { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`, `files: ["dist"]`.
`packages/cli/package.json`: name `playwright-scout`, `bin: { "playwright-scout": "dist/bin.js", "scout": "dist/bin.js" }`, `files: ["dist", "skills"]`, dependency `"playwright-scout-core": "*"` (workspace).

### 12.2 `AGENTS.md` (copy verbatim to repo root)

```markdown
# AGENTS.md

Project: playwright-scout — static index of a Playwright suite + agent skill. Full spec: docs/SPEC.md.

## Commands

- Install: `npm ci`
- Full check (run before every commit): `npm run check`
- Tests only: `npm test` · Build: `npm run build`
- Try the CLI: `node packages/cli/dist/bin.js map --root fixtures/sample-suite`

## Rules

- ESM only. Relative imports in source end with `.js`. Use `import type` for types.
- `core` never prints, never exits, never executes analysed code. Only `cli` prints.
- All paths in output are POSIX and relative to the root. Sort with code-unit comparison, never localeCompare.
- Output must be deterministic. No Date/Random in the index (except generatedAt, nullable).
- No `any`. No new dependencies without recording why in docs/DECISIONS.md.
- One task at a time from docs/SPEC.md section 10. Update docs/PROGRESS.md. One Conventional Commit per task.
- Never run `npm publish`.

## Layout

packages/core = library, packages/cli = commands, skills/ = SKILL.md, fixtures/sample-suite = test input.
```

### 12.3 CI (`.github/workflows/ci.yml`)

Trigger on `push` (main) and `pull_request`. Matrix: `os: [ubuntu-latest, macos-latest]`, `node: [20, 22]`. Steps: `actions/checkout`, `actions/setup-node` (with `node-version` and `cache: npm`), `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. Use current major versions of the actions (verify).

---

## 13. Quality bar checklist (review before finishing each task)

- Would the output be identical if files were listed in a different order? (must be)
- Any absolute path, `\` separator, or locale-dependent sort? (must not)
- Any code path that could throw on unexpected syntax (unusual argument shapes, missing callbacks, spread arguments)? Guard and continue; never crash on one bad file — convert to a diagnostic.
- Any `console.*` or `process.exit` inside `core`? (must not)
- Any type assertion (`as`) that could be replaced by a type guard? Replace it (except the single documented `parseDiagnostics` access).

## 14. Known limitations (must appear in README)

CommonJS files are not indexed. Fixture parameters are not linked to the classes they construct, so `loginPage.login()` calls made through fixtures are not recorded in `calls` (the fixture name is recorded in `fixtures`). Only string-literal `goto` arguments are captured. Dynamic test titles are approximated. Monorepos with several Playwright configs are analysed one root at a time. Only ESM-style imports/exports are followed.

## 15. Definition of done (v0.1)

- [ ] T0–T12 complete; `PROGRESS.md` all checked; `npm run check` green on CI (Node 20 and 22, ubuntu and macOS).
- [ ] `map`, `find`, `show`, `install-skill` behave exactly as section 7 on the sample suite.
- [ ] Skill file installed by `install-skill` matches section 8.
- [ ] README quickstart works copy-paste on the sample suite.
- [ ] `npm pack --dry-run` output reviewed (T13).

## 16. Roadmap (not part of this build)

- **v0.2**: `audit` command (static rules: hard waits, brittle locators, redundant assertions) reading the same facts; benchmark harness in `bench/` — task files with `mustReuse` symbol ids and `mustNotCreate` flag, scored deterministically by re-running `map` before/after and diffing (`tests[].calls` contains the required ids; count of new exported helpers), plus tokens and pass/fail from the agent log; report "with vs without skill".
- **v0.3**: flake-doctor skill; caching by content hash (facts are already per-file and pure); CommonJS support; fixture-to-class linking.
- **Later**: MCP server exposing `find/show`; the separate `playwright-logbook` reporter imports `playwright-scout-core` for the project view and adds run data.

## 17. Human-only steps (the assistant must not do these)

1. Replace `<YOUR NAME>` in `LICENSE`.
2. Create the GitHub repo `playwright-scout` under your personal account; push; pin it on the profile.
3. Confirm the skill directory each agent tool currently uses and adjust the single mapping constant in `install-skill` if needed.
4. Check the npm names `playwright-scout` and `playwright-scout-core` are still free, then `npm publish` each package (`--access public`).
5. Add repo topics: `playwright`, `agent-skills`, `test-automation`, `ai-agents`.
