import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reviewSource } from '../src/review.js';

const fixture = fileURLToPath(new URL('../../../fixtures/guidance-suite/tests/example.spec.ts', import.meta.url));

describe('reviewSource', () => {
  it('reports two conservative patterns in source order', async () => {
    const result = reviewSource('tests/example.spec.ts', await fs.readFile(fixture, 'utf8'));
    expect(result.findings.map((item) => [item.ruleId, item.file, item.line])).toEqual([
      ['test.fixed-wait', 'tests/example.spec.ts', 4],
      ['test.manual-visibility-assertion', 'tests/example.spec.ts', 5],
    ]);
    expect(result.unknowns).toEqual([]);
    expect(reviewSource('tests/example.spec.ts', await fs.readFile(fixture, 'utf8'))).toEqual(result);
  });

  it('does not flag similarly named methods or unrelated boolean assertions', () => {
    const text = [
      "import { test, expect } from '@playwright/test';",
      'const other = { waitForTimeout: async () => {}, isVisible: async () => true };',
      "test('safe', async ({ page }) => {",
      '  await other.waitForTimeout();',
      '  expect(await other.isVisible()).toBe(true);',
      '  await expect(page.getByText(\'ready\')).toBeVisible();',
      '});',
    ].join('\n');
    expect(reviewSource('tests/safe.spec.ts', text).findings).toEqual([]);
  });

  it('supports aliases for imported test and expect and the page fixture', () => {
    const text = [
      "import { test as pwTest, expect as pwExpect } from '@playwright/test';",
      "pwTest('aliased', async ({ page: currentPage }) => {",
      '  await currentPage.waitForTimeout(10);',
      '  pwExpect(await currentPage.getByText(\'ready\').isVisible()).toBe(true);',
      '});',
    ].join('\n');
    expect(reviewSource('tests/aliased.spec.ts', text).findings).toHaveLength(2);
  });

  it('does not act on unrelated imports or malformed source', () => {
    const unrelated = "import { test, expect } from './fake'; test('x', async ({ page }) => { await page.waitForTimeout(1); });";
    expect(reviewSource('tests/fake.spec.ts', unrelated).findings).toEqual([]);
    const malformed = reviewSource('tests/broken.spec.ts', "import { test } from '@playwright/test'; test('x', async ({ page }) => {");
    expect(malformed.findings).toEqual([]);
    expect(malformed.unknowns).toHaveLength(1);
  });
});
