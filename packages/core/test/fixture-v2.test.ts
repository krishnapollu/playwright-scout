import { describe, expect, it } from 'vitest';
import { extractFacts } from '../src/facts.js';
import { parseFile } from '../src/parse.js';

/** Syntax cases for the v0.2 fixture linker. No analyzed code is executed. */
export const fixtureCases = {
  direct: `import { LoginPage } from '../pages/login.js';
export const test = base.extend({ loginPage: async ({ page }, use) => { await use(new LoginPage(page)); } });`,
  barrel: `import { LoginPage } from '../pages/index.js';
export const test = base.extend({ loginPage: async ({ page }, use) => { await use(new LoginPage(page)); } });`,
  function: `import { makeAccount } from '../utils/accounts.js';
export const test = base.extend({ account: async ({}, use) => { await use(makeAccount()); } });`,
  options: `import { LoginPage } from '../pages/login.js';
export const test = base.extend({ loginPage: [async ({ page }, use) => { await use(new LoginPage(page)); }, { scope: 'worker' }] });`,
  unresolved: `export const test = base.extend({ loginPage: async ({ page }, use) => { await use(new MissingPage(page)); } });`,
  conditional: `import { LoginPage } from '../pages/login.js';
export const test = base.extend({ loginPage: async ({ page }, use) => { await use(flag ? new LoginPage(page) : page); } });`,
} as const;

describe('v0.2 fixture syntax baseline', () => {
  for (const [name, source] of Object.entries(fixtureCases)) {
    it(`keeps a fixture entry for ${name}`, () => {
      const file = `fixtures/${name}.ts`;
      const facts = extractFacts(file, parseFile(file, source), false);
      expect(facts.fixtureDefs).toHaveLength(1);
      expect(facts.fixtureDefs[0]?.file).toBe(file);
    });
  }

  it('extracts only direct, unambiguous use providers', () => {
    const providers = Object.entries(fixtureCases).map(([name, source]) => {
      const file = `fixtures/${name}.ts`;
      return [name, extractFacts(file, parseFile(file, source), false).fixtureDefs[0]?.provider];
    });
    expect(providers).toEqual([
      ['direct', { name: 'LoginPage', kind: 'class' }],
      ['barrel', { name: 'LoginPage', kind: 'class' }],
      ['function', { name: 'makeAccount', kind: 'function' }],
      ['options', { name: 'LoginPage', kind: 'class' }],
      ['unresolved', { name: 'MissingPage', kind: 'class' }],
      ['conditional', null],
    ]);
  });

  it('keeps same-name fixtures from different test objects distinct', () => {
    const file = 'fixtures/two.ts';
    const source = `export const admin = base.extend({ account: async ({}, use) => { await use(1); } });
export const guest = base.extend({ account: async ({}, use) => { await use(2); } });`;
    const facts = extractFacts(file, parseFile(file, source), false);
    expect(facts.fixtureDefs.map(({ name, testObject }) => [name, testObject])).toEqual([
      ['account', 'admin'],
      ['account', 'guest'],
    ]);
  });
});
