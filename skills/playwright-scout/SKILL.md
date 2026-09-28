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
