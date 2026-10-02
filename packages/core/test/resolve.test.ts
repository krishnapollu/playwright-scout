import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTsAliasConfig } from '../src/config.js';
import { extractFacts } from '../src/facts.js';
import { parseFile } from '../src/parse.js';
import { resolveExportFromFacts, resolveSpecifier } from '../src/resolve.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');
let temporaryRoot: string | null = null;

afterEach(() => {
  if (temporaryRoot) fs.rmSync(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = null;
});

function sampleFacts(files: string[]) {
  return new Map(
    files.map((file) => {
      const text = fs.readFileSync(path.join(SAMPLE, file), 'utf8');
      return [file, extractFacts(file, parseFile(file, text), false)];
    }),
  );
}

describe('resolveSpecifier', () => {
  it('resolves explicit roots, JavaScript extensions, aliases, and directory indexes', () => {
    const aliases = readTsAliasConfig(SAMPLE, 'tests');
    expect(resolveSpecifier('tests/checkout.spec.ts', '../utils/auth.js', aliases, SAMPLE)).toBe(
      'utils/auth.ts',
    );
    expect(resolveSpecifier('tests/checkout.spec.ts', '@utils/auth', aliases, SAMPLE)).toBe(
      'utils/auth.ts',
    );
    expect(resolveSpecifier('tests/checkout.spec.ts', '@pages/index', aliases, SAMPLE)).toBe(
      'pages/index.ts',
    );
    expect(resolveSpecifier('tests/checkout.spec.ts', '../pages', aliases, SAMPLE)).toBe(
      'pages/index.ts',
    );
    expect(
      resolveSpecifier('tests/checkout.spec.ts', '@playwright/test', aliases, SAMPLE),
    ).toBeNull();
  });
});

describe('resolveExportFromFacts', () => {
  it('resolves star and default re-export chains to original declarations', () => {
    const facts = sampleFacts(['pages/index.ts', 'pages/login.page.ts', 'pages/checkout.page.ts']);
    const aliases = { baseUrl: undefined, paths: undefined, pathsBasePath: SAMPLE };
    const resolve = (from: string, specifier: string) =>
      resolveSpecifier(from, specifier, aliases, SAMPLE);
    expect(resolveExportFromFacts(facts, resolve, 'pages/index.ts', 'LoginPage')).toEqual({
      file: 'pages/login.page.ts',
      localName: 'LoginPage',
    });
    expect(resolveExportFromFacts(facts, resolve, 'pages/index.ts', 'CheckoutPage')).toEqual({
      file: 'pages/checkout.page.ts',
      localName: 'CheckoutPage',
    });
  });

  it('terminates on cyclic star re-exports', () => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-scout-resolve-'));
    fs.writeFileSync(path.join(temporaryRoot, 'a.ts'), "export * from './b';\n");
    fs.writeFileSync(path.join(temporaryRoot, 'b.ts'), "export * from './a';\n");
    const facts = new Map(
      ['a.ts', 'b.ts'].map((file) => {
        const text = fs.readFileSync(path.join(temporaryRoot!, file), 'utf8');
        return [file, extractFacts(file, parseFile(file, text), false)];
      }),
    );
    const aliases = { baseUrl: undefined, paths: undefined, pathsBasePath: temporaryRoot };
    const resolve = (from: string, specifier: string) =>
      resolveSpecifier(from, specifier, aliases, temporaryRoot!);
    expect(resolveExportFromFacts(facts, resolve, 'a.ts', 'Missing')).toBeNull();
  });
});
