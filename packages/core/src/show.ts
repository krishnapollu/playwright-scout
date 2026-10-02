import type { Index, HelperEntry, MethodEntry, TestEntry, FixtureEntry } from './schema.js';
import { tokenize } from './search.js';

export type ShowEntry = HelperEntry | MethodEntry | TestEntry | FixtureEntry;

export type EntryResolution =
  | { status: 'ok'; entry: ShowEntry }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: string[] };

function entries(index: Index): ShowEntry[] {
  const all: ShowEntry[] = [];
  for (const helper of index.helpers) {
    all.push(helper, ...helper.methods);
  }
  all.push(...index.tests, ...index.fixtures);
  return all;
}

function entryLabel(entry: ShowEntry): string {
  if ('methods' in entry) return entry.name;
  if ('visibility' in entry) return `${entry.id.slice(entry.id.lastIndexOf('#') + 1)}`;
  if ('suitePath' in entry)
    return [...entry.suitePath, entry.title ?? ''].filter(Boolean).join(' > ');
  return entry.name;
}

function suffix(entry: ShowEntry): string {
  const hash = entry.id.lastIndexOf('#');
  const separator = entry.id.lastIndexOf('::');
  const index = Math.max(hash, separator);
  return index < 0 ? '' : entry.id.slice(index + (index === separator ? 2 : 1));
}

export function resolveEntry(index: Index, id: string): EntryResolution {
  const all = entries(index);
  const normalized = id.toLowerCase();
  const exactId = all.filter((entry) => entry.id.toLowerCase() === normalized);
  if (exactId.length === 1) return { status: 'ok', entry: exactId[0]! };

  const exactLabelOrSuffix = all.filter(
    (entry) =>
      entryLabel(entry).toLowerCase() === normalized || suffix(entry).toLowerCase() === normalized,
  );
  if (exactLabelOrSuffix.length === 1) return { status: 'ok', entry: exactLabelOrSuffix[0]! };
  if (exactLabelOrSuffix.length > 1) {
    return {
      status: 'ambiguous',
      candidates: exactLabelOrSuffix
        .map((entry) => entry.id)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    };
  }

  const queryTokens = tokenize(id);
  const tokenMatches = all.filter((entry) => {
    const labelTokens = tokenize(entryLabel(entry));
    return queryTokens.length > 0 && queryTokens.every((token) => labelTokens.includes(token));
  });
  if (tokenMatches.length === 0) return { status: 'not_found' };
  if (tokenMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: tokenMatches
        .map((entry) => entry.id)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    };
  }
  return { status: 'ok', entry: tokenMatches[0]! };
}

export function showEntry(index: Index, id: string): ShowEntry | null {
  const result = resolveEntry(index, id);
  return result.status === 'ok' ? result.entry : null;
}
