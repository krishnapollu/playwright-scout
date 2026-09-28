import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readConfig, readTsAliasConfig } from '../src/config.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../fixtures/sample-suite');

describe('readConfig', () => {
  it('reads testDir and projects from sample-suite', () => {
    const r = readConfig(SAMPLE);
    expect(r.configFile).toBe('playwright.config.ts');
    expect(r.testDir).toBe('tests');
    expect(r.testMatch).toBeNull();
    expect(r.playwrightProjects).toEqual(['chromium', 'mobile']);
    expect(r.diagnostics).toHaveLength(0);
  });

  it('emits CONFIG_NOT_FOUND when no config exists', () => {
    const r = readConfig('/tmp/no-such-dir-scout');
    expect(r.configFile).toBeNull();
    expect(r.testDir).toBe('.');
    expect(r.diagnostics[0]?.code).toBe('CONFIG_NOT_FOUND');
  });
});

describe('readTsAliasConfig', () => {
  it('reads paths from sample-suite tsconfig', () => {
    const r = readTsAliasConfig(SAMPLE, 'tests');
    expect(r.paths).toBeDefined();
    // @pages/* and @utils/* are in the tsconfig
    expect(Object.keys(r.paths!)).toContain('@pages/*');
    expect(Object.keys(r.paths!)).toContain('@utils/*');
  });

  it('returns empty config when no tsconfig', () => {
    const r = readTsAliasConfig('/tmp/no-such-dir-scout', '.');
    expect(r.paths).toBeUndefined();
    expect(r.baseUrl).toBeUndefined();
  });
});
