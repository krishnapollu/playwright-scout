import type { HelperEntry, Index, TestEntry } from './schema.js';
import { searchIndex } from './search.js';

export interface ContextOptions {
  limit?: number;
}

export interface ContextMatch {
  id: string;
  kind: string;
  label: string;
  file: string;
  line: number;
  score: number;
  summary: string | null;
}

export interface ContextResult {
  query: string;
  matches: ContextMatch[];
  relatedSpecs: string[];
  relatedHelpers: string[];
  fixtures: string[];
  routes: string[];
}

function helperForMethod(index: Index, id: string): HelperEntry | undefined {
  return index.helpers.find((helper) => helper.methods.some((method) => method.id === id));
}

function relatedTests(index: Index, matches: ContextMatch[]): TestEntry[] {
  const ids = new Set(matches.map((match) => match.id));
  return index.tests.filter((test) => test.calls.some((call) => ids.has(call)) || matches.some((match) => match.file === test.file));
}

function relatedRoutes(tests: TestEntry[], helpers: HelperEntry[]): string[] {
  return [...new Set([...tests.flatMap((test) => test.navigatesTo), ...helpers.flatMap((helper) => helper.navigatesTo)])]
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

/** Builds a compact, deterministic suite context for an agent query. */
export function buildContext(index: Index, query: string, options: ContextOptions = {}): ContextResult {
  const limit = options.limit ?? 8;
  const matches = searchIndex(index, query, { limit }).map(({ id, kind, label, file, line, score, summary }) => ({
    id, kind, label, file, line, score, summary,
  }));
  const related = relatedTests(index, matches);
  const helpers = matches
    .map((match) => index.helpers.find((helper) => helper.id === match.id) ?? helperForMethod(index, match.id))
    .filter((helper): helper is HelperEntry => helper !== undefined);
  const fixtures = [...new Set(related.flatMap((test) => test.fixtures))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const relatedSpecs = [...new Set(related.map((test) => test.file))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const relatedHelpers = [...new Set(helpers.map((helper) => helper.id))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return { query, matches, relatedSpecs, relatedHelpers, fixtures, routes: relatedRoutes(related, helpers) };
}
