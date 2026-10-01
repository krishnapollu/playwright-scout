import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = 'https://registry.npmjs.org/';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const yes = args.includes('--yes');
const tagPosition = args.indexOf('--tag');
const tag = tagPosition < 0 ? 'latest' : args[tagPosition + 1];
const allowed = new Set(['--dry-run', '--yes', '--tag']);

if (args.some((arg, index) => !allowed.has(arg) && index !== tagPosition + 1)) {
  throw new Error('Usage: npm run release:publish -- [--dry-run] [--tag <tag>] [--yes]');
}
if (!tag || !/^[a-z][a-z0-9.-]*$/.test(tag)) throw new Error('Provide a valid npm dist-tag.');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readToken() {
  if (process.env.npm_pat) return process.env.npm_pat;
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath))
    throw new Error('Add npm_pat to .env or export npm_pat in your shell.');
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => /^\s*(?:export\s+)?npm_pat\s*=/.test(entry));
  if (!line) throw new Error('npm_pat was not found in .env.');
  const value = line.slice(line.indexOf('=') + 1).trim();
  const token = value.replace(/^(['"])(.*)\1$/, '$2');
  if (!token) throw new Error('npm_pat is empty.');
  return token;
}

const core = readJson('packages/core/package.json');
const cli = readJson('packages/cli/package.json');
if (cli.dependencies['playwright-scout-core'] !== `^${core.version}`) {
  throw new Error('The CLI core dependency must match the core package version.');
}
if ([core.version, cli.version].some((version) => version.includes('-')) && tag === 'latest') {
  throw new Error('Prerelease versions need an explicit tag, for example --tag next.');
}

const authEnv = {
  ...process.env,
  'npm_config_//registry.npmjs.org/:_authToken': readToken(),
};

function npm(commandArgs, { capture = false, auth = false } = {}) {
  const result = spawnSync('npm', commandArgs, {
    cwd: root,
    env: auth ? authEnv : process.env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  return result;
}

const identity = npm(['whoami', `--registry=${registry}`], { capture: true, auth: true });
if (identity.status !== 0) throw new Error('npm authentication failed. Check npm_pat in .env.');
console.log(`npm account: ${identity.stdout.trim()}`);

for (const commandArgs of [
  ['run', 'check'],
  ['run', 'build', '--workspace', 'packages/cli'],
]) {
  if (npm(commandArgs).status !== 0) process.exit(1);
}

for (const [workspace, requiredFiles] of [
  ['packages/core', ['dist/index.js']],
  ['packages/cli', ['dist/bin.js', 'skills/playwright-scout/SKILL.md']],
]) {
  const packed = npm(['pack', '--workspace', workspace, '--dry-run', '--json'], { capture: true });
  if (packed.status !== 0) throw new Error(`Could not inspect ${workspace} package contents.`);
  const [manifest] = JSON.parse(packed.stdout);
  const files = new Set(manifest.files.map((file) => file.path));
  if (requiredFiles.some((file) => !files.has(file))) {
    throw new Error(`${workspace} is missing required files in its npm package.`);
  }
  console.log(`Ready: ${manifest.id} (${manifest.entryCount} files)`);
}

if (dryRun) {
  console.log('Dry run complete; nothing was published.');
  process.exit(0);
}

if (!yes) {
  if (!process.stdin.isTTY) throw new Error('Run interactively or pass --yes.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await input.question(
    `Publish ${core.name}@${core.version} and ${cli.name}@${cli.version} under the "${tag}" tag? Type "publish" to continue: `,
  );
  input.close();
  if (answer !== 'publish') process.exit(0);
}

let publishedCount = 0;
for (const [workspace, pkg] of [
  ['packages/core', core],
  ['packages/cli', cli],
]) {
  const existing = npm(
    [
      'view',
      `${pkg.name}@${pkg.version}`,
      'version',
      `--registry=${registry}`,
      '--fetch-retries=0',
    ],
    { capture: true, auth: true },
  );
  if (existing.status === 0) {
    console.log(`Already published: ${pkg.name}@${pkg.version}; skipping.`);
    continue;
  }
  if (!existing.stderr.includes('E404'))
    throw new Error(`Could not check ${pkg.name} on npm: ${existing.stderr.trim()}`);
  const published = npm(
    [
      'publish',
      '--workspace',
      workspace,
      '--access',
      'public',
      '--tag',
      tag,
      `--registry=${registry}`,
    ],
    { auth: true },
  );
  if (published.status !== 0) process.exit(published.status ?? 1);
  publishedCount++;
}

console.log(
  publishedCount === 0
    ? 'Both package versions are already published.'
    : `Published ${publishedCount} package(s) under the "${tag}" tag.`,
);
