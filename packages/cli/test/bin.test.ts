import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../src/program.js';
import { installSkillCommand } from '../src/commands/installSkill.js';

const SAMPLE = fileURLToPath(new URL('../../../fixtures/sample-suite', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function sampleRoot(): Promise<string> {
  const root = await tempRoot('scout-cli-suite-');
  await fs.cp(SAMPLE, root, { recursive: true });
  return root;
}

function capture() {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    writers: {
      stdout: (text: string) => { output.stdout += text; },
      stderr: (text: string) => { output.stderr += text; },
    },
  };
}

describe('CLI commands', () => {
  it('maps the sample suite, writes the gitignore, and skips a current index', async () => {
    const root = await sampleRoot();
    const first = capture();
    expect(await main(['node', 'scout', 'map', '--root', root, '--no-timestamp'], first.writers)).toBe(0);
    expect(first.output.stdout).toContain('indexed 4 spec files, 7 tests, 7 helpers (2 page objects), 3 fixtures');
    expect(first.output.stdout).toContain('helper dirs: pages (2), utils (2), tests/support (1)');
    expect(await fs.readFile(path.join(root, '.scout/.gitignore'), 'utf8')).toBe('*\n');
    const index = JSON.parse(await fs.readFile(path.join(root, '.scout/index.json'), 'utf8')) as { generatedAt: string | null };
    expect(index.generatedAt).toBeNull();

    const second = capture();
    expect(await main(['node', 'scout', 'map', '--root', root, '--if-stale'], second.writers)).toBe(0);
    expect(second.output.stdout).toContain('scout: index is up to date');

    const oldIndex = JSON.parse(await fs.readFile(path.join(root, '.scout/index.json'), 'utf8')) as Record<string, unknown>;
    oldIndex.schemaVersion = 1;
    await fs.writeFile(path.join(root, '.scout/index.json'), JSON.stringify(oldIndex));
    const migrated = capture();
    expect(await main(['node', 'scout', 'map', '--root', root, '--if-stale'], migrated.writers)).toBe(0);
    expect(migrated.output.stdout).toContain('schema v2');

    const barrel = path.join(root, 'pages/index.ts');
    const future = new Date(Date.now() + 2000);
    await fs.utimes(barrel, future, future);
    const stale = capture();
    expect(await main(['node', 'scout', 'map', '--root', root, '--if-stale'], stale.writers)).toBe(0);
    expect(stale.output.stdout).toContain('scout: indexed 4 spec files');

    const custom = capture();
    expect(await main(['node', 'scout', 'map', '--root', root, '--out', 'artifacts/scout.json', '--json'], custom.writers)).toBe(0);
    expect(JSON.parse(custom.output.stdout)).toMatchObject({ specFiles: 4, tests: 7, helpers: 7, indexPath: 'artifacts/scout.json' });
    await expect(fs.access(path.join(root, 'artifacts/scout.json'))).resolves.toBeUndefined();
  });

  it('prints formatted find and show output', async () => {
    const root = await sampleRoot();
    const mapOutput = capture();
    expect(await main(['node', 'scout', 'map', '--root', root], mapOutput.writers)).toBe(0);

    const findOutput = capture();
    expect(await main(['node', 'scout', 'find', 'coupon', '--root', root], findOutput.writers)).toBe(0);
    expect(findOutput.output.stdout.split('\n')[0]).toContain('method   CheckoutPage.applyCoupon(code: string)');
    expect(findOutput.output.stdout.split('\n')[0]).toContain('pages/checkout.page.ts:5');

    const showOutput = capture();
    expect(await main(['node', 'scout', 'show', 'LoginPage.login', '--root', root], showOutput.writers)).toBe(0);
    expect(showOutput.output.stdout).toContain('LoginPage.login(user: string, pass: string)');

    const contextOutput = capture();
    expect(await main(['node', 'scout', 'context', 'coupon', '--root', root, '--json'], contextOutput.writers)).toBe(0);
    expect(JSON.parse(contextOutput.output.stdout)).toMatchObject({
      query: 'coupon',
      relatedSpecs: ['tests/checkout.spec.ts'],
    });
  });

  it('returns the documented usage, missing-index, no-tests, and not-found codes', async () => {
    const root = await tempRoot('scout-cli-empty-');
    const missing = capture();
    expect(await main(['node', 'scout', 'find', 'x', '--root', root], missing.writers)).toBe(4);
    expect(missing.output.stderr).toContain('Run: npx playwright-scout map');

    const noTests = capture();
    expect(await main(['node', 'scout', 'map', '--root', root], noTests.writers)).toBe(3);
    expect(noTests.output.stderr).toContain('No spec files found');
    await expect(fs.access(path.join(root, '.scout/index.json'))).rejects.toThrow();

    const suite = await sampleRoot();
    const mapped = capture();
    await main(['node', 'scout', 'map', '--root', suite], mapped.writers);
    const notFound = capture();
    expect(await main(['node', 'scout', 'show', 'missing-symbol', '--root', suite], notFound.writers)).toBe(5);
    expect(notFound.output.stderr).toContain('scout: not found: missing-symbol');

    const ambiguous = capture();
    expect(await main(['node', 'scout', 'show', 'login', '--root', suite], ambiguous.writers)).toBe(5);
    expect(ambiguous.output.stderr).toContain('scout: ambiguous: login');
  });

  it('returns usage code for invalid options', async () => {
    const output = capture();
    expect(await main(['node', 'scout', 'find', 'x', '--limit', '0'], output.writers)).toBe(2);
  });
});

describe('installSkillCommand', () => {
  it('copies the bundled skill into an agent path', async () => {
    const root = await tempRoot('scout-skill-');

    const output = await installSkillCommand({ root, target: 'agents', force: true });

    expect(output).toContain('installed:');
    const expectedFile = path.join(root, '.agents/skills/playwright-scout/SKILL.md');
    await expect(fs.access(expectedFile)).resolves.toBeUndefined();
    const text = await fs.readFile(expectedFile, 'utf8');
    expect(text).toContain('name: playwright-scout');
  });

  it('skips existing files unless forced', async () => {
    const root = await tempRoot('scout-skill-');
    const dir = path.join(root, '.agents/skills/playwright-scout');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    await fs.writeFile(file, 'existing');

    const output = await installSkillCommand({ root, target: 'agents' });

    expect(output).toContain('skipped (exists):');
    const text = await fs.readFile(file, 'utf8');
    expect(text).toBe('existing');
  });
});
