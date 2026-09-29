import { searchIndex } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function findCommand(index: Index, query: string, kind: 'helper' | 'method' | 'test' | 'fixture' | 'any' = 'any', limit = 10) {
  const matches = searchIndex(index, query, { kind, limit });
  return matches.map((match) => {
    const helper = index.helpers.find((entry) => entry.id === match.id);
    const methodOwner = index.helpers.find((entry) => entry.methods.some((method) => method.id === match.id));
    const method = methodOwner?.methods.find((entry) => entry.id === match.id);
    const test = index.tests.find((entry) => entry.id === match.id);
    const fixture = index.fixtures.find((entry) => entry.id === match.id);
    const label = helper
      ? helper.kind === 'function' ? `${helper.name}(${helper.params ?? ''})` : helper.name
      : method && methodOwner ? `${methodOwner.name}.${method.name}(${method.params ?? ''})`
        : test ? [...test.suitePath, test.title ?? 'test'].filter(Boolean).join(' > ')
          : fixture?.name ?? match.label;
    const summary = helper?.doc ?? helper?.returns ?? helper?.valuePreview
      ?? method?.doc
      ?? match.summary;
    return {
      id: match.id,
      kind: match.kind,
      label,
      file: match.file,
      line: match.line,
      score: match.score,
      usedBySpecCount: match.usedBySpecCount,
      summary,
      tags: test?.tags ?? [],
    };
  });
}
