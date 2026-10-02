import type { Index } from './schema.js';

export interface KnownAffectedTest {
  id: string;
  file: string;
  line: number;
  reasons: Array<'direct_spec' | 'helper_call' | 'fixture_provider'>;
}

export interface FileImpactResult {
  file: string;
  knownAffectedTests: KnownAffectedTest[];
  analysisLimits: string[];
}

/** Reports proven static links. Empty output is not a safe-to-skip verdict. */
export function getFileImpact(index: Index, file: string): FileImpactResult {
  const helpers = index.helpers.filter((helper) => helper.file === file);
  const helperIds = new Set(
    helpers.flatMap((helper) => [helper.id, ...helper.methods.map((method) => method.id)]),
  );
  const fixtures = index.fixtures.filter(
    (fixture) => fixture.file === file && fixture.providesHelperIds.length > 0,
  );
  const uniqueFixtures = fixtures.filter(
    (fixture) => index.fixtures.filter((candidate) => candidate.name === fixture.name).length === 1,
  );
  const knownAffectedTests: KnownAffectedTest[] = [];
  for (const test of index.tests) {
    const reasons: KnownAffectedTest['reasons'] = [];
    if (test.file === file) reasons.push('direct_spec');
    if (test.calls.some((id) => helperIds.has(id))) reasons.push('helper_call');
    if (
      uniqueFixtures.some(
        (fixture) =>
          test.fixtures.includes(fixture.name) &&
          fixture.providesHelperIds.some((id) => test.calls.includes(id)),
      )
    )
      reasons.push('fixture_provider');
    if (reasons.length)
      knownAffectedTests.push({ id: test.id, file: test.file, line: test.line, reasons });
  }
  knownAffectedTests.sort((a, b) =>
    a.file < b.file
      ? -1
      : a.file > b.file
        ? 1
        : a.line - b.line || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return {
    file,
    knownAffectedTests,
    analysisLimits: [
      'Only direct spec, indexed helper-call, and proven fixture-provider relationships are reported.',
      'Dynamic calls and unsupported fixture shapes may affect other tests; an empty list does not mean all tests are safe to skip.',
    ],
  };
}
