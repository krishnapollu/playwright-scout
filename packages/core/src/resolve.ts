import fs from 'node:fs';
import path from 'node:path';
import type { TsAliasConfig } from './config.js';
import type { FileFacts } from './facts.js';
import { normalizePath } from './paths.js';

const SOURCE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.scout',
  'playwright-report',
  'test-results',
  'blob-report',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);

export interface ExportResolution {
  file: string;
  localName: string | null;
}

function isWithinRoot(fullPath: string, root: string): boolean {
  const rel = path.relative(root, fullPath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isIgnored(fullPath: string, root: string): boolean {
  const rel = path.relative(root, fullPath);
  const segments = rel.split(path.sep);
  return segments.some((segment) => IGNORED_SEGMENTS.has(segment));
}

function resolveCandidateFile(base: string, root: string): string | null {
  const candidates = new Set<string>();

  const append = (value: string) => {
    if (!value) return;
    candidates.add(value);
  };

  const ext = path.extname(base);
  const jsExtensions: Record<string, string> = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts', '.jsx': '.tsx' };
  if (ext in jsExtensions) {
    const withoutExt = base.slice(0, -ext.length);
    append(withoutExt + jsExtensions[ext]);
    append(base);
  } else if (SOURCE_EXTS.includes(ext)) {
    append(base);
  } else {
    for (const item of SOURCE_EXTS) append(base + item);
    for (const item of SOURCE_EXTS) append(path.join(base, `index${item}`));
  }

  for (const candidate of candidates) {
    const full = path.resolve(candidate);
    if (!isWithinRoot(full, root) || isIgnored(full, root)) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return normalizePath(path.relative(root, full));
    }
  }

  return null;
}

export function resolveSpecifier(fromFile: string, specifier: string, aliasConfig: TsAliasConfig, root = process.cwd()): string | null {
  if (!specifier || specifier.startsWith('node:') || specifier.startsWith('http:') || specifier.startsWith('https:')) {
    return null;
  }

  const probe = (base: string): string | null => {
    const resolved = resolveCandidateFile(base, root);
    if (resolved) return resolved;
    return null;
  };

  if (specifier.startsWith('.')) {
    const base = path.resolve(root, path.dirname(fromFile), specifier);
    return probe(base);
  }

  const aliasPaths = aliasConfig.paths ?? {};
  for (const [pattern, targets] of Object.entries(aliasPaths)) {
    const starIndex = pattern.indexOf('*');
    if (starIndex !== -1 && pattern.indexOf('*', starIndex + 1) === -1) {
      const prefix = pattern.slice(0, starIndex);
      const suffix = pattern.slice(starIndex + 1);
      if (specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
        const middle = specifier.slice(prefix.length, specifier.length - suffix.length);
        for (const target of targets) {
          const candidate = target.replace(/\*/g, middle);
          const resolved = probe(path.resolve(aliasConfig.pathsBasePath, candidate));
          if (resolved) return resolved;
        }
      }
    } else if (pattern === specifier) {
      for (const target of targets) {
        const resolved = probe(path.resolve(aliasConfig.pathsBasePath, target));
        if (resolved) return resolved;
      }
    }
  }

  if (aliasConfig.baseUrl) {
    const resolved = probe(path.resolve(aliasConfig.baseUrl, specifier));
    if (resolved) return resolved;
  }

  return null;
}

export function resolveExportFromFacts(
  factsByFile: Map<string, FileFacts>,
  resolve: (fromFile: string, specifier: string) => string | null,
  file: string,
  exportName: string,
  seen = new Set<string>(),
): ExportResolution | null {
  const key = `${file}#${exportName}`;
  if (seen.has(key)) return null;
  seen.add(key);

  const facts = factsByFile.get(file);
  if (!facts) return null;
  for (const entry of facts.exports) {
    if (entry.exportName === exportName && entry.localName) {
      if (!entry.from) return { file, localName: entry.localName };
      const target = resolve(file, entry.from);
      if (target) return resolveExportFromFacts(factsByFile, resolve, target, entry.importedName ?? entry.localName, seen);
    }
  }

  if (exportName !== 'default') {
    for (const entry of facts.exports) {
      if (!entry.star || !entry.from) continue;
      const target = resolve(file, entry.from);
      if (!target) continue;
      const result = resolveExportFromFacts(factsByFile, resolve, target, exportName, seen);
      if (result) return result;
    }
  }

  const anonymousDefault = facts.exports.find((entry) => entry.exportName === 'default' && entry.localName === null);
  if (exportName === 'default' && anonymousDefault) return { file, localName: null };

  return null;
}
