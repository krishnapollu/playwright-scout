import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { TsAliasConfig } from './config.js';
import { normalizePath } from './paths.js';
import { parseFile } from './parse.js';

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

function rootPath(): string {
  return process.cwd();
}

function isWithinRoot(fullPath: string): boolean {
  const root = rootPath();
  const rel = path.relative(root, fullPath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isIgnored(fullPath: string): boolean {
  const root = rootPath();
  const rel = path.relative(root, fullPath);
  const segments = rel.split(path.sep);
  return segments.some((segment) => IGNORED_SEGMENTS.has(segment));
}

function resolveCandidateFile(base: string): string | null {
  const root = rootPath();
  const candidates = new Set<string>();

  const append = (value: string) => {
    if (!value) return;
    candidates.add(value);
  };

  append(base);

  const ext = path.extname(base);
  if (['.js', '.mjs', '.cjs', '.jsx'].includes(ext)) {
    const withoutExt = base.slice(0, -ext.length);
    for (const item of SOURCE_EXTS) append(withoutExt + item);
  } else if (SOURCE_EXTS.includes(ext)) {
    // Keep the existing file explicitly.
  } else {
    for (const item of SOURCE_EXTS) append(base + item);
    for (const item of SOURCE_EXTS) append(path.join(base, `index${item}`));
  }

  for (const candidate of candidates) {
    const full = path.resolve(candidate);
    if (!isWithinRoot(full) || isIgnored(full)) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return normalizePath(path.relative(root, full));
    }
  }

  return null;
}

export function resolveSpecifier(fromFile: string, specifier: string, aliasConfig: TsAliasConfig): string | null {
  if (!specifier || specifier.startsWith('node:') || specifier.startsWith('http:') || specifier.startsWith('https:')) {
    return null;
  }

  const root = rootPath();
  const probe = (base: string): string | null => {
    const resolved = resolveCandidateFile(base);
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

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return !!modifiers?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

export function resolveExport(file: string, exportName: string, seen = new Set<string>()): ExportResolution | null {
  const key = `${file}#${exportName}`;
  if (seen.has(key)) return null;
  seen.add(key);

  const root = rootPath();
  const fullPath = path.resolve(root, file);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;

  const sourceFile = parseFile(file, fs.readFileSync(fullPath, 'utf8'));

  for (const stmt of sourceFile.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const element of stmt.exportClause.elements) {
          const exportedName = element.name.text;
          const importedName = element.propertyName ? element.propertyName.text : element.name.text;
          if (exportedName === exportName) {
            if (stmt.moduleSpecifier && ts.isStringLiteralLike(stmt.moduleSpecifier)) {
              const target = resolveSpecifier(file, stmt.moduleSpecifier.text, {
                baseUrl: undefined,
                paths: undefined,
                pathsBasePath: root,
              });
              if (target) return resolveExport(target, importedName, seen);
              return null;
            }
            return { file, localName: importedName };
          }
        }
      }

      if (!stmt.exportClause && stmt.moduleSpecifier && ts.isStringLiteralLike(stmt.moduleSpecifier)) {
        if (exportName === 'default') continue;
        const target = resolveSpecifier(file, stmt.moduleSpecifier.text, {
          baseUrl: undefined,
          paths: undefined,
          pathsBasePath: root,
        });
        if (target) {
          const resolved = resolveExport(target, exportName, seen);
          if (resolved) return resolved;
        }
      }
    }

    if (ts.isExportAssignment(stmt)) {
      if (exportName !== 'default') continue;
      if (ts.isIdentifier(stmt.expression)) return { file, localName: stmt.expression.text };
      return { file, localName: null };
    }

    if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const name = ts.isIdentifier(decl.name) ? decl.name.text : null;
        if (name === exportName) return { file, localName: name };
      }
    }

    if (ts.isFunctionDeclaration(stmt) && hasExportModifier(stmt) && stmt.name && stmt.name.text === exportName) {
      return { file, localName: stmt.name.text };
    }

    if (ts.isClassDeclaration(stmt) && hasExportModifier(stmt) && stmt.name && stmt.name.text === exportName) {
      return { file, localName: stmt.name.text };
    }

    if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && hasExportModifier(stmt) && exportName === 'default') {
      return { file, localName: stmt.name?.text ?? null };
    }
  }

  return null;
}
