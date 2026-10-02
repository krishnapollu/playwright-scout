import type { Index } from 'playwright-scout-core';

interface FindResult {
  id: string;
  kind: string;
  label: string;
  file: string;
  line: number;
  usedBySpecCount: number;
  summary: string | null;
  tags?: string[];
}

function truncate(line: string, limit = 200): string {
  return line.length <= limit ? line : `${line.slice(0, limit - 1)}…`;
}

export function formatFindResults(query: string, results: FindResult[]): string {
  if (results.length === 0) return `scout: no matches for "${query}"`;
  return results
    .map((result) => {
      const details = [`${result.kind.padEnd(8)} ${result.label}`, `${result.file}:${result.line}`];
      if (
        result.usedBySpecCount > 0 &&
        (result.kind === 'function' ||
          result.kind === 'class' ||
          result.kind === 'constant' ||
          result.kind === 'method')
      ) {
        details.push(`used in ${result.usedBySpecCount} specs`);
      }
      if (result.kind === 'test' && result.tags && result.tags.length > 0)
        details.push(`tags: ${result.tags.join(',')}`);
      const summary = result.summary ? ` — ${result.summary}` : '';
      return truncate(`${details[0]}  ${details.slice(1).join('  ')}${summary}`);
    })
    .join('\n');
}

export function formatShowEntry(index: Index, entry: Record<string, unknown>): string {
  const lines: string[] = [];
  if ('methods' in entry) {
    const helper = entry as unknown as Index['helpers'][number];
    lines.push(`${helper.kind} ${helper.name}`, `${helper.file}:${helper.line}-${helper.endLine}`);
    if (helper.doc) lines.push(helper.doc);
    if (helper.params) lines.push(`params: ${helper.params}`);
    if (helper.returns) lines.push(`returns: ${helper.returns}`);
    if (helper.extends) lines.push(`extends: ${helper.extends}`);
    lines.push(`category: ${helper.category}`);
    if (helper.methods.length > 0)
      lines.push(
        `methods: ${helper.methods.map((method) => `${method.name}(${method.params ?? ''})`).join(', ')}`,
      );
    if (helper.navigatesTo.length > 0) lines.push(`navigatesTo: ${helper.navigatesTo.join(', ')}`);
    lines.push(`used in ${helper.usedBySpecCount} specs`);
    if (helper.referencedByFiles.length > 0)
      lines.push(`referenced by: ${helper.referencedByFiles.slice(0, 10).join(', ')}`);
    return lines.join('\n');
  }

  if ('visibility' in entry) {
    const method = entry as unknown as Index['helpers'][number]['methods'][number];
    const owner = index.helpers.find((helper) =>
      helper.methods.some((candidate) => candidate.id === method.id),
    );
    lines.push(`${owner?.name ?? ''}.${method.name}(${method.params ?? ''})`);
    if (method.doc) lines.push(method.doc);
    if (owner) lines.push(`class: ${owner.id}`, `${owner.file}:${owner.line}`);
    return lines.join('\n');
  }

  if ('suitePath' in entry) {
    const test = entry as unknown as Index['tests'][number];
    lines.push(
      test.title ?? 'test',
      `suite: ${test.suitePath.join(' > ')}`,
      `${test.file}:${test.line}`,
    );
    if (test.modifiers.length > 0) lines.push(`modifiers: ${test.modifiers.join(', ')}`);
    if (test.tags.length > 0) lines.push(`tags: ${test.tags.join(', ')}`);
    if (test.fixtures.length > 0) lines.push(`fixtures: ${test.fixtures.join(', ')}`);
    lines.push(`calls: ${test.calls.join(', ')}`, `navigatesTo: ${test.navigatesTo.join(', ')}`);
    return lines.join('\n');
  }

  const fixture = entry as unknown as Index['fixtures'][number];
  return [
    `fixture ${fixture.name}`,
    `scope: ${fixture.scope}`,
    `auto: ${fixture.auto}`,
    `option: ${fixture.option}`,
    `dependsOn: ${fixture.dependsOn.join(', ')}`,
    `${fixture.file}:${fixture.line}`,
    `testObject: ${fixture.testObject ?? ''}`,
  ].join('\n');
}
