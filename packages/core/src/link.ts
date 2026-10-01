import path from 'node:path';
import type { FileFacts } from './facts.js';
import type { TsAliasConfig } from './config.js';
import { resolveExportFromFacts, resolveSpecifier } from './resolve.js';
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

export interface LinkOptions {
  root: string;
  aliasConfig: TsAliasConfig;
  specFiles: Set<string>;
}

function makeId(file: string, name: string): string {
  return `helper:${file}#${name}`;
}

export function linkFiles(files: string[], factsByFile: Map<string, FileFacts>, diagnostics: Diagnostic[], options: LinkOptions): LinkedResult {
  const helpers: HelperEntry[] = [];
  const fixtures: FixtureEntry[] = [];
  const tests: TestEntry[] = [];
  const specs: SpecEntry[] = [];
  const helperByDeclaration = new Map<string, HelperEntry>();
  const resolveLocal = (fromFile: string, specifier: string) => resolveSpecifier(fromFile, specifier, options.aliasConfig, options.root);

  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts) continue;
    const exportedNames = new Set(facts.exports.filter((item) => item.from === null && item.localName !== null).map((item) => item.localName));
    for (const detail of facts.helperDetails) {
      if (!exportedNames.has(detail.name)) continue;
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
      helperByDeclaration.set(`${detail.file}#${detail.name}`, entry);
    }
    for (const fixture of facts.fixtureDefs) {
      const duplicateNames = facts.fixtureDefs.filter((candidate) => candidate.name === fixture.name).length > 1;
      fixtures.push({
        id: duplicateNames ? `fixture:${fixture.file}#${fixture.testObject ?? 'unknown'}.${fixture.name}` : fixture.id,
        name: fixture.name,
        file: fixture.file,
        line: fixture.line,
        scope: fixture.scope,
        auto: fixture.auto,
        option: fixture.option,
        dependsOn: fixture.dependsOn,
        testObject: fixture.testObject,
        providesHelperIds: [],
      });
    }
  }

  const importBindings = new Map<string, Map<string, HelperEntry>>();
  const namespaceBindings = new Map<string, Map<string, Map<string, HelperEntry>>>();
  const referenceFiles = new Map<string, Set<string>>();

  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts) continue;
    const locals = new Map<string, HelperEntry>();
    const namespaces = new Map<string, Map<string, HelperEntry>>();
    for (const binding of facts.imports) {
      if (binding.typeOnly) continue;
      const target = resolveLocal(file, binding.specifier);
      if (!target) continue;
      if (binding.kind === 'namespace') {
        const members = new Map<string, HelperEntry>();
        const memberNames = new Set(facts.namespaceMembers.filter((item) => item.ns === binding.local).map((item) => item.member));
        for (const member of memberNames) {
          const resolved = resolveExportFromFacts(factsByFile, resolveLocal, target, member);
          const helper = resolved ? helperByDeclaration.get(`${resolved.file}#${resolved.localName ?? 'default'}`) : undefined;
          if (helper) members.set(member, helper);
        }
        namespaces.set(binding.local, members);
        for (const helper of members.values()) {
          if (!facts.references.has(binding.local) && !memberNames.size) continue;
          const referrers = referenceFiles.get(helper.id) ?? new Set<string>();
          if (file !== helper.file) referrers.add(file);
          referenceFiles.set(helper.id, referrers);
        }
        continue;
      }
      const resolved = resolveExportFromFacts(factsByFile, resolveLocal, target, binding.imported ?? 'default');
      const helper = resolved ? helperByDeclaration.get(`${resolved.file}#${resolved.localName ?? 'default'}`) : undefined;
      if (!helper) continue;
      locals.set(binding.local, helper);
      if (facts.references.has(binding.local)) {
        const referrers = referenceFiles.get(helper.id) ?? new Set<string>();
        if (file !== helper.file) referrers.add(file);
        referenceFiles.set(helper.id, referrers);
      }
    }
    importBindings.set(file, locals);
    namespaceBindings.set(file, namespaces);
  }

  for (const fixture of fixtures) {
    const definition = factsByFile.get(fixture.file)?.fixtureDefs.find((candidate) => candidate.name === fixture.name && candidate.testObject === fixture.testObject);
    const provider = definition?.provider;
    if (!provider) continue;
    const helper = importBindings.get(fixture.file)?.get(provider.name)
      ?? helperByDeclaration.get(`${fixture.file}#${provider.name}`);
    if (helper?.kind === provider.kind) fixture.providesHelperIds = [helper.id];
  }

  const fixtureForTest = (file: string, binding: string | null, name: string): FixtureEntry | undefined => {
    if (!binding) return undefined;
    const facts = factsByFile.get(file);
    if (!facts) return undefined;
    let ownerFile = file;
    let ownerName = binding;
    const imported = facts.imports.find((item) => item.local === binding && !item.typeOnly);
    if (imported) {
      const target = resolveLocal(file, imported.specifier);
      const resolved = target && imported.kind !== 'namespace'
        ? resolveExportFromFacts(factsByFile, resolveLocal, target, imported.imported ?? 'default')
        : null;
      if (!resolved?.localName) return undefined;
      ownerFile = resolved.file;
      ownerName = resolved.localName;
    } else if (!facts.testObjectExports.has(binding)) {
      return undefined;
    }
    const candidates = fixtures.filter((fixture) => fixture.file === ownerFile && fixture.testObject === ownerName && fixture.name === name);
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  for (const file of files) {
    const facts = factsByFile.get(file);
    if (!facts) continue;
    if (options.specFiles.has(file)) {
      const count = facts.testTree.length;
      specs.push({
        id: `spec:${file}`,
        file,
        testCount: count,
        tags: [...new Set(facts.testTree.flatMap((test) => test.tags))],
      });
      for (const test of facts.testTree) {
        const calls = new Set<string>();
        const localImports = importBindings.get(file) ?? new Map<string, HelperEntry>();
        const namespaces = namespaceBindings.get(file) ?? new Map<string, Map<string, HelperEntry>>();
        for (const name of test.referencedNames) {
          const helper = localImports.get(name);
          if (helper) calls.add(helper.id);
        }
        for (const access of test.namespaceMembers) {
          const helper = namespaces.get(access.ns)?.get(access.member);
          if (helper) calls.add(helper.id);
        }
        for (const className of test.newExpressions) {
          const helper = localImports.get(className);
          if (helper?.kind === 'class') calls.add(helper.id);
        }
        for (const instance of test.instanceVariables) {
          const classEntry = localImports.get(instance.className);
          if (classEntry?.kind === 'class') {
            for (const call of test.instanceMethodCalls) {
              if (call.variable !== instance.variable) continue;
              const method = classEntry.methods.find((item) => item.name === call.method);
              if (method) calls.add(method.id);
            }
          }
        }
        for (const name of test.fixtures) {
          const fixture = fixtureForTest(file, test.testBinding, name);
          if (fixture?.providesHelperIds.length !== 1) continue;
          const helper = helpers.find((entry) => entry.id === fixture.providesHelperIds[0]);
          if (!helper) continue;
          calls.add(helper.id);
          if (helper.kind !== 'class') continue;
          for (const access of test.memberCalls) {
            if (access.variable !== name) continue;
            const method = helper.methods.find((entry) => entry.name === access.method);
            if (method) calls.add(method.id);
          }
        }
        test.calls = [...calls].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        for (const id of test.calls) {
          const helper = helpers.find((entry) => entry.id === id || entry.methods.some((method) => method.id === id));
          if (!helper || helper.file === file) continue;
          const referrers = referenceFiles.get(helper.id) ?? new Set<string>();
          referrers.add(file);
          referenceFiles.set(helper.id, referrers);
        }
        tests.push({
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
        });
      }
    }
  }

  for (const helper of helpers) {
    const referrers = [...(referenceFiles.get(helper.id) ?? [])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    helper.usedBySpecCount = referrers.filter((file) => options.specFiles.has(file)).length;
    helper.referencedByTruncated = referrers.length > 25;
    helper.referencedByFiles = referrers.slice(0, 25);
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

  const directoryFiles = new Map<string, Set<string>>();
  for (const helper of helpers) {
    const dir = path.posix.dirname(helper.file);
    const filesInDir = directoryFiles.get(dir) ?? new Set<string>();
    filesInDir.add(helper.file);
    directoryFiles.set(dir, filesInDir);
  }
  const helperDirs = [...directoryFiles.entries()].map(([dir, filesInDir]) => [dir, filesInDir.size] as const)
    .sort(([dirA, countA], [dirB, countB]) => countB - countA || (dirA < dirB ? -1 : dirA > dirB ? 1 : 0))
    .slice(0, 5)
    .map(([dir, count]) => ({ dir, count }));

  return {
    specs,
    tests,
    helpers,
    fixtures,
    tags,
    diagnostics,
    stats,
    helperDirs,
  };
}
