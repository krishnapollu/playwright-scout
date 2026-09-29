import type { Index } from './schema.js';

export interface SearchOptions {
  kind?: 'helper' | 'method' | 'test' | 'fixture' | 'any';
  limit?: number;
}

function tokenize(value: string): string[] {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9_\s]/g, ' ')
    .toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const stopwords = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'and', 'or', 'in', 'on', 'with', 'is', 'are']);
  return [...new Set(tokens.filter((token) => token.length > 1 && !stopwords.has(token)))];
}

function scoreCandidate(text: string, queryTokens: string[]): number {
  const fieldTokens = tokenize(text);
  let score = 0;
  for (const token of queryTokens) {
    if (fieldTokens.includes(token)) score += 5;
    else if (fieldTokens.some((fieldToken) => fieldToken.startsWith(token) || token.startsWith(fieldToken))) score += 2;
  }
  return score;
}

export function searchIndex(index: Index, query: string, options: SearchOptions = {}): Array<{ id: string; kind: string; label: string; file: string; line: number; score: number; usedBySpecCount: number; summary: string | null }> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const kindFilter = options.kind ?? 'any';
  const limit = options.limit ?? 10;
  const results: Array<{ id: string; kind: string; label: string; file: string; line: number; score: number; usedBySpecCount: number; summary: string | null }> = [];

  for (const helper of index.helpers) {
      if (kindFilter !== 'any' && kindFilter !== 'helper') continue;
    const text = [helper.name, helper.doc ?? '', helper.file, helper.params ?? '', helper.returns ?? ''].join(' ');
    const score = scoreCandidate(text, queryTokens);
    if (score <= 0) continue;
    results.push({ id: helper.id, kind: 'helper', label: helper.name, file: helper.file, line: helper.line, score, usedBySpecCount: helper.usedBySpecCount, summary: helper.doc });
  }

  for (const test of index.tests) {
    if (kindFilter !== 'any' && kindFilter !== 'test') continue;
    const text = [test.title ?? '', test.file, test.tags.join(' '), test.suitePath.join(' ')].join(' ');
    const score = scoreCandidate(text, queryTokens);
    if (score <= 0) continue;
    results.push({ id: test.id, kind: 'test', label: test.title ?? 'test', file: test.file, line: test.line, score, usedBySpecCount: 0, summary: test.title });
  }

  for (const fixture of index.fixtures) {
    if (kindFilter !== 'any' && kindFilter !== 'fixture') continue;
    const score = scoreCandidate(`${fixture.name} ${fixture.file}`, queryTokens);
    if (score <= 0) continue;
    results.push({ id: fixture.id, kind: 'fixture', label: fixture.name, file: fixture.file, line: fixture.line, score, usedBySpecCount: 0, summary: null });
  }

  for (const helper of index.helpers) {
    for (const method of helper.methods) {
      if (kindFilter !== 'any' && kindFilter !== 'method') continue;
      const score = scoreCandidate(`${helper.name}.${method.name} ${method.doc ?? ''} ${method.params ?? ''}`, queryTokens);
      if (score <= 0) continue;
      results.push({ id: method.id, kind: 'method', label: `${helper.name}.${method.name}`, file: helper.file, line: method.line, score, usedBySpecCount: helper.usedBySpecCount, summary: method.doc });
    }
  }

  results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return results.slice(0, limit);
}
