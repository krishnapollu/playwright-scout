import type { Index } from './schema.js';

export interface SearchOptions {
  kind?: 'helper' | 'method' | 'test' | 'fixture' | 'any';
  limit?: number;
}

export function tokenize(value: string): string[] {
  const camelSplit = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const tokens = camelSplit
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const stopwords = new Set([
    'a',
    'an',
    'the',
    'for',
    'to',
    'of',
    'and',
    'or',
    'in',
    'on',
    'with',
    'is',
    'are',
  ]);
  return [...new Set(tokens.filter((token) => token.length > 1 && !stopwords.has(token)))];
}

interface WeightedField {
  text: string;
  weight: number;
}

const SYNONYMS: Record<string, string[]> = {
  sign: ['login', 'signin', 'sign-in', 'authenticate', 'auth'],
  login: ['signin', 'sign-in', 'authenticate', 'auth'],
  signin: ['login', 'sign-in', 'authenticate', 'auth'],
  authenticate: ['login', 'signin', 'sign-in', 'auth'],
  auth: ['login', 'signin', 'sign-in', 'authenticate'],
  coupon: ['discount', 'promo', 'voucher'],
  discount: ['coupon', 'promo', 'voucher'],
  promo: ['coupon', 'discount', 'voucher'],
  voucher: ['coupon', 'discount', 'promo'],
  register: ['signup', 'create-account'],
  signup: ['register', 'create-account'],
  email: ['mail'],
  mail: ['email'],
  logout: ['signout', 'sign-out'],
  signout: ['logout', 'sign-out'],
  cart: ['basket'],
  basket: ['cart'],
  wait: ['idle', 'load'],
  idle: ['wait', 'load'],
  load: ['wait', 'idle'],
};

interface QueryToken {
  token: string;
  synonym: boolean;
}

function scoreCandidate(fields: WeightedField[], queryTokens: QueryToken[]): number {
  let score = 0;
  let allMatched = true;
  for (const token of queryTokens) {
    let matched = false;
    for (const field of fields) {
      const fieldTokens = tokenize(field.text);
      if (fieldTokens.includes(token.token)) {
        score += token.synonym ? Math.floor(field.weight / 2) : field.weight;
        matched = true;
      } else if (
        !token.synonym &&
        token.token.length >= 3 &&
        fieldTokens.some(
          (fieldToken) =>
            fieldToken.startsWith(token.token) ||
            (fieldToken.length >= 4 && token.token.startsWith(fieldToken)),
        )
      ) {
        score += Math.floor(field.weight / 2);
        matched = true;
      }
    }
    if (!matched && !token.synonym) allMatched = false;
  }
  if (allMatched) score += 2;
  return score;
}

export function searchIndex(
  index: Index,
  query: string,
  options: SearchOptions = {},
): Array<{
  id: string;
  kind: string;
  label: string;
  file: string;
  line: number;
  score: number;
  usedBySpecCount: number;
  summary: string | null;
}> {
  const queryTokens = tokenize(query).flatMap((token): QueryToken[] => [
    { token, synonym: false },
    ...(SYNONYMS[token] ?? []).map((synonym) => ({ token: synonym, synonym: true })),
  ]);
  if (queryTokens.length === 0) return [];

  const kindFilter = options.kind ?? 'any';
  const limit = options.limit ?? 10;
  const results: Array<{
    id: string;
    kind: string;
    label: string;
    file: string;
    line: number;
    score: number;
    usedBySpecCount: number;
    summary: string | null;
  }> = [];

  for (const helper of index.helpers) {
    if (kindFilter !== 'any' && kindFilter !== 'helper') continue;
    const fields = [
      { text: helper.name, weight: 5 },
      { text: helper.methods.map((method) => method.name).join(' '), weight: 3 },
      { text: helper.navigatesTo.join(' '), weight: 3 },
      { text: helper.file, weight: 2 },
      { text: helper.doc ?? '', weight: 2 },
      { text: helper.params ?? '', weight: 1 },
    ];
    const score = scoreCandidate(fields, queryTokens);
    if (score <= 0) continue;
    results.push({
      id: helper.id,
      kind: helper.kind,
      label: helper.name,
      file: helper.file,
      line: helper.line,
      score,
      usedBySpecCount: helper.usedBySpecCount,
      summary: helper.doc,
    });
  }

  for (const test of index.tests) {
    if (kindFilter !== 'any' && kindFilter !== 'test') continue;
    const score = scoreCandidate(
      [
        { text: [test.title ?? '', ...test.suitePath].join(' '), weight: 4 },
        { text: test.tags.join(' '), weight: 3 },
        { text: test.navigatesTo.join(' '), weight: 3 },
        { text: test.file, weight: 2 },
      ],
      queryTokens,
    );
    if (score <= 0) continue;
    results.push({
      id: test.id,
      kind: 'test',
      label: test.title ?? 'test',
      file: test.file,
      line: test.line,
      score,
      usedBySpecCount: 0,
      summary: test.title,
    });
  }

  for (const fixture of index.fixtures) {
    if (kindFilter !== 'any' && kindFilter !== 'fixture') continue;
    const score = scoreCandidate(
      [
        { text: fixture.name, weight: 5 },
        { text: fixture.file, weight: 2 },
      ],
      queryTokens,
    );
    if (score <= 0) continue;
    results.push({
      id: fixture.id,
      kind: 'fixture',
      label: fixture.name,
      file: fixture.file,
      line: fixture.line,
      score,
      usedBySpecCount: 0,
      summary: null,
    });
  }

  for (const helper of index.helpers) {
    for (const method of helper.methods) {
      if (kindFilter !== 'any' && kindFilter !== 'method') continue;
      const score = scoreCandidate(
        [
          { text: method.name, weight: 5 },
          { text: helper.navigatesTo.join(' '), weight: 3 },
          { text: helper.file, weight: 2 },
          { text: method.doc ?? '', weight: 2 },
          { text: method.params ?? '', weight: 1 },
        ],
        queryTokens,
      );
      if (score <= 0) continue;
      results.push({
        id: method.id,
        kind: 'method',
        label: `${helper.name}.${method.name}`,
        file: helper.file,
        line: method.line,
        score,
        usedBySpecCount: helper.usedBySpecCount,
        summary: method.doc,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return results.slice(0, limit);
}
