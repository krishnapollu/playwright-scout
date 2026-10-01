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

  it('rejects impossible budgets', () => {
    expect(() => boundTaskBrief(buildTaskBrief(index, 'coupon'), 499, 'text')).toThrow();
    expect(() => boundTaskBrief(buildTaskBrief(index, 'coupon '.repeat(200)), 500, 'text')).toThrow();
  });
});
