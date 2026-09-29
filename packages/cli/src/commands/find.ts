import { searchIndex } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function findCommand(index: Index, query: string, kind: 'helper' | 'method' | 'test' | 'fixture' | 'any' = 'any', limit = 10) {
  const matches = searchIndex(index, query, { kind, limit });
  return matches.map((match) => ({
    id: match.id,
    kind: match.kind,
    label: match.label,
    file: match.file,
    line: match.line,
    score: match.score,
    usedBySpecCount: match.usedBySpecCount,
    summary: match.summary,
  }));
}
