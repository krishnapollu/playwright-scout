import type { HelperEntry, Index, TestEntry } from './schema.js';
import { resolveEntry, type ShowEntry } from './show.js';

export interface ImpactResult {
  id: string;
  status: 'ok' | 'not_found' | 'ambiguous';
  candidates?: string[];
  entry?: ShowEntry;
  helper?: string;
  directSpecs: string[];
  relatedHelpers: string[];
  tests: string[];
}

function owner(index: Index, entry: ShowEntry): HelperEntry | undefined {
  if ('methods' in entry) return entry;
  return index.helpers.find((helper) => helper.methods.some((method) => method.id === entry.id));
}

function matchingTests(index: Index, helperId: string, methodId: string | null): TestEntry[] {
  return index.tests.filter((test) => test.calls.includes(helperId) || (methodId !== null && test.calls.includes(methodId)));
}

/** Finds the indexed tests and helpers affected by a helper or method. */
export function getImpact(index: Index, id: string): ImpactResult {
  const resolution = resolveEntry(index, id);
  if (resolution.status !== 'ok') return { id, status: resolution.status, ...(resolution.status === 'ambiguous' ? { candidates: resolution.candidates } : {}), directSpecs: [], relatedHelpers: [], tests: [] };
  const entry = resolution.entry;
  const helper = owner(index, entry);
  if (!helper) return { id, status: 'ok', entry, directSpecs: [], relatedHelpers: [], tests: [] };
  const methodId = 'visibility' in entry ? entry.id : null;
  const tests = matchingTests(index, helper.id, methodId);
  const relatedHelpers = index.helpers
    .filter((candidate) => candidate.id !== helper.id && candidate.referencedByFiles.includes(helper.file))
    .map((candidate) => candidate.id)
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return {
    id,
    status: 'ok',
    entry,
    helper: helper.id,
    directSpecs: [...new Set(tests.map((test) => test.file))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
    relatedHelpers,
    tests: tests.map((test) => test.id).sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
  };
}
