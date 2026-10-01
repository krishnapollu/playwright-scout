import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import path from 'node:path';
import { isUpToDate, mapCommand } from './commands/map.js';
import { findCommand } from './commands/find.js';
import { showCommand } from './commands/show.js';
import { installSkillCommand } from './commands/installSkill.js';
import { contextCommand } from './commands/context.js';
import { impactCommand } from './commands/impact.js';
import { fileImpactCommand } from './commands/fileImpact.js';
import { planCommand } from './commands/plan.js';
import { doctor, readIndex, ScoutError } from 'playwright-scout-core';
import { formatFindResults, formatShowEntry } from './format.js';

export interface OutputWriters {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultWriters: OutputWriters = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function exitCodeFor(error: unknown): number {
  if (error instanceof CommanderError) return error.code === 'commander.helpDisplayed' || error.code === 'commander.version' ? 0 : 2;
  if (error instanceof ScoutError) {
    if (error.code === 'NO_TESTS_FOUND') return 3;
    if (error.code === 'INDEX_MISSING' || error.code === 'INDEX_INVALID' || error.code === 'INDEX_SCHEMA_MISMATCH') return 4;
    if (error.code === 'NOT_FOUND' || error.code === 'AMBIGUOUS') return 5;
    if (error.code === 'USAGE') return 2;
  }
  return 1;
}

function errorText(error: unknown): string {
  if (error instanceof ScoutError) {
    if (error.code === 'INDEX_MISSING' || error.code === 'INDEX_INVALID' || error.code === 'INDEX_SCHEMA_MISMATCH') {
      return 'scout: index missing or invalid. Run: npx playwright-scout map';
    }
    return `scout: ${error.message}`;
  }
  if (error instanceof CommanderError) return '';
  const message = error instanceof Error ? error.message : String(error);
  return `scout: ${message}`;
}

export function createProgram(writers: OutputWriters = defaultWriters) {
  const program = new Command();
  program.name('playwright-scout');
  program.exitOverride();
  program.configureOutput({
    writeOut: (text) => writers.stdout(text),
    writeErr: (text) => writers.stderr(text),
    outputError: (text, write) => write(text),
  });

  program
    .command('map')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--out <file>', 'output index file')
    .option('--include <glob...>', 'include support files')
    .option('--no-timestamp', 'omit generatedAt timestamp')
    .option('--if-stale', 'skip if the index is current')
    .option('--json')
    .option('--verbose', 'list diagnostics')
    .option('--quiet')
    .action(async (options) => {
      const result = await mapCommand(options.root ?? process.cwd(), {
        json: !!options.json,
        quiet: !!options.quiet,
        noTimestamp: options.timestamp === false,
        ifStale: !!options.ifStale,
        include: options.include,
        out: options.out,
        verbose: !!options.verbose,
      });
      if (result.exitCode === 3) throw new ScoutError('NO_TESTS_FOUND', result.stderr);
      if (result.stderr) writers.stderr(`${result.stderr}\n`);
      if (result.stdout) writers.stdout(`${result.stdout}\n`);
    });

  program
    .command('find <query...>')
    .option('--root <dir>', 'root directory', process.cwd())
    .addOption(new Option('--kind <kind>', 'kind').choices(['helper', 'method', 'test', 'fixture', 'any']).default('any'))
    .option('--limit <limit>', 'limit', (value: string) => {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1) throw new InvalidArgumentError('limit must be a positive integer');
      return limit;
    }, 10)
    .option('--json')
    .action(async (queryParts: string[], options) => {
      const index = await readIndex(options.root ?? process.cwd());
      const query = queryParts.join(' ');
      const result = findCommand(index, query, options.kind ?? 'any', options.limit ?? 10);
      const output = options.json
        ? JSON.stringify(result.map(({ id, kind, label, file, line, score, usedBySpecCount, summary }) => ({ id, kind, label, file, line, score, usedBySpecCount, summary })))
        : formatFindResults(query, result);
      writers.stdout(`${output}\n`);
    });

  program
    .command('show <id>')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--json')
    .action(async (id: string, options) => {
      const index = await readIndex(options.root ?? process.cwd());
      const result = showCommand(index, id);
      if (result.status === 'not_found') throw new ScoutError('NOT_FOUND', `not found: ${id}`);
      if (result.status === 'ambiguous') {
        writers.stderr(`${result.candidates.slice(0, 10).join('\n')}\n`);
        throw new ScoutError('AMBIGUOUS', `ambiguous: ${id}`);
      }
      const output = options.json ? JSON.stringify(result.entry) : formatShowEntry(index, result.entry);
      writers.stdout(`${output}\n`);
    });

