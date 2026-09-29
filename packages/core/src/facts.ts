import ts from 'typescript';
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
  referencedNames: string[];
  namespaceMembers: Array<{ ns: string; member: string }>;
  newExpressions: string[];
  instanceVariables: Array<{ variable: string; className: string }>;
  instanceMethodCalls: Array<{ variable: string; method: string }>;
  gotos?: string[];
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
  namespaceMembers: Array<{ ns: string; member: string }>;
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

function collectClassMethods(node: ts.ClassDeclaration, fileName: string, ownerName: string): MethodEntry[] {
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
        id: `${createHelperId(fileName, ownerName)}.${name}`,
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

function collectReferences(node: ts.Node, names: Set<string>, namespaceMembers: Array<{ ns: string; member: string }> = []): void {
  function visit(current: ts.Node): void {
    if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
      namespaceMembers.push({ ns: current.expression.text, member: current.name.text });
    }
    if (ts.isIdentifier(current)) {
      const text = current.text;
      if (!text) return;
      const parent = current.parent;
      if (
        (ts.isVariableDeclaration(parent) && parent.name === current)
        || (ts.isFunctionDeclaration(parent) && parent.name === current)
        || (ts.isClassDeclaration(parent) && parent.name === current)
        || (ts.isParameter(parent) && parent.name === current)
        || (ts.isImportClause(parent) && parent.name === current)
        || (ts.isImportSpecifier(parent) && parent.name === current)
        || (ts.isNamespaceImport(parent) && parent.name === current)
        || (ts.isPropertyAccessExpression(parent) && parent.name === current)
        || (ts.isPropertyDeclaration(parent) && parent.name === current)
        || (ts.isMethodDeclaration(parent) && parent.name === current)
      ) return;
      names.add(text);
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
}

function collectTestReferences(node: ts.Node): { names: string[]; namespaceMembers: Array<{ ns: string; member: string }>; newExpressions: string[]; instanceVariables: Array<{ variable: string; className: string }>; instanceMethodCalls: Array<{ variable: string; method: string }> } {
  const names = new Set<string>();
  const namespaceMembers: Array<{ ns: string; member: string }> = [];
  const newExpressions = new Set<string>();
  const instanceVariables: Array<{ variable: string; className: string }> = [];
  const instanceMethodCalls: Array<{ variable: string; method: string }> = [];
  const instances = new Map<string, string>();

  function visit(current: ts.Node): void {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && current.initializer && ts.isNewExpression(current.initializer) && ts.isIdentifier(current.initializer.expression)) {
      const className = current.initializer.expression.text;
      instances.set(current.name.text, className);
      instanceVariables.push({ variable: current.name.text, className });
      newExpressions.add(className);
    } else if (ts.isNewExpression(current) && ts.isIdentifier(current.expression)) {
      newExpressions.add(current.expression.text);
    }
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && ts.isIdentifier(current.expression.expression)) {
      const variable = current.expression.expression.text;
      if (instances.has(variable)) instanceMethodCalls.push({ variable, method: current.expression.name.text });
    }
    if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
      namespaceMembers.push({ ns: current.expression.text, member: current.name.text });
    }
    if (ts.isIdentifier(current)) {
      const parent = current.parent;
      if (
        (ts.isVariableDeclaration(parent) && parent.name === current)
        || (ts.isFunctionDeclaration(parent) && parent.name === current)
        || (ts.isClassDeclaration(parent) && parent.name === current)
        || (ts.isParameter(parent) && parent.name === current)
        || (ts.isPropertyAccessExpression(parent) && parent.name === current)
        || (ts.isPropertyDeclaration(parent) && parent.name === current)
        || (ts.isMethodDeclaration(parent) && parent.name === current)
      ) return;
      names.add(current.text);
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return {
    names: [...names].sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
    namespaceMembers: namespaceMembers.sort((a, b) => a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : a.member < b.member ? -1 : a.member > b.member ? 1 : 0),
    newExpressions: [...newExpressions].sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
    instanceVariables,
    instanceMethodCalls,
  };
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

function getDefaultExportName(node: ts.ClassDeclaration): string {
  const modifiers = ts.getModifiers(node) ?? [];
  return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : node.name?.getText() ?? '';
}

function extractFixtureDependsOn(node: ts.Expression | undefined): string[] {
  if (!node || (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node))) return [];
  const deps = new Set<string>();
  const firstParam = node.parameters[0];
  if (firstParam && ts.isObjectBindingPattern(firstParam.name)) {
    for (const element of firstParam.name.elements) {
      if (ts.isBindingElement(element)) {
        const name = ts.isIdentifier(element.name) ? element.name.text : null;
        if (name && name !== 'use') deps.add(name);
      }
    }
  }
  return [...deps];
}

export function extractFacts(relPath: string, sourceFile: ts.SourceFile, isSpec: boolean): FileFacts {
  const imports: ImportFact[] = [];
  const localDecls: Record<string, LocalDecl> = {};
  const exports: ExportFact[] = [];
  const helperDetails: HelperDetail[] = [];
  const fixtureDefs: FixtureDef[] = [];
  const references = new Set<string>();
  const testObjectExports = new Set<string>();
  const testTree: TestTreeRecord[] = [];
  const declaredNames = new Set<string>();
  const namespaceMembers: Array<{ ns: string; member: string }> = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const specifier = stmt.moduleSpecifier.text;
      const clause = stmt.importClause;
      if (clause) {
        if (clause.name) {
          imports.push({ specifier, kind: 'default', imported: 'default', local: clause.name.text, typeOnly: clause.isTypeOnly, line: stmt.getStart() + 1 });
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
      const isDefault = ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      exports.push({ exportName: isDefault ? 'default' : stmt.name.text, localName: stmt.name.text, from: null, importedName: null, star: false });
    }
    if (ts.isClassDeclaration(stmt) && isExported(stmt) && stmt.name) {
      const isDefault = ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      exports.push({ exportName: isDefault ? 'default' : stmt.name.text, localName: stmt.name.text, from: null, importedName: null, star: false });
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
              const dependsOn = cfg.dependsOn.length > 0 ? cfg.dependsOn : extractFixtureDependsOn(prop.initializer);
              fixtureDefs.push({
                id: `fixture:${toPosix(relPath)}#${key}`,
                name: key,
                file: toPosix(relPath),
                line: prop.getStart() + 1,
                scope: cfg.scope,
                auto: cfg.auto,
                option: cfg.option,
                dependsOn,
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
      const exportName = !!ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : stmt.name.text;
      const detail: HelperDetail = {
        id: createHelperId(toPosix(relPath), stmt.name.text),
        name: stmt.name.text,
        exportName,
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
        exportName: getDefaultExportName(stmt),
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
        methods: collectClassMethods(stmt, toPosix(relPath), stmt.name.text),
        navigatesTo: collectGotoStrings(stmt),
      };
      helperDetails.push(detail);
    }
    if (ts.isVariableStatement(stmt) && stmt.declarationList.declarations.length > 0) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const isExportedVar = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        const isDefault = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if (decl.initializer && !hasTestObjectInitializer(decl.initializer)) {
          const isFunctionLike = ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer);
          const detail: HelperDetail = {
            id: createHelperId(toPosix(relPath), name),
            name,
            exportName: isDefault ? 'default' : name,
            kind: isFunctionLike ? 'function' : 'constant',
            file: toPosix(relPath),
            line: stmt.getStart() + 1,
            endLine: stmt.getEnd() + 1,
            isAsync: !!(decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) && decl.initializer.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)),
            params: isFunctionLike ? getFunctionParams(decl.initializer) : null,
            returns: isFunctionLike ? getReturnType(decl.initializer) : null,
            valuePreview: isFunctionLike ? null : getValuePreview(decl.initializer),
            extends: null,
            category: 'helper',
            doc: getJsDoc(stmt),
            methods: [],
            navigatesTo: collectGotoStrings(stmt),
          };
          if (isExportedVar || isDefault || name === 'USERS' || name === 'COUPON_CODE' || isFunctionLike) helperDetails.push(detail);
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
      function getAccessChain(expression: ts.Expression): { base: string | null; parts: string[] } {
        const parts: string[] = [];
        let current: ts.Expression = expression;

        while (ts.isPropertyAccessExpression(current)) {
          parts.unshift(current.name.text);
          current = current.expression;
        }
        if (ts.isIdentifier(current)) {
          parts.unshift(current.text);
          return { base: current.text, parts };
        }
        return { base: null, parts };
      }

      function parseTitle(text: ts.Expression | undefined): { title: string | null; titleDynamic: boolean; titleSource: string | null } {
        if (!text) {
          return { title: null, titleDynamic: true, titleSource: null };
        }
        if (ts.isStringLiteralLike(text) || ts.isNoSubstitutionTemplateLiteral(text)) {
          return { title: text.text, titleDynamic: false, titleSource: null };
        }
        if (ts.isTemplateExpression(text)) {
          let title = text.head.text;
          for (const span of text.templateSpans) {
            title += '{…}' + span.literal.text;
          }
          return { title, titleDynamic: true, titleSource: null };
        }
        return { title: null, titleDynamic: true, titleSource: truncateText(text.getText(sourceFile), 80) };
      }

      function tagValueToStrings(value: ts.Expression): string[] {
        if (ts.isStringLiteral(value)) {
          return [value.text.startsWith('@') ? value.text : `@${value.text}`];
        }
        if (ts.isArrayLiteralExpression(value)) {
          const values: string[] = [];
          for (const item of value.elements) {
            if (ts.isStringLiteral(item)) {
              const text = item.text.startsWith('@') ? item.text : `@${item.text}`;
              values.push(text);
            }
          }
          return values;
        }
        return [];
      }

      function collectTagsFromDetails(details: ts.Expression | undefined): string[] {
        if (!details || !ts.isObjectLiteralExpression(details)) return [];
        const nextTags: string[] = [];
        for (const prop of details.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : null;
          if (key !== 'tag') continue;
          nextTags.push(...tagValueToStrings(prop.initializer));
        }
        return nextTags;
      }

      function collectTitleTags(title: string | null, titleText: string | undefined): string[] {
        if (!titleText) return [];
        const tags = [...titleText.matchAll(/(?:^|\s)(@[-\w:]+)/g)]
          .map((match) => match[1])
          .filter((tag): tag is string => tag !== undefined);
        if (title && title.startsWith('@')) {
          tags.push(title);
        }
        return tags.filter((tag) => tag.startsWith('@'));
      }

      function uniqueSorted(values: Iterable<string>): string[] {
        return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      }

      function visitTestCalls(node: ts.Node, suitePath: string[], tags: string[], inLoop: boolean): void {
        if (ts.isCallExpression(node)) {
          const expr = node.expression;
          const { base: baseName, parts } = getAccessChain(expr);
          const chain = parts.join('.');
          const last = parts.at(-1) ?? null;
          const isDescribeLike = !!baseName && (baseName === 'test' || testBindings.has(baseName)) && ((parts.length === 2 && parts[1] === 'describe') || (parts.length >= 3 && parts[1] === 'describe' && parts[2] !== undefined && ['only', 'skip', 'fixme', 'serial', 'parallel'].includes(parts[2])) || (parts.length === 1 && parts[0] === 'describe'));
          const isTestLike = !!baseName && (baseName === 'test' || testBindings.has(baseName)) && (chain === 'test' || (parts.length >= 2 && parts[0] === 'test' && ['only', 'skip', 'fixme', 'fail', 'slow'].includes(last ?? '')) || (parts.length >= 2 && baseName !== 'test' && testBindings.has(baseName) && ['only', 'skip', 'fixme', 'fail', 'slow'].includes(last ?? '')));

          if (isDescribeLike) {
            const titleArg = node.arguments[0];
            const { title, titleDynamic, titleSource } = parseTitle(titleArg);
            const nextSuite = title ? [...suitePath, title] : suitePath;
            const nextTags = uniqueSorted([...tags, ...collectTagsFromDetails(node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1]) ? node.arguments[1] : undefined)]);
            const callback = [...node.arguments].reverse().find((arg): arg is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
            const nextInLoop = inLoop;

            if (title) {
              const extracted = collectTitleTags(title, title);
              nextTags.push(...extracted);
            }

            const callbackBody = callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) ? callback.body : undefined;
            if (callbackBody) {
              visitTestCalls(callbackBody, nextSuite, uniqueSorted(nextTags), nextInLoop);
            }
            return;
          }

          if (isTestLike) {
            const titleArg = node.arguments[0];
            const { title, titleDynamic, titleSource } = parseTitle(titleArg);
            const secondArg = node.arguments[1];
            const detailsTags = collectTagsFromDetails(secondArg && ts.isObjectLiteralExpression(secondArg) ? secondArg : undefined);
            const titleTags = titleArg ? collectTitleTags(title, titleArg.getText(sourceFile)) : [];
            const mergedTags = uniqueSorted([...tags, ...detailsTags, ...titleTags]);

            const callback = [...node.arguments].reverse().find((arg): arg is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
            const fixtureNames: string[] = [];
            if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
              const param = callback.parameters[0];
              if (param && ts.isObjectBindingPattern(param.name)) {
                for (const element of param.name.elements) {
                  const name = ts.isIdentifier(element.name) ? element.name.text : null;
                  if (name) fixtureNames.push(name);
                }
              }
            }

            const testKind = chain === 'test' ? 'test' : chain.split('.').at(-1) ?? 'test';
            const shouldRecord =
              (testKind === 'test' || testKind === 'only' || testKind === 'skip' || testKind === 'fixme' || testKind === 'fail' || testKind === 'slow') &&
              (!titleArg || ts.isStringLiteralLike(titleArg) || ts.isNoSubstitutionTemplateLiteral(titleArg) || ts.isTemplateExpression(titleArg));

            if (!shouldRecord) {
              return;
            }

            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            const baseId = `test:${toPosix(relPath)}::${suitePath.length > 0 ? `${suitePath.join(' > ')} > ` : ''}${title ?? `L${line + 1}`}`;
            const seen = testTree.filter((entry) => entry.id === baseId || entry.id.startsWith(`${baseId}#`)).length;
            const callbackGotos = callback ? collectGotoStrings(callback.body) : [];
            const callbackFacts = callback ? collectTestReferences(callback.body) : {
              names: [], namespaceMembers: [], newExpressions: [], instanceVariables: [], instanceMethodCalls: [],
            };
            const testRecord: TestTreeRecord = {
              id: seen === 0 ? baseId : `${baseId}#${seen + 1}`,
              file: toPosix(relPath),
              line: line + 1,
              column: character + 1,
              endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
              title,
              titleDynamic: !!titleArg && !ts.isStringLiteralLike(titleArg) && !ts.isNoSubstitutionTemplateLiteral(titleArg),
              titleSource: title ? null : titleSource,
              suitePath,
              modifiers: [],
              tags: uniqueSorted(mergedTags),
              fixtures: [...new Set(fixtureNames)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
              calls: [],
              navigatesTo: callbackGotos,
              inLoop,
              referencedNames: callbackFacts.names,
              namespaceMembers: callbackFacts.namespaceMembers,
              newExpressions: callbackFacts.newExpressions,
              instanceVariables: callbackFacts.instanceVariables,
              instanceMethodCalls: callbackFacts.instanceMethodCalls,
              gotos: callbackGotos,
            };

            const modifiers = new Set<TestTreeRecord['modifiers'][number]>();
            if (testKind === 'skip') modifiers.add('skip');
            if (testKind === 'fixme') modifiers.add('fixme');
            if (testKind === 'only') modifiers.add('only');
            if (testKind === 'fail') modifiers.add('fail');
            if (testKind === 'slow') modifiers.add('slow');
            testRecord.modifiers = [...modifiers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            testTree.push(testRecord);
            return;
          }
        }

        if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
          ts.forEachChild(node, (child) => visitTestCalls(child, suitePath, tags, true));
          return;
        }

        if (ts.isCallExpression(node)) {
          const expr = node.expression;
          if (ts.isPropertyAccessExpression(expr) && (expr.name.text === 'forEach' || expr.name.text === 'map' || expr.name.text === 'flatMap')) {
            const callback = node.arguments.at(-1);
            if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
              visitTestCalls(callback.body, suitePath, tags, true);
            }
            return;
          }
        }

        ts.forEachChild(node, (child) => visitTestCalls(child, suitePath, tags, inLoop));
      }
      visitTestCalls(sourceFile, [], [], false);
    }
  }

  collectReferences(sourceFile, references, namespaceMembers);

  return {
    imports,
    localDecls,
    exports,
    helperDetails,
    fixtureDefs,
    testObjectExports,
    testTree,
    references,
    namespaceMembers,
    cjs: /module\.exports|require\s*\(/.test(sourceFile.text),
  };
}
