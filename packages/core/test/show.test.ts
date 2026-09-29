import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildIndex, resolveEntry, showEntry } from '../src/index.js';
import type { Index } from '../src/index.js';

const ROOT = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));
let index: Index;

beforeAll(async () => {
  index = await buildIndex({ root: ROOT, deterministic: true });
});

describe('resolveEntry', () => {
  it('resolves a full label or unique ID suffix', () => {
    expect(showEntry(index, 'LoginPage.login')?.id).toBe('helper:pages/login.page.ts#LoginPage.login');
    expect(resolveEntry(index, 'uniqueEmail')).toMatchObject({
      status: 'ok',
      entry: { id: 'helper:utils/auth.ts#uniqueEmail' },
    });
  });

  it('reports ambiguous identifier-token matches', () => {
    const result = resolveEntry(index, 'login');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') expect(result.candidates.length).toBeGreaterThan(1);
  });

  it('distinguishes missing labels', () => {
    expect(resolveEntry(index, 'nothing-here')).toEqual({ status: 'not_found' });
  });
});
