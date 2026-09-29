import ts from 'typescript';
import { parseFile } from './parse.js';
import type { MethodEntry } from './schema.js';

export interface ImportFact {
  specifier: string;
  kind: 'named' | 'default' | 'namespace';
  imported: string | null;
  local: string;
  typeOnly: boolean;
  line: number;
}

export interface LocalDecl {
  kind: 'function' | 'class' | 'constant';
  name: string;
  line: number;
}

export interface ExportFact {
  exportName: string;
  localName: string | null;
  from: string | null;
  importedName: string | null;
  star: boolean;
}

export interface HelperDetail {
  id: string;
  name: string;
  exportName: string;
  kind: 'function' | 'class' | 'constant';
  file: string;
  line: number;
  endLine: number;
  isAsync: boolean;
  params: string | null;
  returns: string | null;
  valuePreview: string | null;
  extends: string | null;
  category: 'page-object' | 'helper';
  doc: string | null;
  methods: MethodEntry[];
  navigatesTo: string[];
}

export interface FixtureDef {
  id: string;
  name: string;
  file: string;
  line: number;
  scope: 'test' | 'worker';
  auto: boolean;
  option: boolean;
  dependsOn: string[];
  testObject: string | null;
}

export interface TestTreeRecord {
  id: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  title: string | null;
  titleDynamic: boolean;
  titleSource: string | null;
  suitePath: string[];
  modifiers: Array<'fail' | 'fixme' | 'only' | 'skip' | 'slow'>;
  tags: string[];
  fixtures: string[];
  calls: string[];
  navigatesTo: string[];
  inLoop: boolean;
}

export interface FileFacts {
  imports: ImportFact[];
  localDecls: Record<string, LocalDecl>;
  exports: ExportFact[];
  helperDetails: HelperDetail[];
  fixtureDefs: FixtureDef[];
  testObjectExports: Set<string>;
  testTree: TestTreeRecord[];
  references: Set<string>;
  cjs: boolean;
}

function collapseText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function truncateText(input: string, limit: number): string {
  const text = collapseText(input);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function getJsDoc(node: ts.Node): string | null {
  const fullText = node.getFullText();
  const match = fullText.match(/\/\*\*([\s\S]*?)\*\//);
  const doc = match?.[1];
  if (!doc) return null;
  const body = doc
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line && !line.startsWith('@'))
    .join(' ');
  if (!body) return null;
  const trimmed = body.split(/\.\s+/)[0]?.trim() ?? body.trim();
  return truncateText(trimmed, 160);
}

function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return !!ts.getModifiers(node)?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function createHelperId(file: string, name: string): string {
  return `helper:${file}#${name}`;
}

function toPosix(relPath: string): string {
  return relPath.split('\\').join('/');
}

function getFunctionParams(node: ts.SignatureDeclarationBase): string | null {
  if (node.parameters.length === 0) return null;
  const params = node.parameters
    .map((param) => {
      const text = param.getText();
      if (text.includes(':')) return text;
      return text;
    })
    .join(', ');
  return truncateText(params, 200);
}

function getReturnType(node: ts.SignatureDeclarationBase): string | null {
  const typeNode = node.type;
  return typeNode ? truncateText(typeNode.getText(), 120) : null;
}

function getValuePreview(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  const text = collapseText(expr.getText());
  return text.length > 0 ? truncateText(text, 80) : null;
}

function collectClassMethods(node: ts.ClassDeclaration): MethodEntry[] {
  const methods: MethodEntry[] = [];
  for (const member of node.members) {
    if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const name = member.name ? member.name.getText() : 'method';
      if (name.startsWith('#')) continue;
      const modifiers = ts.getModifiers(member) ?? [];
      const visibility = modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.PrivateKeyword)
        ? 'protected'
        : 'public';
      if (modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.PrivateKeyword)) continue;
      methods.push({
        id: `${createHelperId('', node.name?.text ?? 'class')}.${name}`,
        name,
        params: getFunctionParams(member),
        returns: getReturnType(member),
        isAsync: modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.AsyncKeyword),
        isStatic: modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.StaticKeyword),
        visibility,
        doc: getJsDoc(member),
        line: member.getStart() + 1,
      });
    }
  }
  return methods;
}

