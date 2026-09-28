import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import type { Diagnostic } from './schema.js';

const CONFIG_NAMES = [
  'playwright.config.ts',
  'playwright.config.mts',
  'playwright.config.cts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
];

export interface ConfigResult {
  configFile: string | null;
  testDir: string;
  testMatch: string[] | null;
  playwrightProjects: string[];
  diagnostics: Diagnostic[];
}

export interface TsAliasConfig {
  baseUrl: string | undefined;
  paths: Record<string, string[]> | undefined;
  pathsBasePath: string;
}

/** Finds the first existing playwright config file in root (checked in spec order). */
export function findConfigFile(root: string): string | null {
  for (const name of CONFIG_NAMES) {
    const full = path.join(root, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** Reads string literal value from a TS node, or null. */
function strLiteral(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/** Walks the export default's object literal to extract config fields statically. */
function extractObjectLiteral(
  obj: ts.ObjectLiteralExpression,
  diag: Diagnostic[],
  relPath: string,
  sf: ts.SourceFile,
): { testDir?: string; testMatch?: string[] | null; projects?: string[] } {
  const result: { testDir?: string; testMatch?: string[] | null; projects?: string[] } = {};

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isIdentifier(prop.name) ? prop.name.text : strLiteral(prop.name);
    if (!key) continue;

    if (key === 'testDir') {
      const v = strLiteral(prop.initializer);
      if (v !== null) {
        result.testDir = v;
      } else {
        const line = sf.getLineAndCharacterOfPosition(prop.initializer.getStart(sf)).line + 1;
        diag.push({ code: 'CONFIG_DYNAMIC', severity: 'info', message: 'testDir is dynamic', file: relPath, line });
      }
    } else if (key === 'testMatch') {
      if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        result.testMatch = [prop.initializer.text];
      } else if (ts.isArrayLiteralExpression(prop.initializer)) {
        const strs: string[] = [];
        let allLit = true;
        for (const el of prop.initializer.elements) {
          const s = strLiteral(el);
          if (s !== null) strs.push(s);
          else allLit = false;
        }
        result.testMatch = allLit ? strs : null;
        if (!allLit) {
          const line = sf.getLineAndCharacterOfPosition(prop.initializer.getStart(sf)).line + 1;
          diag.push({ code: 'CONFIG_DYNAMIC', severity: 'info', message: 'testMatch contains non-literal', file: relPath, line });
        }
      } else {
        const line = sf.getLineAndCharacterOfPosition(prop.initializer.getStart(sf)).line + 1;
        diag.push({ code: 'CONFIG_DYNAMIC', severity: 'info', message: 'testMatch is dynamic', file: relPath, line });
        result.testMatch = null;
      }
    } else if (key === 'projects') {
      if (ts.isArrayLiteralExpression(prop.initializer)) {
        const names: string[] = [];
        for (const el of prop.initializer.elements) {
          if (!ts.isObjectLiteralExpression(el)) continue;
          for (const p2 of el.properties) {
            if (!ts.isPropertyAssignment(p2)) continue;
            const k2 = ts.isIdentifier(p2.name) ? p2.name.text : null;
            if (k2 === 'name') {
              const s = strLiteral(p2.initializer);
              if (s !== null) names.push(s);
            }
          }
        }
        result.projects = names;
      }
    }
  }

  return result;
}

/** Finds the config object literal from the source file (handles defineConfig wrapper and identifier). */
function findConfigObj(
  sf: ts.SourceFile,
): ts.ObjectLiteralExpression | null {
  for (const stmt of sf.statements) {
    // export default ...
    if (!ts.isExportAssignment(stmt) || stmt.isExportEquals) continue;
    const expr = stmt.expression;
    // export default { ... }
    if (ts.isObjectLiteralExpression(expr)) return expr;
    // export default defineConfig({ ... })
    if (ts.isCallExpression(expr) && expr.arguments.length >= 1) {
      const arg = expr.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) return arg;
    }
    // export default identifier → find const
    if (ts.isIdentifier(expr)) {
      const name = expr.text;
      for (const s2 of sf.statements) {
        if (ts.isVariableStatement(s2)) {
          for (const decl of s2.declarationList.declarations) {
            if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
              const init = decl.initializer;
              if (ts.isObjectLiteralExpression(init)) return init;
              if (ts.isCallExpression(init) && init.arguments.length >= 1) {
                const arg = init.arguments[0];
                if (arg && ts.isObjectLiteralExpression(arg)) return arg;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Reads a playwright config file statically and returns project info.
 * Never executes the config.
 */
export function readConfig(root: string): ConfigResult {
  const diag: Diagnostic[] = [];
  const configFull = findConfigFile(root);

  if (!configFull) {
    diag.push({ code: 'CONFIG_NOT_FOUND', severity: 'info', message: 'No playwright config found', file: null, line: null });
    return { configFile: null, testDir: '.', testMatch: null, playwrightProjects: [], diagnostics: diag };
  }

  const relPath = path.relative(root, configFull).split(path.sep).join('/');
  const text = fs.readFileSync(configFull, 'utf8');
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);

  const obj = findConfigObj(sf);
  if (!obj) {
    return { configFile: relPath, testDir: '.', testMatch: null, playwrightProjects: [], diagnostics: diag };
  }

  const extracted = extractObjectLiteral(obj, diag, relPath, sf);

  let testDir = '.';
  if (extracted.testDir !== undefined) {
    // normalise: strip leading ./, make relative posix
    testDir = extracted.testDir.replace(/^\.\//, '') || '.';
  }

  return {
    configFile: relPath,
    testDir,
    testMatch: extracted.testMatch ?? null,
    playwrightProjects: extracted.projects ?? [],
    diagnostics: diag,
  };
}

/** Reads tsconfig paths from the nearest tsconfig.json (root then testDir). */
export function readTsAliasConfig(root: string, testDir: string): TsAliasConfig {
  const candidates = [
    path.join(root, 'tsconfig.json'),
    path.join(root, testDir, 'tsconfig.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const host: ts.ParseConfigFileHost = {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    };
    const parsed = ts.getParsedCommandLineOfConfigFile(file, {}, host);
    if (!parsed) continue;
    const opts = parsed.options;
    return {
      baseUrl: opts.baseUrl,
      paths: opts.paths as Record<string, string[]> | undefined,
      pathsBasePath: path.dirname(file),
    };
  }
  return { baseUrl: undefined, paths: undefined, pathsBasePath: root };
}

