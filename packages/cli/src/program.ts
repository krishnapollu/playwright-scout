import { Command } from 'commander';
import { mapCommand } from './commands/map.js';
import { findCommand } from './commands/find.js';
import { showCommand } from './commands/show.js';
import { installSkillCommand } from './commands/installSkill.js';
import { readIndex } from 'playwright-scout-core';

export function createProgram() {
  const program = new Command();
  program.name('playwright-scout');

  program
    .command('map')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--json')
    .option('--quiet')
    .action(async (options) => {
      const output = await mapCommand(options.root ?? process.cwd(), { json: !!options.json, quiet: !!options.quiet });
      console.log(output);
    });

  program
    .command('find <query...>')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--kind <kind>', 'kind', 'any')
    .option('--limit <limit>', 'limit', '10')
    .action(async (queryParts: string[], options) => {
      const index = await readIndex(options.root ?? process.cwd());
      const query = queryParts.join(' ');
      const result = findCommand(index, query, options.kind ?? 'any', Number(options.limit ?? 10));
      console.log(JSON.stringify(result));
    });

  program
    .command('show <id>')
    .option('--root <dir>', 'root directory', process.cwd())
    .action(async (id: string, options) => {
      const index = await readIndex(options.root ?? process.cwd());
      const result = showCommand(index, id);
      console.log(JSON.stringify(result));
    });

  program
    .command('install-skill')
    .option('--target <target>', 'agent target', 'agents')
    .option('--root <dir>', 'root directory', process.cwd())
    .option('--global', 'install into the global Claude config directory')
    .option('--force', 'overwrite an existing skill file')
    .action(async (options) => {
      try {
        const output = await installSkillCommand({
          root: options.root ?? process.cwd(),
          target: options.target ?? 'agents',
          global: !!options.global,
          force: !!options.force,
        });
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`scout: ${message}`);
        process.exitCode = 2;
      }
    });

  return program;
}

export const program = createProgram();
