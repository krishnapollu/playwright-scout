---
name: playwright-scout
description: Use when creating or changing Playwright tests, page objects, fixtures, or test helpers in a project with Scout installed, or when explicitly asked to review Playwright setup or test-code practices. Finds reusable code and known static impact; framework guidance is opt-in.
---

# playwright-scout

Understand the existing Playwright suite before changing its tests or support code.

## Workflow

Run these from the project root when the task involves Playwright code:

1. Refresh the static index: `npx playwright-scout map --if-stale --quiet`.
2. Get a bounded task brief for broader work: `npx playwright-scout context "<task>" --max-chars 6000`. For a specific symbol, use `npx playwright-scout find <words>` and `npx playwright-scout show <id-or-label>`.
3. Reuse a relevant helper, page object, or fixture when it fits the task. Inspect the referenced source before editing. If a relevant match is unsuitable, briefly explain why.
4. When changing an existing helper or method, use `npx playwright-scout impact <id-or-label>`. For a source file, use `npx playwright-scout impact --file <root-relative-path>`. These show known static links; an empty list does not prove other tests are unaffected.
5. After changing exported test support code, refresh with `npx playwright-scout map`.

Scout's brief reports observed patterns and unknowns; it does not know business expectations unless the user supplies them. Some fixture shapes and dynamic calls are unlinked. If something seems missing, inspect the code directly. Do not read or edit `.scout/index.json` by hand or commit `.scout/`. Use `--json` when structured output helps. Confirm that your agent reads the directory where `install-skill` placed this file.

Framework reviews are separate, opt-in work. Only when the user asks for setup guidance, run `npx playwright-scout doctor`; only when asked to review test-code practices, run `npx playwright-scout review --file <root-relative-source-file>`. Neither command needs an index. Treat findings as suggestions with narrow static evidence, not defects or a quality score. Do not interrupt an ordinary test task to critique a working setup, or require cleanup before unrelated work. Runtime failures and artifacts belong to the project's Playwright tools and Logbook, if installed.
