import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTsAliasConfig } from '../src/config.js';
import { extractFacts } from '../src/facts.js';
import { linkFiles } from '../src/link.js';
import { parseFile } from '../src/parse.js';
import { resolveSpecifier } from '../src/resolve.js';
import type { Diagnostic } from '../src/schema.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

describe('linkFiles', () => {
  it('links imported helpers to tests and records distinct spec references', () => {
    const files = [
      'tests/checkout.spec.ts',
      'pages/index.ts',
      'pages/checkout.page.ts',
      'utils/auth.ts',
      'utils/data.ts',
    ];
    const factsByFile = new Map(
      files.map((file) => {
        const text = fs.readFileSync(path.join(SAMPLE, file), 'utf8');
        return [file, extractFacts(file, parseFile(file, text), file === 'tests/checkout.spec.ts')];
      }),
    );
    const diagnostics: Diagnostic[] = [];
    const linked = linkFiles(files, factsByFile, diagnostics, {
      root: SAMPLE,
      aliasConfig: readTsAliasConfig(SAMPLE, 'tests'),
      specFiles: new Set(['tests/checkout.spec.ts']),
    });
    const test = linked.tests.find((entry) => entry.title === 'applies coupon');

    expect(test?.calls).toEqual([
      'helper:pages/checkout.page.ts#CheckoutPage',
      'helper:pages/checkout.page.ts#CheckoutPage.applyCoupon',
      'helper:pages/checkout.page.ts#CheckoutPage.open',
      'helper:utils/auth.ts#loginViaApi',
      'helper:utils/data.ts#COUPON_CODE',
    ]);
    expect(linked.helpers.find((entry) => entry.name === 'COUPON_CODE')?.usedBySpecCount).toBe(1);
    expect(
      linked.helpers.find((entry) => entry.name === 'COUPON_CODE')?.referencedByFiles,
    ).toContain('tests/checkout.spec.ts');
    expect(
      resolveSpecifier(
        'tests/checkout.spec.ts',
        '../utils/data',
        readTsAliasConfig(SAMPLE, 'tests'),
        SAMPLE,
      ),
    ).toBe('utils/data.ts');
  });
});
