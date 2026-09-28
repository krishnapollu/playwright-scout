import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Diagnostic } from './schema.js';

const IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.git/**',
  '**/.scout/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/blob-report/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.cache/**',
];

const SOURCE_EXTS = '**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}';
const SPEC_DEFAULT = '**/*.{spec,test}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}';
const FILE_SIZE_LIMIT = 1024 * 1024; // 1 MiB

export interface DiscoverResult {
  specFiles: string[];
  supportFiles: string[];
  diagnostics: Diagnostic[];
  filesSkipped: number;
}

/** Returns true if path is TypeScript-family. */
function isTs(p: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(p);
}

/** Returns true if path is JavaScript-family. */
function isJs(p: string): boolean {
  return /\.(js|jsx|mjs|cjs)$/.test(p);
}

/** Determines project language from a list of source file paths. */
export function detectLanguage(files: string[]): 'typescript' | 'javascript' | 'mixed' {
  let hasTs = false;
  let hasJs = false;
  for (const f of files) {
    if (isTs(f)) hasTs = true;
    else if (isJs(f)) hasJs = true;
  }
  if (hasTs && hasJs) return 'mixed';
  if (hasJs) return 'javascript';
  return 'typescript';
}

/**
 * Discovers spec and support files under root according to the playwright config.
 * Returns POSIX paths relative to root, sorted by code-unit order.
 */
export async function discoverFiles(
  root: string,
  testDir: string,
  testMatch: string[] | null,
  extraIncludes: string[],
): Promise<DiscoverResult> {
  const diag: Diagnostic[] = [];
  let filesSkipped = 0;

  // Resolve spec globs relative to root
  const testDirAbs = path.resolve(root, testDir);
  const rawSpecs = await fg(
    testMatch
      ? testMatch
      : [testDir === '.' ? SPEC_DEFAULT : `${testDir.split(path.sep).join('/')}/${SPEC_DEFAULT}`],
    { cwd: root, ignore: IGNORE, absolute: false, onlyFiles: true },
  );

  // Filter oversized files
  const specFiles: string[] = [];
  for (const rel of rawSpecs.sort()) {
    const abs = path.join(root, rel);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) continue;
    if (stat.size > FILE_SIZE_LIMIT) {
      diag.push({ code: 'FILE_TOO_LARGE', severity: 'warn', message: `File exceeds 1 MiB: ${rel}`, file: rel, line: null });
      filesSkipped++;
      continue;
    }
    specFiles.push(rel.split(path.sep).join('/'));
  }

  // Support files: all source files under testDir (when testDir !== '.'), minus specs, minus .d.ts
  const supportSet = new Set<string>();

  if (testDir !== '.') {
    const allUnderTestDir = await fg(SOURCE_EXTS, {
      cwd: testDirAbs,
      ignore: IGNORE,
      absolute: false,
      onlyFiles: true,
    });
    const specBasenames = new Set(specFiles.map((f) => f.slice(testDir.length + 1)));
    for (const rel of allUnderTestDir) {
      if (rel.endsWith('.d.ts')) continue;
      if (specBasenames.has(rel)) continue;
      supportSet.add((testDir + '/' + rel).split(path.sep).join('/'));
    }
  }

  // Extra includes (globs relative to root)
  if (extraIncludes.length > 0) {
    const extras = await fg(extraIncludes, { cwd: root, ignore: IGNORE, absolute: false, onlyFiles: true });
    for (const rel of extras) {
      if (!rel.endsWith('.d.ts')) supportSet.add(rel.split(path.sep).join('/'));
    }
  }

  return {
    specFiles,
    supportFiles: [...supportSet].sort(),
    diagnostics: diag,
    filesSkipped,
  };
}
