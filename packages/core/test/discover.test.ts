import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { discoverFiles, detectLanguage } from '../src/discover.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

describe('discoverFiles', () => {
  it('finds spec files under testDir', async () => {
    const r = await discoverFiles(SAMPLE, 'tests', null, []);
    // 4 spec files in sample-suite/tests/
    expect(r.specFiles).toHaveLength(4);
    expect(r.specFiles.every((f) => f.startsWith('tests/'))).toBe(true);
    // Sorted in code-unit order
    expect(r.specFiles).toEqual([...r.specFiles].sort());
  });

  it('finds support files under testDir (excluding specs)', async () => {
    const r = await discoverFiles(SAMPLE, 'tests', null, []);
    // tests/support/unused.ts is a support file under testDir
    expect(r.supportFiles.some((f) => f.includes('unused.ts'))).toBe(true);
    // No spec files in supportFiles
    expect(r.supportFiles.every((f) => !f.match(/\.(spec|test)\./)));
  });

  it('includes extra globs', async () => {
    const r = await discoverFiles(SAMPLE, 'tests', null, ['utils/**/*.ts']);
    expect(r.supportFiles.some((f) => f.includes('utils/'))).toBe(true);
  });

  it('returns no diagnostics for clean suite', async () => {
    const r = await discoverFiles(SAMPLE, 'tests', null, []);
    expect(r.filesSkipped).toBe(0);
  });
});

describe('detectLanguage', () => {
  it('returns mixed for ts+js files', () => {
    expect(detectLanguage(['a.ts', 'b.js'])).toBe('mixed');
  });

  it('returns typescript for all ts files', () => {
    expect(detectLanguage(['a.ts', 'b.tsx', 'c.mts'])).toBe('typescript');
  });

  it('returns javascript for all js files', () => {
    expect(detectLanguage(['a.js', 'b.mjs'])).toBe('javascript');
  });
});
