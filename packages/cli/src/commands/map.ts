import fs from 'node:fs/promises';
import path from 'node:path';
import { buildIndex, writeIndex, IndexSchema } from 'playwright-scout-core';

export interface MapCommandOptions {
  json?: boolean;
  quiet?: boolean;
  noTimestamp?: boolean;
  ifStale?: boolean;
  include?: string[];
  out?: string;
  verbose?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const ignoredDirectories = new Set([
  'node_modules', 'dist', 'build', 'out', '.git', '.scout', 'playwright-report',
  'test-results', 'blob-report', 'coverage', '.next', '.turbo', '.cache',
]);
const sourceExtension = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function posix(value: string): string {
  return value.split(path.sep).join('/');
}

async function writeCustomIndex(filePath: string, root: string, index: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  const scoutDir = path.join(root, '.scout');
  await fs.mkdir(scoutDir, { recursive: true });
  const gitignore = path.join(scoutDir, '.gitignore');
  try {
    await fs.access(gitignore);
  } catch {
    await fs.writeFile(gitignore, '*\n', 'utf8');
  }
}

async function collectSourceFiles(root: string, currentDir = root, files: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await collectSourceFiles(root, path.join(currentDir, entry.name), files);
    } else if (entry.isFile() && sourceExtension.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(path.join(currentDir, entry.name));
    }
  }
  return files;
}

export async function isUpToDate(root: string, indexPath: string): Promise<boolean> {
  let indexMtime: number;
  let indexedFiles: string[];
  try {
    const text = await fs.readFile(indexPath, 'utf8');
    const parsed = IndexSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return false;
    indexedFiles = [...new Set([
      ...parsed.data.specs.map((entry) => entry.file),
      ...parsed.data.helpers.map((entry) => entry.file),
      ...parsed.data.fixtures.map((entry) => entry.file),
      ...(parsed.data.project.configFile ? [parsed.data.project.configFile] : []),
    ])];
    indexMtime = (await fs.stat(indexPath)).mtimeMs;
  } catch {
    return false;
  }
  for (const file of indexedFiles) {
    if (!(await fs.stat(path.join(root, file)).catch(() => null))) return false;
  }
  const sources = await collectSourceFiles(root);
  for (const config of ['tsconfig.json', 'jsconfig.json']) sources.push(path.join(root, config));
  for (const source of sources) {
    const stat = await fs.stat(source).catch(() => null);
    if (stat && stat.mtimeMs >= indexMtime) return false;
  }
  return true;
}

export async function mapCommand(root: string, options: MapCommandOptions = {}): Promise<CommandResult> {
  const startedAt = performance.now();
  const absoluteRoot = path.resolve(root);
  const indexPath = path.resolve(absoluteRoot, options.out ?? '.scout/index.json');
  const relativeIndexPath = posix(path.relative(absoluteRoot, indexPath));

  if (options.ifStale && await isUpToDate(absoluteRoot, indexPath)) {
    return { stdout: options.quiet ? '' : 'scout: index is up to date', stderr: '', exitCode: 0 };
  }

  const index = await buildIndex({
    root: absoluteRoot,
    include: options.include,
    deterministic: options.noTimestamp,
  });
  const noTests = index.diagnostics.find((diagnostic) => diagnostic.code === 'NO_TESTS_FOUND');
  if (noTests) {
    return { stdout: '', stderr: noTests.message, exitCode: 3 };
  }

  if (options.out) await writeCustomIndex(indexPath, absoluteRoot, index);
  else await writeIndex(absoluteRoot, index);

  const output = {
    specFiles: index.stats.specFiles,
    tests: index.stats.tests,
    helpers: index.stats.helpers,
    indexPath: relativeIndexPath,
  };

  const warnings = index.diagnostics.filter((diagnostic) => diagnostic.severity === 'warn' || diagnostic.severity === 'error');
  const stderr = options.verbose ? index.diagnostics.map((diagnostic) =>
    `${diagnostic.severity} ${diagnostic.code} ${diagnostic.file ?? '-'}:${diagnostic.line ?? '-'} ${diagnostic.message}`,
  ).join('\n') : '';
  if (options.json) return { stdout: JSON.stringify(output), stderr, exitCode: 0 };
  if (options.quiet) return { stdout: '', stderr, exitCode: 0 };

  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  const pageObjects = index.stats.pageObjects > 0 ? ` (${index.stats.pageObjects} page objects)` : '';
  const lines = [
    `scout: indexed ${index.stats.specFiles} spec files, ${index.stats.tests} tests, ${index.stats.helpers} helpers${pageObjects}, ${index.stats.fixtures} fixtures in ${elapsed}s`,
    `index: ${relativeIndexPath} (schema v${index.schemaVersion})`,
  ];
  if (index.project.helperDirs.length > 0) {
    lines.push(`helper dirs: ${index.project.helperDirs.map(({ dir, count }) => `${dir} (${count})`).join(', ')}`);
  }
  if (warnings.length > 0) lines.push(`warnings: ${warnings.length}${options.verbose ? '' : ' (use --verbose to list)'}`);
  return { stdout: lines.join('\n'), stderr, exitCode: 0 };
}