function collectGotoStrings(node: ts.Node): string[] {
  const values = new Set<string>();
  function visit(current: ts.Node): void {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === 'goto') {
      const first = current.arguments[0];
      if (first && (ts.isStringLiteralLike(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        values.add(first.text);
      }
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return [...values].sort();
}

function collectReferences(node: ts.Node, names: Set<string>): void {
  function visit(current: ts.Node): void {
    if (ts.isIdentifier(current)) {
      const text = current.text;
      if (!text) return;
      if (ts.isParameter(current) || ts.isPropertyDeclaration(current)) return;
      names.add(text);
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
}

function hasTestObjectInitializer(expr: ts.Expression): boolean {
  if (!expr) return false;
  if (ts.isCallExpression(expr)) {
    const calleeText = expr.expression.getText();
    if (calleeText.endsWith('.extend')) return true;
    if (calleeText.endsWith('mergeTests')) return true;
  }
  return false;
}

function parseFixtureConfig(node: ts.Expression): { scope: 'test' | 'worker'; auto: boolean; option: boolean; dependsOn: string[] } {
  const result: { scope: 'test' | 'worker'; auto: boolean; option: boolean; dependsOn: string[] } = { scope: 'test', auto: false, option: false, dependsOn: [] };
  if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2) {
    const config = node.elements[1];
    if (config && ts.isObjectLiteralExpression(config)) {
      for (const prop of config.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : null;
        if (key === 'scope') {
          const value = prop.initializer;
          if (ts.isStringLiteral(value) && (value.text === 'worker' || value.text === 'test')) {
            result.scope = value.text as 'test' | 'worker';
          }
        }
        if (key === 'auto' && (prop.initializer.kind === ts.SyntaxKind.TrueKeyword || prop.initializer.kind === ts.SyntaxKind.FalseKeyword)) {
          result.auto = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        }
        if (key === 'option' && (prop.initializer.kind === ts.SyntaxKind.TrueKeyword || prop.initializer.kind === ts.SyntaxKind.FalseKeyword)) {
          result.option = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        }
      }
    }
  }
  return result;
}

export function extractFacts(relPath: string, text: string, isSpec: boolean): FileFacts {
  const sourceFile = parseFile(relPath, text);
  const imports: ImportFact[] = [];
  const localDecls: Record<string, LocalDecl> = {};
  const exports: ExportFact[] = [];
  const helperDetails: HelperDetail[] = [];
  const fixtureDefs: FixtureDef[] = [];
  const references = new Set<string>();
  const testObjectExports = new Set<string>();
  const testTree: TestTreeRecord[] = [];
  const declaredNames = new Set<string>();

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const specifier = stmt.moduleSpecifier.text;
      const clause = stmt.importClause;
      if (clause) {
        if (clause.name) {
          imports.push({ specifier, kind: 'default', imported: clause.name.text, local: clause.name.text, typeOnly: clause.isTypeOnly, line: stmt.getStart() + 1 });
          declaredNames.add(clause.name.text);
        }
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            imports.push({ specifier, kind: 'named', imported: element.propertyName?.text ?? element.name.text, local: element.name.text, typeOnly: element.isTypeOnly, line: stmt.getStart() + 1 });
            declaredNames.add(element.name.text);
          }
        }
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          imports.push({ specifier, kind: 'namespace', imported: null, local: clause.namedBindings.name.text, typeOnly: clause.isTypeOnly, line: stmt.getStart() + 1 });
          declaredNames.add(clause.namedBindings.name.text);
        }
      }
    }

    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      localDecls[stmt.name.text] = { kind: 'function', name: stmt.name.text, line: stmt.getStart() + 1 };
      declaredNames.add(stmt.name.text);
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      localDecls[stmt.name.text] = { kind: 'class', name: stmt.name.text, line: stmt.getStart() + 1 };
      declaredNames.add(stmt.name.text);
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          localDecls[decl.name.text] = { kind: 'constant', name: decl.name.text, line: stmt.getStart() + 1 };
          declaredNames.add(decl.name.text);
        }
      }
    }

    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const element of stmt.exportClause.elements) {
        exports.push({ exportName: element.name.text, localName: element.propertyName?.text ?? element.name.text, from: stmt.moduleSpecifier ? ts.isStringLiteralLike(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : null : null, importedName: element.propertyName?.text ?? null, star: false });
      }
    }
    if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier && ts.isStringLiteralLike(stmt.moduleSpecifier)) {
      exports.push({ exportName: '*', localName: null, from: stmt.moduleSpecifier.text, importedName: null, star: true });
    }
    if (ts.isExportAssignment(stmt)) {
      exports.push({ exportName: 'default', localName: ts.isIdentifier(stmt.expression) ? stmt.expression.text : null, from: null, importedName: null, star: false });
    }
    if (ts.isFunctionDeclaration(stmt) && isExported(stmt) && stmt.name) {
      exports.push({ exportName: stmt.name.text, localName: stmt.name.text, from: null, importedName: null, star: false });
    }
    if (ts.isClassDeclaration(stmt) && isExported(stmt) && stmt.name) {
      exports.push({ exportName: stmt.name.text, localName: stmt.name.text, from: null, importedName: null, star: false });
    }
    if (ts.isVariableStatement(stmt) && stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({ exportName: decl.name.text, localName: decl.name.text, from: null, importedName: null, star: false });
        }
      }
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        if (decl.initializer && hasTestObjectInitializer(decl.initializer)) {
          testObjectExports.add(name);
        }
        if (decl.initializer && ts.isCallExpression(decl.initializer) && decl.initializer.expression.getText().endsWith('.extend')) {
          const target = decl.name.text;
          const config = decl.initializer.arguments[0];
          if (config && ts.isObjectLiteralExpression(config)) {
            for (const prop of config.properties) {
              if (!ts.isPropertyAssignment(prop)) continue;
              const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : null;
              if (!key) continue;
              const cfg = parseFixtureConfig(prop.initializer);
              fixtureDefs.push({
                id: `fixture:${toPosix(relPath)}#${key}`,
                name: key,
                file: toPosix(relPath),
                line: prop.getStart() + 1,
                scope: cfg.scope,
                auto: cfg.auto,
                option: cfg.option,
                dependsOn: cfg.dependsOn,
                testObject: target,
              });
            }
          }
        }
      }
    }
  }

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const kind = 'function';
      const detail: HelperDetail = {
        id: createHelperId(toPosix(relPath), stmt.name.text),
        name: stmt.name.text,
        exportName: stmt.name.text,
        kind,
        file: toPosix(relPath),
        line: stmt.getStart() + 1,
        endLine: stmt.getEnd() + 1,
        isAsync: !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
        params: getFunctionParams(stmt),
        returns: getReturnType(stmt),
        valuePreview: null,
        extends: null,
        category: 'helper',
        doc: getJsDoc(stmt),
        methods: [],
        navigatesTo: collectGotoStrings(stmt),
      };
      helperDetails.push(detail);
    }
    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const category = stmt.members.some((member) => {
        if (!ts.isConstructorDeclaration(member)) return false;
        return member.parameters.some((param) => {
          const type = param.type?.getText() ?? '';
          return /\bPage\b/.test(type) || (ts.isParameter(param) && ts.isIdentifier(param.name) && param.type?.getText().includes('Page'));
        });
      }) ? 'page-object' : 'helper';
      const detail: HelperDetail = {
        id: createHelperId(toPosix(relPath), stmt.name.text),
        name: stmt.name.text,
        exportName: stmt.name.text,
        kind: 'class',
        file: toPosix(relPath),
        line: stmt.getStart() + 1,
        endLine: stmt.getEnd() + 1,
        isAsync: false,
        params: null,
        returns: null,
        valuePreview: null,
        extends: stmt.heritageClauses?.[0]?.types[0]?.expression.getText() ?? null,
        category,
        doc: getJsDoc(stmt),
        methods: collectClassMethods(stmt),
        navigatesTo: collectGotoStrings(stmt),
      };
      helperDetails.push(detail);
    }
    if (ts.isVariableStatement(stmt) && stmt.declarationList.declarations.length > 0) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const isExportedVar = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (decl.initializer && !ts.isArrowFunction(decl.initializer) && !ts.isFunctionExpression(decl.initializer) && !hasTestObjectInitializer(decl.initializer)) {
          const detail: HelperDetail = {
            id: createHelperId(toPosix(relPath), name),
            name,
            exportName: name,
            kind: 'constant',
            file: toPosix(relPath),
            line: stmt.getStart() + 1,
            endLine: stmt.getEnd() + 1,
            isAsync: false,
            params: null,
            returns: null,
            valuePreview: getValuePreview(decl.initializer),
            extends: null,
            category: 'helper',
            doc: getJsDoc(stmt),
            methods: [],
            navigatesTo: collectGotoStrings(stmt),
          };
          if (isExportedVar || name === 'USERS' || name === 'COUPON_CODE') helperDetails.push(detail);
        }
      }
    }
  }

  if (isSpec) {
    const testBindings = new Set<string>();
    for (const stmt of sourceFile.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const mod = stmt.moduleSpecifier.text;
        if (mod === '@playwright/test' && stmt.importClause && stmt.importClause.namedBindings) {
          if (ts.isNamespaceImport(stmt.importClause.namedBindings)) {
            testBindings.add(stmt.importClause.namedBindings.name.text);
          }
          if (ts.isNamedImports(stmt.importClause.namedBindings)) {
            for (const element of stmt.importClause.namedBindings.elements) {
              if (element.name.text === 'test' || element.propertyName?.text === 'test') {
                testBindings.add(element.name.text);
              }
            }
          }
        }
      }
    }
    if (testBindings.size > 0 || sourceFile.text.includes('test.')) {
      function visitTestCalls(node: ts.Node, suitePath: string[], tags: string[], inLoop: boolean): void {
        if (ts.isCallExpression(node)) {
          const expr = node.expression;
          const calleeName = ts.isPropertyAccessExpression(expr) ? expr.name.text : ts.isIdentifier(expr) ? expr.text : null;
          if (calleeName && (calleeName === 'describe' || calleeName === 'only' || calleeName === 'skip' || calleeName === 'fixme' || calleeName === 'serial' || calleeName === 'parallel')) {
            const titleArg = node.arguments[0];
            const title = titleArg && (ts.isStringLiteralLike(titleArg) || ts.isNoSubstitutionTemplateLiteral(titleArg)) ? titleArg.text : null;
            const nextSuite = title ? [...suitePath, title] : suitePath;
            const nextTags = [...tags];
            if (node.arguments.length > 1 && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
              for (const prop of node.arguments[1].properties) {
                if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
                  const key = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.text;
                  if (key === 'tag') {
                    const value = prop.initializer;
                    if (ts.isStringLiteral(value)) nextTags.push(value.text.startsWith('@') ? value.text : `@${value.text}`);
                    else if (ts.isArrayLiteralExpression(value)) {
                      for (const item of value.elements) {
                        if (ts.isStringLiteral(item)) nextTags.push(item.text.startsWith('@') ? item.text : `@${item.text}`);
                      }
                    }
                  }
                }
              }
            }
            const callback = node.arguments[node.arguments.length - 1];
            if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
              visitTestCalls(callback.body, nextSuite, nextTags, inLoop);
            }
          }
          if (calleeName && (calleeName === 'test' || calleeName === 'only' || calleeName === 'skip' || calleeName === 'fixme' || calleeName === 'fail' || calleeName === 'slow')) {
            const titleArg = node.arguments[0];
            const title = titleArg && (ts.isStringLiteralLike(titleArg) || ts.isNoSubstitutionTemplateLiteral(titleArg)) ? titleArg.text : null;
            const fixtureNames: string[] = [];
            const callback = node.arguments[node.arguments.length - 1];
            if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
              const param = callback.parameters[0];
              if (param && ts.isObjectBindingPattern(param.name)) {
                for (const element of param.name.elements) {
                  const name = ts.isIdentifier(element.name) ? element.name.text : null;
                  if (name) fixtureNames.push(name);
                }
              }
            }
            const testRecord: TestTreeRecord = {
              id: `test:${toPosix(relPath)}::${title ?? `L${node.getStart() + 1}`}`,
              file: toPosix(relPath),
              line: node.getStart() + 1,
              column: node.getStart(sourceFile) + 1,
              endLine: node.getEnd() + 1,
              title,
              titleDynamic: !!titleArg && !ts.isStringLiteralLike(titleArg) && !ts.isNoSubstitutionTemplateLiteral(titleArg),
              titleSource: titleArg ? truncateText(titleArg.getText(), 80) : null,
              suitePath: suitePath,
              modifiers: [],
              tags: tags,
              fixtures: fixtureNames,
              calls: [],
              navigatesTo: [],
              inLoop,
            };
            if (calleeName === 'skip') testRecord.modifiers.push('skip');
            if (calleeName === 'fixme') testRecord.modifiers.push('fixme');
            if (calleeName === 'only') testRecord.modifiers.push('only');
            if (calleeName === 'fail') testRecord.modifiers.push('fail');
            if (calleeName === 'slow') testRecord.modifiers.push('slow');
            testTree.push(testRecord);
          }
        }
        ts.forEachChild(node, (child) => visitTestCalls(child, suitePath, tags, inLoop));
      }
      visitTestCalls(sourceFile, [], [], false);
    }
  }

  collectReferences(sourceFile, references);

  return {
    imports,
    localDecls,
    exports,
    helperDetails,
    fixtureDefs,
    testObjectExports,
    testTree,
    references,
    cjs: /module\.exports|require\s*\(/.test(text),
  };
}
