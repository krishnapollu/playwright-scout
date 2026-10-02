import fs from 'node:fs/promises';
import path from 'node:path';
import { getFileImpact, ScoutError } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

const sourceExtension = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export async function fileImpactCommand(index: Index, root: string, file: string) {
  const source = await validateSourceFile(root, file);
  return getFileImpact(index, source.relative);
}

export async function validateSourceFile(
  root: string,
  file: string,
): Promise<{ absolute: string; relative: string }> {
  if (
    !file ||
    path.isAbsolute(file) ||
    file.split(/[\\/]/).includes('..') ||
    !sourceExtension.test(file) ||
    file.endsWith('.d.ts')
  ) {
    throw new ScoutError('USAGE', '--file must be an existing root-relative source file');
  }
  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    throw new ScoutError('USAGE', '--root must be an existing directory');
  }
  const target = path.resolve(realRoot, file);
  let realTarget: string;
  try {
    realTarget = await fs.realpath(target);
    if (!(await fs.stat(realTarget)).isFile()) throw new Error('not a file');
  } catch {
    throw new ScoutError('USAGE', '--file must be an existing root-relative source file');
  }
  const relative = path.relative(realRoot, realTarget);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new ScoutError('USAGE', '--file escapes the project root');
  return { absolute: realTarget, relative: relative.split(path.sep).join('/') };
}
