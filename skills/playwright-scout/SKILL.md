---
name: playwright-scout
description: Use when a Playwright suite change needs help finding reusable code, relevant examples, conventions, or static impact, or when explicitly asked for setup/test-code review. Skip Scout queries for an obvious local edit with a clear nearby example.
---

# playwright-scout

Find only the suite context that helps with the requested change. Scout queries are optional, not a prerequisite for editing Playwright code.

## Workflow

For a narrow edit in a known file with a clear nearby example, inspect that source and work directly. Skip `map` and `context` unless reuse or impact remains unclear.

When the task spans files or the right existing code is uncertain, run from the project root:

1. Refresh the static index: `npx playwright-scout map --if-stale --quiet`.
2. Get a bounded task capsule only when broader context is useful: `npx playwright-scout context "<task>"` (default 1800 characters). Request more evidence on demand with `npx playwright-scout show <cited-id>`, or search with `npx playwright-scout find <words>`. Increase `--max-chars` only when needed.
3. Inspect the cited source before reusing it; avoid broad file scans when a relevant path is already known. If a relevant match is unsuitable, briefly explain why.
4. When changing a shared helper or method and its callers are unclear, use `npx playwright-scout impact <id-or-label>`. For a source file, use `npx playwright-scout impact --file <root-relative-path>`. These show known static links; an empty list does not prove other tests are unaffected.
5. If you changed exported test support code and will make further Scout queries, refresh with `npx playwright-scout map` first.

Scout's brief reports observed patterns and unknowns; it does not know business expectations unless the user supplies them. Some fixture shapes and dynamic calls are unlinked. If something seems missing, inspect the code directly. Do not read or edit `.scout/index.json` by hand or commit `.scout/`. Use `--json` when structured output helps. Confirm that your agent reads the directory where `install-skill` placed this file.

Framework reviews are separate, opt-in work. Only when the user asks for setup guidance, run `npx playwright-scout doctor`; only when asked to review test-code practices, run `npx playwright-scout review --file <root-relative-source-file>`. Neither command needs an index. Treat findings as suggestions with narrow static evidence, not defects or a quality score. Do not interrupt an ordinary test task to critique a working setup, or require cleanup before unrelated work. Runtime failures and artifacts belong to the project's Playwright tools and Logbook, if installed.
