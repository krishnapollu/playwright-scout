import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type SkillTarget = 'claude' | 'agents' | 'github' | 'cursor' | 'all';

export interface InstallSkillOptions {
  root?: string;
  target?: SkillTarget;
  force?: boolean;
  global?: boolean;
}

const TARGET_DIRS: Record<Exclude<SkillTarget, 'all'>, string> = {
  claude: '.claude/skills/playwright-scout',
  agents: '.agents/skills/playwright-scout',
  github: '.github/skills/playwright-scout',
  cursor: '.cursor/skills/playwright-scout',
};

function resolveCandidateRoots() {
  const filePath = fileURLToPath(import.meta.url);
  const baseDir = path.dirname(filePath);

  return [
    baseDir,
    path.resolve(baseDir, '..'),
    path.resolve(baseDir, '../..'),
    path.resolve(baseDir, '../../..'),
    path.resolve(baseDir, '../../../..'),
    path.resolve(baseDir, '../../../../..'),
  ];
}

async function findSkillSource() {
  const roots = resolveCandidateRoots();
  const candidates = roots.flatMap((root) => [
    path.join(root, 'packages/cli/skills/playwright-scout/SKILL.md'),
    path.join(root, 'skills/playwright-scout/SKILL.md'),
    path.join(root, 'skills', 'playwright-scout', 'SKILL.md'),
    path.join(root, 'dist', 'skills', 'playwright-scout', 'SKILL.md'),
    path.join(root, 'packages/cli/dist/skills/playwright-scout/SKILL.md'),
  ]);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue searching through available bundled locations.
    }
  }

  throw new Error('Could not find the bundled skill file.');
}

export async function installSkillCommand(options: InstallSkillOptions = {}): Promise<string> {
  const target = options.target ?? 'agents';
  const force = options.force ?? false;
  const global = options.global ?? false;
  const root = path.resolve(options.root ?? process.cwd());

  if (global && target !== 'claude') {
    throw new Error('`--global` is only valid with `--target claude`.');
  }

  const targets: Exclude<SkillTarget, 'all'>[] = target === 'all' ? ['claude', 'agents', 'github', 'cursor'] : [target];
  const source = await findSkillSource();
  const lines: string[] = [];

  for (const currentTarget of targets) {
    const targetDir =
      currentTarget === 'claude' && global
        ? path.join(os.homedir(), '.claude', 'skills', 'playwright-scout')
        : path.join(root, TARGET_DIRS[currentTarget]);

    await fs.mkdir(targetDir, { recursive: true });
    const dest = path.join(targetDir, 'SKILL.md');

    try {
      await fs.access(dest);
      if (!force) {
        lines.push(`skipped (exists): ${dest}`);
        continue;
      }
    } catch {
      // File does not exist yet; proceed to copy it.
    }

    await fs.copyFile(source, dest);
    lines.push(`installed: ${dest}`);
  }

  return lines.join('\n');
}
