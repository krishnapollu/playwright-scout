import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildIndex } from '../src/build.js';
import { boundTaskBrief, buildTaskBrief } from '../src/task-context.js';
import type { Index } from '../src/schema.js';

const ROOT = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));
let index: Index;
beforeAll(async () => { index = await buildIndex({ root: ROOT, deterministic: true }); });

describe('task brief', () => {
  it('cites a reusable method and an analogous test', () => {
    const brief = buildTaskBrief(index, 'coupon checkout');
    expect(brief.reuse.some((item) => item.id.endsWith('CheckoutPage.applyCoupon') && item.reason === 'query_match')).toBe(true);
    expect(brief.analogousTest?.file).toBe('tests/checkout.spec.ts');
    expect(brief.unknowns).toContain('Business expectations are not supplied by the source index.');
    for (const item of brief.reuse) expect(item.line).toBeGreaterThan(0);
  });

  it('describes a proven fixture provider without inventing an unresolved one', () => {
    const brief = buildTaskBrief(index, 'loginPage');
    expect(brief.reuse.find((item) => item.id === 'fixture:fixtures/index.ts#loginPage')?.summary).toContain('LoginPage');
    expect(brief.reuse.some((item) => item.id.includes('CheckoutPage'))).toBe(false);
    expect(brief.setupAndData.some((item) => item.id === 'fixture:fixtures/index.ts#loginPage')).toBe(false);
  });

  it('prefers a test using multiple relevant methods over a generic title match', () => {
    const helperTemplate = index.helpers.find((entry) => entry.kind === 'class' && entry.methods.length > 0);
    const methodTemplate = helperTemplate?.methods[0];
    const testTemplate = index.tests[0];
    if (!helperTemplate || !methodTemplate || !testTemplate) throw new Error('Missing test templates');
    const ownerId = 'helper:pages/ProductsPage.ts#ProductsPage';
    const method = (name: string, line: number) => ({ ...methodTemplate, id: `${ownerId}.${name}`, name, line });
    const helper = { ...helperTemplate, id: ownerId, name: 'ProductsPage', exportName: 'ProductsPage',
      file: 'pages/ProductsPage.ts', methods: [method('addProductToCart', 10), method('getProductNames', 20), method('searchProduct', 30)] };
    const test = (title: string, line: number, calls: string[]) => ({ ...testTemplate,
      id: `test:tests/products/web.spec.ts::Products > ${title}`, title, file: 'tests/products/web.spec.ts', line,
      suitePath: ['Products'], calls: [ownerId, ...calls.map((name) => `${ownerId}.${name}`)], fixtures: [] });
    const apiWeb = { ...test('product search is available through API and web', 5, ['searchProduct', 'getProductNames']),
      id: 'test:tests/products/api-web.spec.ts::product search is available through API and web',
      file: 'tests/products/api-web.spec.ts' };
    const suite: Index = { ...index, helpers: [helper], fixtures: [], tests: [
      apiWeb,
      test('add product to cart shows modal', 10, ['addProductToCart']),
      test('search for dress returns results', 20, ['searchProduct', 'getProductNames']),
      test('search for tshirt returns results', 30, ['searchProduct']),
    ] };
    const brief = buildTaskBrief(suite, 'Add a Playwright test for searching for jeans on the Products page. Verify every displayed product name contains jeans.');
    expect(brief.analogousTest?.label).toBe('search for dress returns results');
    expect(brief.analogousTest?.reason).toBe('called_by_related_test');
  });

  it('renders complete, deterministic text and JSON within the declared size', () => {
    const brief = buildTaskBrief(index, 'coupon checkout', { staleIndex: true });
    for (const format of ['text', 'json'] as const) {
      const first = boundTaskBrief(brief, 650, format);
      const second = boundTaskBrief(brief, 650, format);
      expect(first.output).toBe(second.output);
      expect(first.output.length).toBeLessThanOrEqual(650);
      expect(first.brief.staleIndex).toBe(true);
      expect(Object.values(first.brief.omitted).some((count) => count > 0)).toBe(true);
      if (format === 'json') expect(JSON.parse(first.output)).toEqual(first.brief);
    }
  });

  it('reports missing evidence without claiming a business gap', () => {
    const brief = buildTaskBrief(index, 'quantum hedgehog');
    expect(brief.analogousTest).toBeNull();
    expect(brief.unknowns.join(' ')).toContain('No indexed test clearly matches');
    expect(brief.unknowns.join(' ')).not.toContain('coverage gap');
  });

  it('does not recommend a test sharing only one incidental task word', () => {
    const brief = buildTaskBrief(index, 'unrelated new visual layout');
    expect(brief.reuse).toEqual([]);
    expect(brief.analogousTest).toBeNull();
    expect(brief.unknowns.join(' ')).toContain('No indexed test clearly matches');
  });

  it('rejects impossible budgets', () => {
    expect(() => boundTaskBrief(buildTaskBrief(index, 'coupon'), 499, 'text')).toThrow();
    expect(() => boundTaskBrief(buildTaskBrief(index, 'coupon '.repeat(200)), 500, 'text')).toThrow();
    expect(boundTaskBrief(buildTaskBrief(index, 'coupon'), 500, 'json').output.length).toBeLessThanOrEqual(500);
  });
});
