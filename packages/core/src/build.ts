import fs from 'node:fs/promises';
import path from 'node:path';
import { readConfig, readTsAliasConfig } from './config.js';
import { detectLanguage, discoverFiles } from './discover.js';
import { parseFile, getParseErrors } from './parse.js';
import { linkFiles } from './link.js';
import { IndexSchema, type Index, type Diagnostic } from './schema.js';
import { extractFacts, type FileFacts } from './facts.js';
import { resolveSpecifier } from './resolve.js';

export interface BuildIndexOptions {
  root: string;
  include?: string[];
  deterministic?: boolean;
}

export async function buildIndex(options: BuildIndexOptions): Promise<Index> {
  const root = options.root ?? process.cwd();
  const config = readConfig(root);
  const testDir = config.testDir || '.';
  const discover = await discoverFiles(root, testDir, config.testMatch, options.include ?? []);
  const specFiles = new Set(discover.specFiles);
  const factsByFile = new Map<string, FileFacts>();
  const diagnostics: Diagnostic[] = [...config.diagnostics, ...discover.diagnostics];
  const aliasConfig = readTsAliasConfig(root, testDir);
  const selectedFiles = new Set([...discover.specFiles, ...discover.supportFiles]);
  const queue = [...discover.specFiles];
  let queueIndex = 0;
  let unresolvedCount = 0;

  while (queueIndex < queue.length) {
    const rel = queue[queueIndex++];
    if (!rel || factsByFile.has(rel)) continue;
    const abs = path.join(root, rel);
    const text = await fs.readFile(abs, 'utf8');
    const parsed = parseFile(rel, text);
    const parseErrors = getParseErrors(parsed);
    const facts = extractFacts(rel, parsed, specFiles.has(rel));
    if (parseErrors.length > 0) {
      const first = parseErrors[0];
      if (first) {
        const line = first.start ? parsed.getLineAndCharacterOfPosition(first.start).line + 1 : null;
        diagnostics.push({
          code: 'PARSE_ERROR',
          severity: 'warn',
          message: first.messageText ? String(first.messageText) : 'Parse error',
          file: rel,
          line,
        });
      }
      facts.testTree = [];
      facts.helperDetails = [];
      facts.fixtureDefs = [];
      facts.references = new Set<string>();
    } else {
      for (const test of facts.testTree) {
        if (!test.titleDynamic) continue;
        diagnostics.push({
          code: 'DYNAMIC_TITLE',
          severity: 'info',
          message: `Test title is dynamic: ${test.titleSource ?? test.title ?? ''}`.trim(),
          file: rel,
          line: test.line,
        });
      }
    }
    factsByFile.set(rel, facts);

    for (const specifier of [...facts.imports.map((item) => item.specifier), ...facts.exports.flatMap((item) => item.from ? [item.from] : [])]) {
      const target = resolveSpecifier(rel, specifier, aliasConfig, root);
      if (target) {
        selectedFiles.add(target);
        if (!factsByFile.has(target)) queue.push(target);
      } else if (specifier.startsWith('.') && unresolvedCount < 50) {
        diagnostics.push({
          code: 'UNRESOLVED_IMPORT',
          severity: 'info',
          message: `Unable to resolve import: ${specifier}`,
          file: rel,
          line: null,
        });
        unresolvedCount++;
      }
    }
  }

  const allFiles = [...selectedFiles].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (const rel of allFiles) {
    if (factsByFile.has(rel)) continue;
    const text = await fs.readFile(path.join(root, rel), 'utf8');
    const parsed = parseFile(rel, text);
    const parseErrors = getParseErrors(parsed);
    const facts = extractFacts(rel, parsed, false);
    if (parseErrors.length > 0) {
      const first = parseErrors[0];
      if (first) {
        const line = first.start ? parsed.getLineAndCharacterOfPosition(first.start).line + 1 : null;
        diagnostics.push({ code: 'PARSE_ERROR', severity: 'warn', message: first.messageText ? String(first.messageText) : 'Parse error', file: rel, line });
      }
      facts.helperDetails = [];
      facts.fixtureDefs = [];
      facts.references = new Set<string>();
    }
    factsByFile.set(rel, facts);
  }

  const linked = linkFiles(allFiles, factsByFile, diagnostics, {
    root,
    aliasConfig,
    specFiles,
  });
  if (linked.specs.length === 0 || linked.tests.length === 0) {
    diagnostics.push({
      code: 'NO_TESTS_FOUND',
      severity: 'error',
      message: linked.specs.length === 0 ? 'No spec files found' : 'No tests found',
      file: null,
      line: null,
    });
  }

  const project: Index['project'] = {
    configFile: config.configFile,
    testDir,
    testMatch: config.testMatch,
    playwrightProjects: config.playwrightProjects,
    language: detectLanguage(allFiles),
    helperDirs: linked.helperDirs,
  };

  const index: Index = {
    schemaVersion: 1,
    generator: { name: 'playwright-scout-core', version: '0.1.0' },
    generatedAt: options.deterministic ? null : new Date().toISOString(),
    project,
    stats: { ...linked.stats, filesSkipped: discover.filesSkipped },
    specs: linked.specs,
    tests: linked.tests,
    helpers: linked.helpers,
    fixtures: linked.fixtures,
    tags: linked.tags,
    diagnostics: diagnostics.sort((a, b) => {
      const severityRank = { error: 0, warn: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity]
        || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
        || ((a.file ?? '') < (b.file ?? '') ? -1 : (a.file ?? '') > (b.file ?? '') ? 1 : 0)
        || (a.line ?? 0) - (b.line ?? 0)
        || (a.message < b.message ? -1 : a.message > b.message ? 1 : 0);
    }),
  };

  const parsed = IndexSchema.safeParse(index);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}
