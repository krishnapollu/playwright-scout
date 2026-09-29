import { describe, expect, it, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildIndex, searchIndex, showEntry } from '../src/index.js';
import type { Index } from '../src/index.js';

// Golden test for docs/SPEC.md section 9.1. It is the definition of "done" for the core.
// Do not weaken an assertion to make it pass. Fix the code instead.

const ROOT = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));

let index: Index;

beforeAll(async () => {
  index = await buildIndex({ root: ROOT, deterministic: true });
});

const testByTitle = (title: string) => {
  const found = index.tests.filter((t) => t.title === title);
  expect(found, `expected exactly one test titled "${title}"`).toHaveLength(1);
  return found[0]!;
};

describe('project and stats', () => {
  it('reads the playwright config statically', () => {
    expect(index.project.configFile).toBe('playwright.config.ts');
    expect(index.project.testDir).toBe('tests');
    expect(index.project.playwrightProjects).toEqual(['chromium', 'mobile']);
    expect(index.project.language).toBe('mixed');
  });

  it('has the expected counts', () => {
    expect(index.stats).toMatchObject({
      specFiles: 4,
      tests: 7,
      helpers: 7,
      methods: 4,
      pageObjects: 2,
      fixtures: 3,
      tags: 3,
      filesSkipped: 0,
    });
  });

  it('is deterministic', async () => {
    const again = await buildIndex({ root: ROOT, deterministic: true });
    expect(JSON.stringify(again)).toBe(JSON.stringify(index));
    expect(index.generatedAt).toBeNull();
  });
});

describe('specs and tests', () => {
  it('lists the four spec files with their test counts', () => {
    const counts = Object.fromEntries(index.specs.map((s) => [s.file, s.testCount]));
    expect(counts).toEqual({
      'tests/broken.spec.ts': 0,
      'tests/checkout.spec.ts': 2,
      'tests/legacy.spec.js': 1,
      'tests/login.spec.ts': 4,
    });
  });

  it('never records the same test twice', () => {
    const ids = index.tests.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(index.tests).toHaveLength(7);
  });

  it('records real 1-based line numbers, not character offsets', () => {
    const t = testByTitle('logs in with valid credentials @smoke');
    expect(t.file).toBe('tests/login.spec.ts');
    expect(t.line).toBe(6);
    expect(t.endLine).toBe(9);
    expect(t.column).toBe(3);
  });

  it('extracts tags, fixtures, calls and suite path for the smoke test', () => {
    const t = testByTitle('logs in with valid credentials @smoke');
    expect(t.tags).toEqual(['@auth', '@smoke']);
    expect(t.fixtures).toEqual(['loginPage', 'page']);
    expect(t.calls).toEqual(['helper:utils/data.ts#USERS']);
    expect(t.modifiers).toEqual([]);
    expect(t.suitePath).toEqual(['Login']);
  });

  it('handles test.skip("title", fn) as a skip modifier and inherits the describe tag', () => {
    const t = testByTitle('shows error for bad password');
    expect(t.modifiers).toEqual(['skip']);
    expect(t.tags).toEqual(['@auth']);
  });

  it('reads tags from the details argument', () => {
    expect(testByTitle('registers new user').tags).toEqual(['@auth', '@regression']);
  });

  it('renders dynamic titles and marks loop tests', () => {
    const t = testByTitle('dashboard for {…}');
    expect(t.titleDynamic).toBe(true);
    expect(t.inLoop).toBe(true);
    expect(t.navigatesTo).toEqual(['/dashboard']);
    expect(t.suitePath).toEqual([]);
  });

  it('resolves calls through barrels, default exports, aliases and namespace imports', () => {
    const t = testByTitle('applies coupon');
    expect(t.suitePath).toEqual(['Checkout']);
    expect(t.calls).toEqual([
      'helper:pages/checkout.page.ts#CheckoutPage',
      'helper:pages/checkout.page.ts#CheckoutPage.applyCoupon',
      'helper:pages/checkout.page.ts#CheckoutPage.open',
      'helper:utils/auth.ts#loginViaApi',
      'helper:utils/data.ts#COUPON_CODE',
    ]);
  });

  it('marks test.fixme with a title as a fixme modifier', () => {
    expect(testByTitle('pays with saved card').modifiers).toEqual(['fixme']);
  });

  it('counts tags', () => {
    expect(index.tags).toEqual([
      { tag: '@auth', testCount: 3 },
      { tag: '@regression', testCount: 1 },
      { tag: '@smoke', testCount: 1 },
    ]);
  });
});

