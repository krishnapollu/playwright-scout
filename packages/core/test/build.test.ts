import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../src/build.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function createProject(): Promise<{ root: string; testsDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-build-'));
  roots.push(root);
  const testsDir = path.join(root, 'tests');
  await fs.mkdir(testsDir, { recursive: true });
  await fs.writeFile(
    path.join(root, 'playwright.config.ts'),
    "export default { testDir: 'tests' };\n",
  );
  return { root, testsDir };
}

const tinySpec = (title: string) =>
  `import { test } from '@playwright/test';\ntest('${title}', () => {});\n`;

describe('buildIndex', () => {
  it('builds deterministic output and reports NO_TESTS_FOUND for empty/comment-only projects', async () => {
    const { root, testsDir } = await createProject();
    await fs.writeFile(path.join(testsDir, 'empty.ts'), '');
    await fs.writeFile(
      path.join(testsDir, 'comments.spec.ts'),
      '// only a comment\n/* still no tests */\n',
    );
    const first = await buildIndex({ root, deterministic: true });
    const again = await buildIndex({ root, deterministic: true });

    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    expect(first.specs).toHaveLength(1);
    expect(first.stats.tests).toBe(0);
    expect(first.diagnostics.some((item) => item.code === 'NO_TESTS_FOUND')).toBe(true);
  });

  it('preserves CRLF line numbers and skips files larger than 1 MiB', async () => {
    const { root, testsDir } = await createProject();
    await fs.writeFile(
      path.join(testsDir, 'crlf.spec.ts'),
      "import { test } from '@playwright/test';\r\ntest('line two', () => {});\r\n",
    );
    await fs.writeFile(path.join(testsDir, 'huge.spec.ts'), Buffer.alloc(1024 * 1024 + 1, 0x20));
    const index = await buildIndex({ root, deterministic: true });

    expect(index.tests.find((test) => test.title === 'line two')?.line).toBe(2);
    expect(index.stats.filesSkipped).toBe(1);
    expect(
      index.diagnostics.some(
        (item) => item.code === 'FILE_TOO_LARGE' && item.file === 'tests/huge.spec.ts',
      ),
    ).toBe(true);
  });

  it('does not crash on a non-UTF8 spec file', async () => {
    const { root, testsDir } = await createProject();
    await fs.writeFile(path.join(testsDir, 'invalid.spec.ts'), Buffer.from([0xff, 0xfe, 0x00]));
    await expect(buildIndex({ root, deterministic: true })).resolves.toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'PARSE_ERROR', file: 'tests/invalid.spec.ts' }),
      ]),
    });
  });

  it('builds 1,000 tiny spec files within the CI budget', async () => {
    const { root, testsDir } = await createProject();
    await Promise.all(
      Array.from({ length: 1000 }, (_, index) =>
        fs.writeFile(
          path.join(testsDir, `tiny-${String(index).padStart(4, '0')}.spec.ts`),
          tinySpec(`test ${index}`),
        ),
      ),
    );
    const startedAt = performance.now();
    const index = await buildIndex({ root, deterministic: true });
    const elapsed = performance.now() - startedAt;

    expect(index.stats.specFiles).toBe(1000);
    expect(index.stats.tests).toBe(1000);
    expect(elapsed).toBeLessThan(15000);
  });
});
