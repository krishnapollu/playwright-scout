import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { discoverFiles, detectLanguage } from '../src/discover.js';
import { extractFacts } from '../src/facts.js';
import { parseFile } from '../src/parse.js';
import { normalizePath } from '../src/paths.js';
import { resolveExportFromFacts, resolveSpecifier } from '../src/resolve.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

describe('normalizePath', () => {
  it('converts Windows separators to POSIX separators on any host', () => {
    expect(normalizePath(path.win32.join('pages', 'login.page.ts'))).toBe('pages/login.page.ts');
  });
});

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

describe('resolveSpecifier and resolveExportFromFacts', () => {
  const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

  it('resolves relative and alias imports', () => {
    expect(
      resolveSpecifier(
        'fixtures/sample-suite/pages/index.ts',
        './login.page',
        {
          baseUrl: undefined,
          paths: undefined,
          pathsBasePath: SAMPLE,
        },
        path.resolve(SAMPLE, '..', '..'),
      ),
    ).toBe('fixtures/sample-suite/pages/login.page.ts');

    expect(
      resolveSpecifier(
        'fixtures/sample-suite/tests/login.spec.ts',
        '@utils/auth',
        {
          baseUrl: undefined,
          paths: { '@utils/*': ['utils/*'] },
          pathsBasePath: SAMPLE,
        },
        path.resolve(SAMPLE, '..', '..'),
      ),
    ).toBe('fixtures/sample-suite/utils/auth.ts');
  });

  it('resolves exports through barrel files', () => {
    const root = path.resolve(SAMPLE, '..', '..');
    const fileNames = ['pages/index.ts', 'pages/login.page.ts', 'pages/checkout.page.ts'];
    const factsByFile = new Map(
      fileNames.map((file) => {
        const text = fs.readFileSync(path.join(SAMPLE, file), 'utf8');
        return [`fixtures/sample-suite/${file}`, extractFacts(file, parseFile(file, text), false)];
      }),
    );
    const resolve = (from: string, specifier: string) =>
      resolveSpecifier(
        from,
        specifier,
        {
          baseUrl: undefined,
          paths: undefined,
          pathsBasePath: SAMPLE,
        },
        root,
      );

    expect(
      resolveExportFromFacts(
        factsByFile,
        resolve,
        'fixtures/sample-suite/pages/index.ts',
        'LoginPage',
      ),
    ).toMatchObject({
      file: 'fixtures/sample-suite/pages/login.page.ts',
      localName: 'LoginPage',
    });

    expect(
      resolveExportFromFacts(
        factsByFile,
        resolve,
        'fixtures/sample-suite/pages/index.ts',
        'CheckoutPage',
      ),
    ).toMatchObject({
      file: 'fixtures/sample-suite/pages/checkout.page.ts',
      localName: 'CheckoutPage',
    });
  });
});
