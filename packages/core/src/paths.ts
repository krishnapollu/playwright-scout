import path from 'node:path';

/** Converts a path to POSIX format, relative to the root if needed. */
export function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}