describe('helpers', () => {
  it('finds exactly the expected helpers (reachable via imports plus files under testDir)', () => {
    expect(index.helpers.map((h) => h.id).sort()).toEqual([
      'helper:pages/checkout.page.ts#CheckoutPage',
      'helper:pages/login.page.ts#LoginPage',
      'helper:tests/support/unused.ts#waitForIdle',
      'helper:utils/auth.ts#loginViaApi',
      'helper:utils/auth.ts#uniqueEmail',
      'helper:utils/data.ts#COUPON_CODE',
      'helper:utils/data.ts#USERS',
    ]);
  });

  it('does not treat the test object or re-exports as helpers', () => {
    const ids = index.helpers.map((h) => h.id);
    expect(ids.some((id) => id.includes('fixtures/index.ts'))).toBe(false);
    expect(ids.some((id) => id.startsWith('helper:pages/index.ts'))).toBe(false);
  });

  it('extracts function details', () => {
    const h = index.helpers.find((x) => x.id === 'helper:utils/auth.ts#uniqueEmail')!;
    expect(h.kind).toBe('function');
    expect(h.params).toBe("prefix = 'user'");
    expect(h.returns).toBe('string');
    expect(h.doc).toBe('Creates a unique test user email.');
    expect(h.usedBySpecCount).toBe(2);
    const loginViaApi = index.helpers.find((x) => x.id === 'helper:utils/auth.ts#loginViaApi')!;
    expect(loginViaApi.isAsync).toBe(true);
  });

  it('extracts page objects and their public methods only', () => {
    const login = index.helpers.find((x) => x.id === 'helper:pages/login.page.ts#LoginPage')!;
    expect(login.kind).toBe('class');
    expect(login.category).toBe('page-object');
    expect(login.doc).toBe('Login screen of the app.');
    expect(login.navigatesTo).toEqual(['/login']);
    expect(login.methods.map((m) => m.name).sort()).toEqual(['errorText', 'login']);
  });

  it('handles default-exported classes', () => {
    const c = index.helpers.find((x) => x.id === 'helper:pages/checkout.page.ts#CheckoutPage')!;
    expect(c.exportName).toBe('default');
    expect(c.category).toBe('page-object');
  });

  it('fills usage counts for helpers that are never used', () => {
    const h = index.helpers.find((x) => x.id === 'helper:tests/support/unused.ts#waitForIdle')!;
    expect(h.usedBySpecCount).toBe(0);
  });

  it('fills referencedByFiles', () => {
    const h = index.helpers.find((x) => x.id === 'helper:utils/data.ts#COUPON_CODE')!;
    expect(h.referencedByFiles).toContain('tests/checkout.spec.ts');
  });
});

describe('fixtures', () => {
  it('finds the three fixtures from .extend()', () => {
    const byName = Object.fromEntries(index.fixtures.map((f) => [f.name, f]));
    expect(Object.keys(byName).sort()).toEqual(['adminToken', 'checkoutPage', 'loginPage']);
    expect(byName['loginPage']).toMatchObject({ scope: 'test', auto: false, dependsOn: ['page'], testObject: 'test' });
    expect(byName['adminToken']).toMatchObject({ scope: 'worker', auto: true, dependsOn: [], testObject: 'test' });
  });
});

describe('diagnostics', () => {
  it('reports the broken file and keeps going', () => {
    expect(index.diagnostics.some((d) => d.code === 'PARSE_ERROR' && d.file === 'tests/broken.spec.ts')).toBe(true);
    expect(index.diagnostics.some((d) => d.code === 'DYNAMIC_TITLE')).toBe(true);
  });
});

describe('search and show', () => {
  it('find "coupon" ranks the method, then the constant', () => {
    const ids = searchIndex(index, 'coupon').map((r) => r.id);
    expect(ids[0]).toBe('helper:pages/checkout.page.ts#CheckoutPage.applyCoupon');
    expect(ids[1]).toBe('helper:utils/data.ts#COUPON_CODE');
  });

  it('find "login" has LoginPage.login in the top 3', () => {
    const top3 = searchIndex(index, 'login').slice(0, 3).map((r) => r.id);
    expect(top3).toContain('helper:pages/login.page.ts#LoginPage.login');
  });

  it('show resolves a unique label', () => {
    const entry = showEntry(index, 'LoginPage.login') as { id?: string } | null;
    expect(entry?.id).toBe('helper:pages/login.page.ts#LoginPage.login');
  });
});
