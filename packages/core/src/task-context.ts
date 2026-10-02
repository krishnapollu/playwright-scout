import { ScoutError } from './errors.js';
import { searchIndex } from './search.js';
import type { Index, TestEntry } from './schema.js';

export interface TaskReference {
  id: string;
  label: string;
  file: string;
  line: number;
  reason: 'query_match' | 'called_by_related_test' | 'fixture_provider' | 'same_directory_example';
  summary: string | null;
}

export interface TaskPattern {
  observation: string;
  examples: Array<{ file: string; line: number }>;
}

export interface TaskBrief {
  query: string;
  staleIndex: boolean;
  searchLimit: number;
  reuse: TaskReference[];
  analogousTest: TaskReference | null;
  setupAndData: TaskReference[];
  observedPatterns: TaskPattern[];
  unknowns: string[];
  omitted: { reuse: number; analogousTest: number; setupAndData: number; observedPatterns: number };
}

export interface TaskBriefOptions {
  limit?: number;
  staleIndex?: boolean;
}

function short(value: string | null, max = 100): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function sameTest(test: TestEntry): TaskReference {
  return { id: test.id, label: test.title ?? 'Untitled test', file: test.file, line: test.line, reason: 'same_directory_example', summary: null };
}

export function buildTaskBrief(index: Index, query: string, options: TaskBriefOptions = {}): TaskBrief {
  const limit = options.limit ?? 8;
  const matches = searchIndex(index, query, { limit });
  const methodOwnerIds = new Set(matches.filter((match) => match.kind === 'method').map((match) => match.id.slice(0, match.id.lastIndexOf('.'))));
  const strongestReuse = Math.max(0, ...matches.filter((match) => match.kind !== 'test').map((match) => match.score));
  const reuse: TaskReference[] = matches.filter((match) => match.kind !== 'test' && !methodOwnerIds.has(match.id)
    && (match.kind !== 'class' || match.score >= strongestReuse * 0.35)).slice(0, 5).map((match) => ({
    id: match.id, label: match.label, file: match.file, line: match.line,
    reason: 'query_match',
    summary: short(match.kind === 'fixture'
      ? index.fixtures.find((fixture) => fixture.id === match.id)?.providesHelperIds.map((id) => id.split('#').at(-1)).join(', ') ?? null
      : match.summary),
  }));
  const matchIds = new Set(reuse.map((item) => item.id));
  const methodMatchIds = new Set(matches.filter((match) => match.kind === 'method' && matchIds.has(match.id)).map((match) => match.id));
  const matchedTest = matches.find((match) => match.kind === 'test');
  const directMatch = matchedTest ? index.tests.find((test) => test.id === matchedTest.id) : undefined;
  const relatedTests = index.tests.filter((test) => test.calls.some((id) => matchIds.has(id)));
  const methodOverlap = (test: TestEntry | undefined): number => test?.calls.filter((id) => methodMatchIds.has(id)).length ?? 0;
  let strongestRelated: TestEntry | undefined;
  for (const test of relatedTests) {
    if (!strongestRelated || methodOverlap(test) > methodOverlap(strongestRelated)
      || (methodOverlap(test) === methodOverlap(strongestRelated) && directMatch !== undefined
        && test.file === directMatch.file && strongestRelated.file !== directMatch.file)) {
      strongestRelated = test;
    }
  }
  const analogue = strongestRelated && methodOverlap(strongestRelated) > methodOverlap(directMatch)
    ? strongestRelated : directMatch ?? strongestRelated;
  const analogousTest = analogue ? {
    ...sameTest(analogue),
    reason: analogue === directMatch ? 'query_match' as const : 'called_by_related_test' as const,
  } : null;
  const setupAndData: TaskReference[] = [];
  if (analogue) {
    for (const name of analogue.fixtures) {
      const candidates = index.fixtures.filter((entry) => entry.name === name);
      if (candidates.length !== 1) continue;
      const fixture = candidates[0];
      if (!fixture) continue;
      setupAndData.push({ id: fixture.id, label: fixture.name, file: fixture.file, line: fixture.line,
        reason: 'fixture_provider', summary: fixture.providesHelperIds.length ? `Provides ${fixture.providesHelperIds.join(', ')}` : null });
    }
  }
  const uniqueSetup = [...new Map(setupAndData.filter((item) => !matchIds.has(item.id)).map((item) => [item.id, item])).values()]
    .sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line);
  const observedPatterns: TaskPattern[] = [];
  if (analogue) {
    for (const name of analogue.fixtures) {
      if (['page', 'request', 'context', 'browser', 'browserName'].includes(name)) continue;
      const examples = index.tests.filter((test) => test.fixtures.includes(name) && test.file === analogue.file).slice(0, 2);
      if (examples.length < 2) continue;
      observedPatterns.push({ observation: `Tests in ${analogue.file} use the ${name} fixture`,
        examples: examples.map((test) => ({ file: test.file, line: test.line })) });
    }
  }
  const unknowns = ['Business expectations are not supplied by the source index.'];
  if (!analogousTest) unknowns.push(`No indexed test clearly matches this task among the top ${limit} search results.`);
  if (index.diagnostics.some((diagnostic) => ['PARSE_ERROR', 'UNRESOLVED_IMPORT', 'CJS_UNSUPPORTED'].includes(diagnostic.code))) {
    unknowns.push('Some source relationships may be missing; inspect index diagnostics.');
  }
  return { query, staleIndex: options.staleIndex ?? false, searchLimit: limit, reuse,
    analogousTest, setupAndData: uniqueSetup, observedPatterns, unknowns,
    omitted: { reuse: 0, analogousTest: 0, setupAndData: 0, observedPatterns: 0 } };
}

