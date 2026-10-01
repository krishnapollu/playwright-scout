import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(cliRoot, '../..');
const readme = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
const githubRoot = 'https://github.com/krishnapollu/playwright-scout/blob/main/';
const npmReadme = readme.replace(
  /\]\((docs\/[^)]+|LICENSE)\)/g,
  (_, target) => `](${githubRoot}${target})`,
);

await fs.writeFile(path.join(cliRoot, 'README.md'), npmReadme, 'utf8');
