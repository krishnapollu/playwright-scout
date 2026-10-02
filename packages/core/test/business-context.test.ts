import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readBusinessContext } from '../src/business-context.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function root(): Promise<string> {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-business-'));
  roots.push(created);
  return created;
}

it('retrieves only task-relevant authored entries with source lines', async () => {
  const project = await root();
  await fs.mkdir(path.join(project, 'docs'));
  await fs.writeFile(
    path.join(project, 'docs', 'journeys.json'),
    JSON.stringify(
      {
        version: 1,
        entries: [
          {
            id: 'coupon-policy',
            kind: 'rule',
            title: 'Coupon checkout',
            summary: 'Expired coupons must be rejected.',
            keywords: ['discount'],
          },
          {
            id: 'login-risk',
            kind: 'risk',
            title: 'Login lockout',
            summary: 'Warn after repeated failures.',
          },
        ],
      },
      null,
      2,
    ),
  );
  const matches = await readBusinessContext(
    project,
    'docs',
    'add expired coupon checkout coverage',
  );
  expect(matches).toMatchObject([{ id: 'coupon-policy', source: 'docs/journeys.json', line: 5 }]);
});

it('rejects traversal, symlink escapes, invalid files, and oversized input', async () => {
  const project = await root();
  const outside = await root();
  await fs.writeFile(path.join(outside, 'business.json'), '{"version":1,"entries":[]}');
  await fs.symlink(outside, path.join(project, 'linked'));
  await expect(readBusinessContext(project, '../other.json', 'coupon')).rejects.toThrow();
  await expect(readBusinessContext(project, 'linked/business.json', 'coupon')).rejects.toThrow();
  await expect(
    readBusinessContext(project, path.join(outside, 'business.json'), 'coupon'),
  ).rejects.toThrow();
  await expect(
    readBusinessContext(project, path.join(outside, 'business.json'), 'coupon', true),
  ).resolves.toEqual([]);
  await fs.writeFile(path.join(project, 'invalid.json'), '{');
  await expect(readBusinessContext(project, 'invalid.json', 'coupon')).rejects.toThrow(
    'invalid business context JSON',
  );
  await fs.writeFile(path.join(project, 'large.json'), ' '.repeat(65537));
  await expect(readBusinessContext(project, 'large.json', 'coupon')).rejects.toThrow('64 KiB');
});
