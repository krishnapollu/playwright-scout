import fs from 'node:fs/promises';
import path from 'node:path';
import { buildIndex, discoverFiles, readConfig, writeIndex, IndexSchema } from 'playwright-scout-core';

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

async function isUpToDate(root: string, indexPath: string, include: string[]): Promise<boolean> {
  let indexMtime: number;
  try {
    const text = await fs.readFile(indexPath, 'utf8');
    const parsed = IndexSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return false;
    indexMtime = (await fs.stat(indexPath)).mtimeMs;
  } catch {
    return false;
  }
  const config = readConfig(root);
  const discovery = await discoverFiles(root, config.testDir, config.testMatch, include);
  const sources = [...discovery.specFiles, ...discovery.supportFiles];
  if (config.configFile) sources.push(config.configFile);
  for (const source of sources) {
    const stat = await fs.stat(path.join(root, source)).catch(() => null);
    if (stat && stat.mtimeMs >= indexMtime) return false;
  }
  return true;
}

export async function mapCommand(root: string, options: MapCommandOptions = {}): Promise<CommandResult> {
  const startedAt = performance.now();
  const absoluteRoot = path.resolve(root);
  const indexPath = path.resolve(absoluteRoot, options.out ?? '.scout/index.json');
  const relativeIndexPath = posix(path.relative(absoluteRoot, indexPath));

  if (options.ifStale && await isUpToDate(absoluteRoot, indexPath, options.include ?? [])) {
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
