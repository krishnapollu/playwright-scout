import ts from 'typescript';
import { getParseErrors, parseFile } from './parse.js';
import type { GuidanceFinding } from './doctor.js';

export interface ReviewResult {
  command: 'review';
  findings: GuidanceFinding[];
  unknowns: string[];
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function importedNames(sf: ts.SourceFile): { tests: Set<string>; expects: Set<string> } {
  const tests = new Set<string>();
  const expects = new Set<string>();
  for (const stmt of sf.statements) {
    if (
      !ts.isImportDeclaration(stmt) ||
      !ts.isStringLiteral(stmt.moduleSpecifier) ||
      stmt.moduleSpecifier.text !== '@playwright/test'
    )
      continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements) {
      const imported = item.propertyName?.text ?? item.name.text;
      if (imported === 'test') tests.add(item.name.text);
      if (imported === 'expect') expects.add(item.name.text);
    }
  }
  return { tests, expects };
}

function inlineLocator(node: ts.Expression, pages: Set<string>): boolean {
  const expr = unwrap(node);
  if (!ts.isCallExpression(expr) || !ts.isPropertyAccessExpression(expr.expression)) return false;
  const prop = expr.expression;
  const base = unwrap(prop.expression);
  if (ts.isIdentifier(base) && pages.has(base.text)) {
    return prop.name.text === 'locator' || /^getBy[A-Z]/.test(prop.name.text);
  }
  if (['filter', 'first', 'last', 'nth', 'locator'].includes(prop.name.text))
    return inlineLocator(base, pages);
  if (/^getBy[A-Z]/.test(prop.name.text)) return inlineLocator(base, pages);
  return false;
}

function isManualVisibilityAssertion(
  node: ts.CallExpression,
  expects: Set<string>,
  pages: Set<string>,
): boolean {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'toBe')
    return false;
  if (node.arguments.length !== 1 || node.arguments[0]?.kind !== ts.SyntaxKind.TrueKeyword)
    return false;
  const outer = unwrap(node.expression.expression);
  if (
    !ts.isCallExpression(outer) ||
    !ts.isIdentifier(outer.expression) ||
    !expects.has(outer.expression.text)
  )
    return false;
  const first = outer.arguments[0];
  if (outer.arguments.length !== 1 || !first) return false;
  const awaited = unwrap(first);
  if (!ts.isAwaitExpression(awaited)) return false;
  const checked = unwrap(awaited.expression);
  return (
    ts.isCallExpression(checked) &&
    checked.arguments.length === 0 &&
    ts.isPropertyAccessExpression(checked.expression) &&
    checked.expression.name.text === 'isVisible' &&
    inlineLocator(checked.expression.expression, pages)
  );
}

export function reviewSource(file: string, source: string): ReviewResult {
  const sf = parseFile(file, source);
  if (getParseErrors(sf).length > 0)
    return {
      command: 'review',
      findings: [],
      unknowns: ['Source has parse errors; no review findings were produced.'],
    };
  const imports = importedNames(sf);
  const findings: GuidanceFinding[] = [];
  const add = (ruleId: string, suggestion: string, node: ts.Node, guideUrl: string) => {
    findings.push({
      ruleId,
      suggestion,
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      guideUrl,
    });
  };
  const visitTestBody = (node: ts.Node, pages: Set<string>): void => {
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'waitForTimeout' &&
        ts.isIdentifier(node.expression.expression) &&
        pages.has(node.expression.expression.text)
      ) {
        add(
          'test.fixed-wait',
          'Consider waiting for an observable condition instead of a fixed delay; this wait may be intentional.',
          node,
          'https://playwright.dev/docs/best-practices',
        );
      }
      if (isManualVisibilityAssertion(node, imports.expects, pages)) {
        add(
          'test.manual-visibility-assertion',
          'Consider a web-first toBeVisible assertion so Playwright can retry the condition.',
          node,
          'https://playwright.dev/docs/best-practices',
        );
      }
    }
    ts.forEachChild(node, (child) => visitTestBody(child, pages));
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      imports.tests.has(node.expression.text)
    ) {
      const callback = node.arguments[1];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const first = callback.parameters[0]?.name;
        if (first && ts.isObjectBindingPattern(first)) {
          const pages = new Set<string>();
          for (const element of first.elements) {
            if (!ts.isIdentifier(element.name)) continue;
            const property = element.propertyName;
            if (
              (!property && element.name.text === 'page') ||
              (property && ts.isIdentifier(property) && property.text === 'page')
            )
              pages.add(element.name.text);
          }
          if (pages.size > 0) visitTestBody(callback.body, pages);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  findings.sort((a, b) =>
    a.file < b.file
      ? -1
      : a.file > b.file
        ? 1
        : a.line - b.line || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  );
  const unique = findings.filter(
    (item, index) =>
      index === 0 ||
      item.file !== findings[index - 1]?.file ||
      item.line !== findings[index - 1]?.line ||
      item.ruleId !== findings[index - 1]?.ruleId,
  );
  return { command: 'review', findings: unique, unknowns: [] };
}