  program
    .command('context <query...>')
    .description('build a compact suite context for an agent')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--limit <limit>', 'number of search matches', (value: string) => {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1) throw new InvalidArgumentError('limit must be a positive integer');
      return limit;
    }, 8)
    .option('--max-chars <n>', 'complete output character limit', (value: string) => {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 500) throw new InvalidArgumentError('max-chars must be an integer of at least 500');
      return limit;
    }, 6000)
    .option('--json')
    .action(async (queryParts: string[], options) => {
      const root = options.root ?? process.cwd();
      const index = await readIndex(root);
      const current = await isUpToDate(root, path.join(root, '.scout/index.json'));
      const result = contextCommand(index, queryParts.join(' '), {
        limit: options.limit, maxChars: options.maxChars, staleIndex: !current,
        format: options.json ? 'json' : 'text',
      });
      writers.stdout(result.output);
    });

  program
    .command('impact [id]')
    .description('show indexed tests and helpers affected by an entry')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--file <path>', 'existing root-relative source file')
    .option('--json')
    .action(async (id: string | undefined, options) => {
      const index = await readIndex(options.root ?? process.cwd());
      if (options.file) {
        if (id) throw new ScoutError('USAGE', 'provide either an entry ID or --file, not both');
        const result = await fileImpactCommand(index, options.root ?? process.cwd(), options.file);
        if (options.json) writers.stdout(`${JSON.stringify(result)}\n`);
        else writers.stdout(`${[
          `file: ${result.file}`,
          'knownAffectedTests:',
          ...result.knownAffectedTests.map((test) => `- ${test.id} ${test.file}:${test.line} (${test.reasons.join(', ')})`),
          ...(result.knownAffectedTests.length ? [] : ['- No affected tests proven by the index.']),
          'analysisLimits:',
          ...result.analysisLimits.map((limit) => `- ${limit}`),
        ].join('\n')}\n`);
        return;
      }
      if (!id) throw new ScoutError('USAGE', 'provide an entry ID or --file');
      const result = impactCommand(index, id);
      if (result.status === 'not_found') throw new ScoutError('NOT_FOUND', `not found: ${id}`);
      if (result.status === 'ambiguous') throw new ScoutError('AMBIGUOUS', `ambiguous: ${id}`);
      if (options.json) {
        writers.stdout(`${JSON.stringify(result)}\n`);
        return;
      }
      writers.stdout(`${[
        `entry: ${result.helper ?? result.entry?.id ?? id}`,
        `specs: ${result.directSpecs.join(', ') || 'none'}`,
        `tests: ${result.tests.join(', ') || 'none'}`,
        `related helpers: ${result.relatedHelpers.join(', ') || 'none'}`,
      ].join('\n')}\n`);
    });

  program
    .command('plan <query...>')
    .description('build an evidence-based reuse plan for an agent task')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--limit <limit>', 'number of search matches', (value: string) => {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1) throw new InvalidArgumentError('limit must be a positive integer');
      return limit;
    }, 8)
    .option('--json')
    .action(async (queryParts: string[], options) => {
      const index = await readIndex(options.root ?? process.cwd());
      const result = planCommand(index, queryParts.join(' '), options.limit ?? 8);
      if (options.json) {
        writers.stdout(`${JSON.stringify(result)}\n`);
        return;
      }
      writers.stdout(`${[`task: ${result.query}`, 'recommendations:', ...result.recommendations.map((item) => `- ${item}`)].join('\n')}\n`);
    });

  program
    .command('doctor')
    .description('opt-in static Playwright configuration guidance')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--json')
    .action((options) => {
      const result = doctor(options.root ?? process.cwd());
      if (options.json) {
        writers.stdout(`${JSON.stringify(result)}\n`);
        return;
      }
      writers.stdout(`${[
        'doctor: opt-in configuration guidance',
        'findings:',
        ...(result.findings.length ? result.findings.map((item) => `- ${item.ruleId} ${item.file}:${item.line} — ${item.suggestion} (${item.guideUrl})`) : ['- None from the supported checks.']),
        'unknowns:',
        ...(result.unknowns.length ? result.unknowns.map((item) => `- ${item}`) : ['- None reported.']),
      ].join('\n')}\n`);
    });

  program
    .command('install-skill')
    .addOption(new Option('--target <target>', 'agent target').choices(['claude', 'agents', 'github', 'cursor', 'all']).default('agents'))
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--global', 'install into the global Claude config directory')
    .option('--force', 'overwrite an existing skill file')
    .action(async (options) => {
      if (options.global && options.target !== 'claude') {
        throw new ScoutError('USAGE', '`--global` is only valid with `--target claude`.');
      }
      const output = await installSkillCommand({
        root: options.root ?? process.cwd(),
        target: options.target ?? 'agents',
        global: !!options.global,
        force: !!options.force,
      });
      writers.stdout(`${output}\n`);
    });

  return program;
}

export const program = createProgram();

export async function main(argv: string[] = process.argv, writers: OutputWriters = defaultWriters): Promise<number> {
  const program = createProgram(writers);
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    const text = errorText(error);
    if (text) writers.stderr(`${text}\n`);
    return exitCodeFor(error);
  }
}
