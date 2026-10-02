import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildIndex } from '../src/build.js';
import { getFileImpact } from '../src/file-impact.js';
import type { Index } from '../src/schema.js';

const ROOT = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));
let index: Index;
beforeAll(async () => {
  index = await buildIndex({ root: ROOT, deterministic: true });
});

describe('file impact', () => {
  it('reports fixture-mediated and helper-call reasons without inventing other tests', () => {
    const page = getFileImpact(index, 'pages/login.page.ts');
    expect(
      page.knownAffectedTests.some(
        (test) => test.file === 'tests/login.spec.ts' && test.reasons.includes('helper_call'),
      ),
    ).toBe(true);
    expect(page.knownAffectedTests.every((test) => test.file === 'tests/login.spec.ts')).toBe(true);
    const fixture = getFileImpact(index, 'fixtures/index.ts');
    expect(
      fixture.knownAffectedTests.some((test) => test.reasons.includes('fixture_provider')),
    ).toBe(true);
  });

  it('reports tests in a directly changed spec', () => {
    const impact = getFileImpact(index, 'tests/login.spec.ts');
    expect(impact.knownAffectedTests).toHaveLength(4);
    expect(impact.knownAffectedTests.every((test) => test.reasons.includes('direct_spec'))).toBe(
      true,
    );
  });

  it('labels an empty result as incomplete analysis', () => {
    const impact = getFileImpact(index, 'tests/support/unused.ts');
    expect(impact.knownAffectedTests).toEqual([]);
    expect(impact.analysisLimits.join(' ')).toContain('safe to skip');
  });
});
