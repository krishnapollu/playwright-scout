import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { cli } from '../src/bin.js';
import { installSkillCommand } from '../src/commands/installSkill.js';

test('cli is true', () => {
  expect(cli).toBe(true);
});

test('installSkillCommand copies the bundled skill into an agent path', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-skill-'));

  const output = await installSkillCommand({ root, target: 'agents', force: true });

  expect(output).toContain('installed:');
  const expectedFile = path.join(root, '.agents/skills/playwright-scout/SKILL.md');
  await expect(fs.access(expectedFile)).resolves.toBeUndefined();
  const text = await fs.readFile(expectedFile, 'utf8');
  expect(text).toContain('name: playwright-scout');
});

test('installSkillCommand skips existing files unless forced', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-skill-'));
  const dir = path.join(root, '.agents/skills/playwright-scout');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  await fs.writeFile(file, 'existing');

  const output = await installSkillCommand({ root, target: 'agents' });

  expect(output).toContain('skipped (exists):');
  const text = await fs.readFile(file, 'utf8');
  expect(text).toBe('existing');
});
