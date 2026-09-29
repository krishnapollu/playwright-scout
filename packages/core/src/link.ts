import path from 'node:path';
import { extractFacts, type FileFacts } from './facts.js';
import { parseFile } from './parse.js';
import type { Diagnostic, FixtureEntry, HelperEntry, MethodEntry, SpecEntry, Stats, TagEntry, TestEntry } from './schema.js';

export interface LinkedResult {
  specs: SpecEntry[];
  tests: TestEntry[];
  helpers: HelperEntry[];
  fixtures: FixtureEntry[];
  tags: TagEntry[];
  diagnostics: Diagnostic[];
  stats: Stats;
  helperDirs: Array<{ dir: string; count: number }>;
}

function makeId(file: string, name: string): string {
  return `helper:${file}#${name}`;
}

export function linkFiles(files: string[], factsByFile: Map<string, FileFacts>, diagnostics: Diagnostic[]): LinkedResult {
  const helpers: HelperEntry[] = [];
  const fixtures: FixtureEntry[] = [];
  const tests: TestEntry[] = [];
  const specs: SpecEntry[] = [];
  const helperDirs = new Map<string, number>();
  const helperByName = new Map<string, string[]>();
  const helperByMethodName = new Map<string, string[]>();

  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts) continue;

    for (const detail of facts.helperDetails) {
      const methodRecords: MethodEntry[] = detail.methods.map((method) => ({
        ...method,
        id: `${makeId(detail.file, detail.name)}.${method.name}`,
      }));
      const entry: HelperEntry = {
        id: detail.id,
        kind: detail.kind,
        name: detail.name,
        exportName: detail.exportName,
        file: detail.file,
        line: detail.line,
        endLine: detail.endLine,
        isAsync: detail.isAsync,
        params: detail.params,
        returns: detail.returns,
        valuePreview: detail.valuePreview,
        extends: detail.extends,
        category: detail.category,
        doc: detail.doc,
        methods: methodRecords,
        navigatesTo: detail.navigatesTo,
        usedBySpecCount: 0,
        referencedByFiles: [],
        referencedByTruncated: false,
      };
      helpers.push(entry);
      for (const key of [detail.name, detail.exportName]) {
        if (key) {
          const current = helperByName.get(key) ?? [];
          current.push(entry.id);
          helperByName.set(key, [...new Set(current)]);
        }
      }
      for (const method of entry.methods) {
        const key = method.name;
        const current = helperByMethodName.get(key) ?? [];
        current.push(method.id);
        helperByMethodName.set(key, [...new Set(current)]);
      }
      const dir = path.posix.dirname(file);
      helperDirs.set(dir, (helperDirs.get(dir) ?? 0) + 1);
    }

    for (const fixture of facts.fixtureDefs) {
      fixtures.push({
        id: fixture.id,
        name: fixture.name,
        file: fixture.file,
        line: fixture.line,
        scope: fixture.scope,
        auto: fixture.auto,
        option: fixture.option,
        dependsOn: fixture.dependsOn,
        testObject: fixture.testObject,
      });
    }

    if (file.endsWith('.spec.ts') || file.endsWith('.spec.js') || file.endsWith('.test.ts') || file.endsWith('.test.js')) {
      const count = facts.testTree.length;
      specs.push({
        id: `spec:${file}`,
        file,
        testCount: count,
        tags: [...new Set(facts.testTree.flatMap((test) => test.tags))],
      });
      tests.push(...facts.testTree.map((test) => ({
        id: test.id,
        file: test.file,
        line: test.line,
        column: test.column,
        endLine: test.endLine,
        title: test.title,
        titleDynamic: test.titleDynamic,
        titleSource: test.titleSource,
        suitePath: test.suitePath,
        modifiers: test.modifiers,
        tags: test.tags,
        fixtures: test.fixtures,
        calls: test.calls,
        navigatesTo: test.navigatesTo,
        inLoop: test.inLoop,
      }))); 
    }
  }

  const referenceMap = new Map<string, Set<string>>();
  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts) continue;
    for (const ref of facts.references) {
      const ids = new Set<string>();
      for (const id of helperByName.get(ref) ?? []) ids.add(id);
      for (const id of helperByMethodName.get(ref) ?? []) ids.add(id);
      if (ids.size > 0) {
        const set = referenceMap.get(file) ?? new Set<string>();
        for (const id of ids) set.add(id);
        referenceMap.set(file, set);
      }
    }
    for (const helper of helpers) {
      if (facts.references.has(helper.name) || facts.references.has(helper.exportName)) {
        const set = referenceMap.get(file) ?? new Set<string>();
        set.add(helper.id);
        for (const method of helper.methods) set.add(method.id);
        referenceMap.set(file, set);
      }
    }
  }

  for (const [file, ids] of referenceMap.entries()) {
    for (const id of ids) {
      const helper = helpers.find((entry) => entry.id === id || entry.methods.some((method) => method.id === id));
      if (!helper) continue;
      const targetId = helper.id;
      const helperEntry = helpers.find((entry) => entry.id === targetId);
      if (!helperEntry) continue;
      const current = new Set(helperEntry.referencedByFiles);
      current.add(file);
      helperEntry.referencedByFiles = [...current].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
  }

  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts || !facts.testTree.length) continue;
    for (const test of facts.testTree) {
      const calls = new Set<string>();
      for (const ref of new Set(facts.references)) {
        for (const id of helperByName.get(ref) ?? []) calls.add(id);
        for (const id of helperByMethodName.get(ref) ?? []) calls.add(id);
      }
      for (const helper of helpers) {
        if (facts.references.has(helper.name) || facts.references.has(helper.exportName)) {
          calls.add(helper.id);
          for (const method of helper.methods) calls.add(method.id);
        }
      }
      test.calls = [...calls].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
  }

  const helperCounts = new Map<string, number>();
  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts || !file.includes('.spec.') && !file.includes('.test.')) continue;
    for (const test of facts.testTree) {
      for (const call of test.calls) {
        helperCounts.set(call, (helperCounts.get(call) ?? 0) + 1);
      }
    }
  }

  const helperMap = new Map(helpers.map((helper) => [helper.id, helper]));
  for (const [id, count] of helperCounts) {
    const helper = helperMap.get(id);
    if (helper) {
      helper.usedBySpecCount = count;
    }
  }

  const tagCounts = new Map<string, number>();
  for (const test of tests) {
    for (const tag of test.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...tagCounts.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([tag, testCount]) => ({ tag, testCount }));

  const stats: Stats = {
    specFiles: specs.length,
    tests: tests.length,
    helpers: helpers.length,
    methods: helpers.reduce((sum, helper) => sum + helper.methods.length, 0),
    pageObjects: helpers.filter((helper) => helper.category === 'page-object').length,
    fixtures: fixtures.length,
    tags: tags.length,
    filesParsed: files.length,
    filesSkipped: 0,
  };

  return {
    specs,
    tests,
    helpers,
    fixtures,
    tags,
    diagnostics,
    stats,
    helperDirs: [...helperDirs.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([dir, count]) => ({ dir, count })),
  };
}

export function buildFactsForFile(relPath: string, text: string, isSpec: boolean): FileFacts {
  return extractFacts(relPath, parseFile(relPath, text), isSpec);
}