export function renderTaskBrief(brief: TaskBrief, format: 'text' | 'json'): string {
  if (format === 'json') return `${JSON.stringify(brief)}\n`;
  const lines = [`task: ${brief.query}`, `index: ${brief.staleIndex ? 'stale; run npx playwright-scout map' : 'current'}`, `search limit: ${brief.searchLimit}`];
  if (brief.reuse.length) lines.push('reuse:', ...brief.reuse.map((item) => `- ${item.label} [${item.id}] ${item.file}:${item.line} (${item.reason})${item.summary ? ` — ${item.summary}` : ''}`));
  if (brief.analogousTest) {
    const item = brief.analogousTest;
    lines.push(`similar test: ${item.label} [${item.id}] ${item.file}:${item.line} (${item.reason})`);
  }
  if (brief.setupAndData.length) lines.push('setup and data:', ...brief.setupAndData.map((item) => `- ${item.label} [${item.id}] ${item.file}:${item.line} (${item.reason})${item.summary ? ` — ${item.summary}` : ''}`));
  if (brief.observedPatterns.length) lines.push('observed patterns:', ...brief.observedPatterns.map((item) => `- ${item.observation} (${item.examples.map((example) => `${example.file}:${example.line}`).join(', ')})`));
  lines.push('unknowns:', ...brief.unknowns.map((value) => `- ${value}`));
  const { omitted } = brief;
  if (Object.values(omitted).some((value) => value > 0)) lines.push(`omitted: reuse ${omitted.reuse}, similar tests ${omitted.analogousTest}, setup/data ${omitted.setupAndData}, patterns ${omitted.observedPatterns}`);
  return `${lines.join('\n')}\n`;
}

/** Includes complete items until the entire serialized response fits the limit. */
export function boundTaskBrief(full: TaskBrief, maxChars: number, format: 'text' | 'json'): { brief: TaskBrief; output: string } {
  if (!Number.isInteger(maxChars) || maxChars < 500) throw new ScoutError('USAGE', '--max-chars must be an integer of at least 500');
  const result: TaskBrief = { ...full, reuse: [], analogousTest: null, setupAndData: [], observedPatterns: [],
    omitted: { reuse: full.reuse.length, analogousTest: full.analogousTest ? 1 : 0,
      setupAndData: full.setupAndData.length, observedPatterns: full.observedPatterns.length } };
  if (renderTaskBrief(result, format).length > maxChars) throw new ScoutError('USAGE', 'task and required context exceed --max-chars');
  const include = (section: 'reuse' | 'setupAndData' | 'observedPatterns', item: TaskReference | TaskPattern): void => {
    if (section === 'observedPatterns') result.observedPatterns.push(item as TaskPattern);
    else result[section].push(item as TaskReference);
    result.omitted[section]--;
    if (renderTaskBrief(result, format).length <= maxChars) return;
    result[section].pop();
    result.omitted[section]++;
  };
  for (const item of full.reuse) include('reuse', item);
  if (full.analogousTest) {
    result.analogousTest = full.analogousTest;
    result.omitted.analogousTest = 0;
    if (renderTaskBrief(result, format).length > maxChars) {
      result.analogousTest = null;
      result.omitted.analogousTest = 1;
    }
  }
  for (const item of full.setupAndData) include('setupAndData', item);
  for (const item of full.observedPatterns) include('observedPatterns', item);
  return { brief: result, output: renderTaskBrief(result, format) };
}
