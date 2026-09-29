import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFacts } from '../src/facts.js';
import { parseFile } from '../src/parse.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

function factsFor(file: string, isSpec = false) {
  const text = fs.readFileSync(path.join(SAMPLE, file), 'utf8');
  return extractFacts(file, parseFile(file, text), isSpec);
}

describe('extractFacts imports and exports', () => {
  it('extracts barrel re-exports from pages/index.ts', () => {
    const facts = factsFor('pages/index.ts');
    expect(facts.exports).toEqual([
      { exportName: '*', localName: null, from: './login.page', importedName: null, star: true },
      { exportName: 'CheckoutPage', localName: 'default', from: './checkout.page', importedName: 'default', star: false },
    ]);
  });

  it('extracts named, default, and namespace imports from checkout.spec.ts', () => {
    const facts = factsFor('tests/checkout.spec.ts', true);
    expect(facts.imports.map(({ specifier, kind, imported, local, typeOnly }) => ({ specifier, kind, imported, local, typeOnly }))).toEqual([
      { specifier: '../fixtures/index', kind: 'named', imported: 'test', local: 'test', typeOnly: false },
      { specifier: '@pages/index', kind: 'named', imported: 'CheckoutPage', local: 'CheckoutPage', typeOnly: false },
      { specifier: '../utils/data', kind: 'named', imported: 'COUPON_CODE', local: 'COUPON_CODE', typeOnly: false },
      { specifier: '../utils/auth.js', kind: 'namespace', imported: null, local: 'auth', typeOnly: false },
    ]);
  });
});
