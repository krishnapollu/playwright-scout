import fs from 'node:fs/promises';
import path from 'node:path';
import { readConfig } from './config.js';
import { discoverFiles } from './discover.js';
import { parseFile, getParseErrors } from './parse.js';
import { linkFiles } from './link.js';
import { IndexSchema, type Index, type Diagnostic } from './schema.js';
import { extractFacts, type FileFacts } from './facts.js';

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
  const allFiles = [...new Set([...discover.specFiles, ...discover.supportFiles])].sort();
  const factsByFile = new Map<string, FileFacts>();
  const diagnostics: Diagnostic[] = [...config.diagnostics, ...discover.diagnostics];

  for (const rel of allFiles) {
    const abs = path.join(root, rel);
    const text = await fs.readFile(abs, 'utf8');
    const parsed = parseFile(rel, text);
    const parseErrors = getParseErrors(parsed);
    const isSpec = rel.includes('.spec.') || rel.includes('.test.');
    const facts = extractFacts(rel, text, isSpec);
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
    }
    factsByFile.set(rel, facts);
  }

  const linked = linkFiles(allFiles, factsByFile, diagnostics);

  const project: Index['project'] = {
    configFile: config.configFile,
    testDir,
    testMatch: config.testMatch,
    playwrightProjects: config.playwrightProjects,
    language: 'mixed',
    helperDirs: linked.helperDirs,
  };

  const index: Index = {
    schemaVersion: 1,
    generator: { name: 'playwright-scout-core', version: '0.1.0' },
    generatedAt: options.deterministic ? null : new Date().toISOString(),
    project,
    stats: linked.stats,
    specs: linked.specs,
    tests: linked.tests,
    helpers: linked.helpers,
    fixtures: linked.fixtures,
    tags: linked.tags,
    diagnostics,
  };

  const parsed = IndexSchema.safeParse(index);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}
