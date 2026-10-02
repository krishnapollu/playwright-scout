import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { doctor } from '../src/doctor.js';

const fixtureRoot = fileURLToPath(new URL('../../../fixtures/guidance-suite', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function rootWith(config?: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-doctor-'));
  temporaryRoots.push(root);
  if (config) await fs.writeFile(path.join(root, 'playwright.config.ts'), config);
  return root;
}

describe('doctor', () => {
  it('reports a literal missing testDir with source evidence', () => {
    expect(doctor(fixtureRoot)).toEqual({
      command: 'doctor',
      findings: [
        {
          ruleId: 'config.test-dir-missing',
          suggestion:
            'The configured testDir does not exist. Check whether it is generated or whether the path should be updated.',
          file: 'playwright.config.ts',
          line: 3,
          guideUrl: 'https://playwright.dev/docs/test-configuration',
        },
      ],
      unknowns: [],
    });
  });

  it('does not flag an existing testDir', async () => {
    const root = await rootWith("export default { testDir: './tests' };");
    await fs.mkdir(path.join(root, 'tests'));
    expect(doctor(root).findings).toEqual([]);
  });

  it('still checks a literal testDir when another config field is dynamic', async () => {
    const root = await rootWith(
      "export default { testDir: './missing', testMatch: process.env.MATCH };",
    );
    expect(doctor(root).findings.map((item) => item.ruleId)).toEqual(['config.test-dir-missing']);
  });

  it('marks missing and dynamic config as unknown, not defective', async () => {
    const missing = await rootWith();
    expect(doctor(missing).findings).toEqual([]);
    expect(doctor(missing).unknowns).toHaveLength(1);
    const dynamic = await rootWith('export default { testDir: process.env.TEST_DIR };');
    expect(doctor(dynamic).findings).toEqual([]);
    expect(doctor(dynamic).unknowns).toHaveLength(1);
  });

  it('does not inspect paths outside the root', async () => {
    const root = await rootWith("export default { testDir: '../other-tests' };");
    expect(doctor(root).findings).toEqual([]);
    expect(doctor(root).unknowns).toHaveLength(1);
  });
});
