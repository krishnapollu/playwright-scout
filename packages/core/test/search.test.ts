import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildContext, buildIndex, searchIndex, tokenize } from '../src/index.js';
import type { Index } from '../src/index.js';

const ROOT = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));
let index: Index;

beforeAll(async () => {
  index = await buildIndex({ root: ROOT, deterministic: true });
});

describe('tokenize', () => {
  it('splits camelCase and underscore names', () => {
    expect(tokenize('applyCoupon')).toEqual(['apply', 'coupon']);
    expect(tokenize('COUPON_CODE')).toEqual(['coupon', 'code']);
    expect(tokenize('getByRole')).toEqual(['get', 'by', 'role']);
  });
});

describe('searchIndex', () => {
  it('ranks the coupon method and constant ahead of the matching test', () => {
    expect(searchIndex(index, 'coupon').slice(0, 2).map((result) => result.id)).toEqual([
      'helper:pages/checkout.page.ts#CheckoutPage.applyCoupon',
      'helper:utils/data.ts#COUPON_CODE',
    ]);
  });

  it('filters candidates before scoring', () => {
    expect(searchIndex(index, 'coupon', { kind: 'method' }).every((result) => result.kind === 'method')).toBe(true);
  });
});

describe('buildContext', () => {
  it('expands a search result into related suite evidence', () => {
    const context = buildContext(index, 'coupon');
    expect(context.matches[0]?.id).toBe('helper:pages/checkout.page.ts#CheckoutPage.applyCoupon');
    expect(context.relatedSpecs).toContain('tests/checkout.spec.ts');
    expect(context.relatedHelpers).toContain('helper:pages/checkout.page.ts#CheckoutPage');
    expect(context.routes).toContain('/checkout');
  });
});
