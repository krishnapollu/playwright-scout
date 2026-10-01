import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../src/build.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function project(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-fixture-v2-'));
  roots.push(root);
  const files = new Map([
    ['playwright.config.ts', "export default { testDir: 'tests' };"],
    ['pages/login.ts', 'export class LoginPage { async login() {} } export class OtherPage { async login() {} }'],
    ['pages/index.ts', "export { LoginPage, OtherPage } from './login';"],
    ['utils/accounts.ts', 'export function makeAccount() { return { id: 1 }; }'],
    ['fixtures/index.ts', `import { test as base } from '@playwright/test';
import { LoginPage, OtherPage } from '../pages/index';
import { makeAccount } from '../utils/accounts';
export const test = base.extend({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  account: [async ({}, use) => { await use(makeAccount()); }, { scope: 'worker' }],
  missing: async ({}, use) => { await use(new MissingPage()); },
  conditional: async ({}, use) => { await use(flag ? new OtherPage() : null); },
});
export const other = base.extend({ loginPage: async ({ page }, use) => { await use(new OtherPage(page)); } });`],
    ['tests/login.spec.ts', `import { test } from '../fixtures/index';
test('logs in', async ({ loginPage, account, missing, conditional }) => {
  await loginPage.login();
  account; missing; conditional;
});`],
  ]);
  await Promise.all([...files].map(async ([name, contents]) => {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }));
  return root;
}

describe('v0.2 fixture graph', () => {
  it('links proven providers and calls without crossing test objects', async () => {
    const root = await project();
    const index = await buildIndex({ root, deterministic: true });
    const fixture = index.fixtures.find((item) => item.name === 'loginPage' && item.testObject === 'test');
    expect(fixture?.providesHelperIds).toEqual(['helper:pages/login.ts#LoginPage']);
    expect(index.fixtures.find((item) => item.name === 'account')?.providesHelperIds).toEqual(['helper:utils/accounts.ts#makeAccount']);
    expect(index.fixtures.find((item) => item.name === 'missing')?.providesHelperIds).toEqual([]);
    expect(index.fixtures.find((item) => item.name === 'conditional')?.providesHelperIds).toEqual([]);
    expect(new Set(index.fixtures.map((item) => item.id)).size).toBe(index.fixtures.length);
    expect(index.tests[0]?.calls).toEqual([
      'helper:pages/login.ts#LoginPage',
      'helper:pages/login.ts#LoginPage.login',
      'helper:utils/accounts.ts#makeAccount',
    ]);
    expect(index.tests[0]?.calls).not.toContain('helper:pages/login.ts#OtherPage.login');
  });
});
