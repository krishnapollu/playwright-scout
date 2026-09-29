import type { Index, HelperEntry, TestEntry, FixtureEntry } from './schema.js';

export function showEntry(index: Index, id: string): HelperEntry | TestEntry | FixtureEntry | null {
  const normalized = id.toLowerCase();
  const candidates: Array<HelperEntry | TestEntry | FixtureEntry> = [];
  for (const helper of index.helpers) {
    if (helper.id.toLowerCase().includes(normalized) || helper.name.toLowerCase().includes(normalized) || `${helper.name}`.toLowerCase().includes(normalized)) {
      candidates.push(helper);
    }
    for (const method of helper.methods) {
      if (method.id.toLowerCase().includes(normalized) || `${helper.name}.${method.name}`.toLowerCase().includes(normalized)) {
        candidates.push(method as unknown as HelperEntry);
      }
    }
  }
  for (const test of index.tests) {
    if (test.id.toLowerCase().includes(normalized) || (test.title ?? '').toLowerCase().includes(normalized)) {
      candidates.push(test);
    }
  }
  for (const fixture of index.fixtures) {
    if (fixture.id.toLowerCase().includes(normalized) || fixture.name.toLowerCase().includes(normalized)) {
      candidates.push(fixture);
    }
  }
  if (candidates.length === 0) return null;
  if (candidates.length > 1) return null;
  const first = candidates[0];
  return first ?? null;
}
