import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeIndex, readIndex } from '../src/io.js';
import { ScoutError } from '../src/errors.js';
import type { Index } from '../src/schema.js';

describe('io', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('valid minimal index round-trips byte-identically', async () => {
    const minimalIndex: Index = {
      schemaVersion: 1,
      generator: { name: 'playwright-scout-core', version: '1.0.0' },
      generatedAt: '2023-01-01T00:00:00.000Z',
      project: {
        configFile: null,
        testDir: '.',
        testMatch: null,
        playwrightProjects: [],
        language: 'typescript',
        helperDirs: [],
      },
      stats: {
        specFiles: 0,
        tests: 0,
        helpers: 0,
        methods: 0,
        pageObjects: 0,
        fixtures: 0,
        tags: 0,
        filesParsed: 0,
        filesSkipped: 0,
      },
      specs: [],
      tests: [],
      helpers: [],
      fixtures: [],
      tags: [],
      diagnostics: [],
    };

    await writeIndex(tmpDir, minimalIndex);
    
    // Check .scout/.gitignore
    const gitignore = await fs.readFile(path.join(tmpDir, '.scout', '.gitignore'), 'utf8');
    expect(gitignore).toBe('*\n');
    
    // Check byte-identical
    const expectedJson = JSON.stringify(minimalIndex, null, 2) + '\n';
    const actualJson = await fs.readFile(path.join(tmpDir, '.scout', 'index.json'), 'utf8');
    expect(actualJson).toBe(expectedJson);

    // Read it back
    const readBack = await readIndex(tmpDir);
    expect(readBack).toEqual(minimalIndex);
  });

  it('invalid JSON throws INDEX_INVALID', async () => {
    await fs.mkdir(path.join(tmpDir, '.scout'));
    await fs.writeFile(path.join(tmpDir, '.scout', 'index.json'), '{invalid json}');
    
    await expect(readIndex(tmpDir)).rejects.toThrowError(
      new ScoutError('INDEX_INVALID')
    );
  });

  it('schemaVersion: 2 throws INDEX_SCHEMA_MISMATCH', async () => {
    await fs.mkdir(path.join(tmpDir, '.scout'));
    await fs.writeFile(path.join(tmpDir, '.scout', 'index.json'), JSON.stringify({ schemaVersion: 2 }));
    
    await expect(readIndex(tmpDir)).rejects.toThrowError(
      new ScoutError('INDEX_SCHEMA_MISMATCH')
    );
  });
  
  it('missing index throws INDEX_MISSING', async () => {
    await expect(readIndex(tmpDir)).rejects.toThrowError(
      new ScoutError('INDEX_MISSING')
    );
  });
});
