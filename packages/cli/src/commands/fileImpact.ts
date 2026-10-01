import fs from 'node:fs/promises';
import path from 'node:path';
import { getFileImpact, ScoutError } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

const sourceExtension = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export async function fileImpactCommand(index: Index, root: string, file: string) {
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes('..') || !sourceExtension.test(file) || file.endsWith('.d.ts')) {
    throw new ScoutError('USAGE', '--file must be an existing root-relative source file');
  }
  const realRoot = await fs.realpath(root);
  const target = path.resolve(realRoot, file);
  let realTarget: string;
  try {
    realTarget = await fs.realpath(target);
    if (!(await fs.stat(realTarget)).isFile()) throw new Error('not a file');
  } catch {
    throw new ScoutError('USAGE', '--file must be an existing root-relative source file');
  }
  const relative = path.relative(realRoot, realTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ScoutError('USAGE', '--file escapes the project root');
  return getFileImpact(index, relative.split(path.sep).join('/'));
}
