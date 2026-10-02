import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, copyFile, lstat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Deliberately allowlist source. Never copy .env, node_modules, run artifacts,
// reports, browser profiles, or arbitrary files added to the live project.
const SOURCE_PATHS = [
  '.gitignore',
  'README.md',
  'data/testdata.ts',
  'fixtures/index.ts',
  'helpers/AuthHelper.ts',
  'helpers/DataHelper.ts',
  'package-lock.json',
  'package.json',
  'pages/BasePage.ts',
  'pages/CartPage.ts',
  'pages/HomePage.ts',
  'pages/LoginPage.ts',
  'pages/ProductsPage.ts',
  'playwright.config.ts',
  'scripts/run-tests.cjs',
  'tests/auth/web.spec.ts',
  'tests/cart/web.spec.ts',
  'tests/products/api-web.spec.ts',
  'tests/products/api.spec.ts',
  'tests/products/web.spec.ts',
  'tsconfig.json',
  'vendor/playwright-logbook-0.2.0.tgz',
];

async function copyAllowed(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Symlink not allowed: ${source}`);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of (await readdir(source)).sort()) {
      if (entry.startsWith('.'))
        throw new Error(`Hidden file not allowlisted: ${path.join(source, entry)}`);
      await copyAllowed(path.join(source, entry), path.join(destination, entry));
    }
  } else if (info.isFile()) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  } else {
    throw new Error(`Unsupported file type: ${source}`);
  }
}

async function fileHashes(root, relative = '') {
  const result = {};
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const item = path.join(relative, name);
    const absolute = path.join(root, item);
    const info = await lstat(absolute);
    if (info.isDirectory()) Object.assign(result, await fileHashes(root, item));
    else if (info.isFile())
      result[item.split(path.sep).join('/')] = createHash('sha256')
        .update(await readFile(absolute))
        .digest('hex');
    else throw new Error(`Unsupported file type: ${absolute}`);
  }
  return result;
}

async function main() {
  const sourceRoot = process.argv[2];
  if (!sourceRoot || process.argv.length !== 3) {
    throw new Error('Usage: node bench/prepare-pw-test.mjs /absolute/path/to/pw-test');
  }
  if (!path.isAbsolute(sourceRoot)) throw new Error('Source path must be absolute');

  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'scout-codex-pilot-'));
  for (const arm of ['control', 'scout']) {
    const destination = path.join(outputRoot, arm);
    await mkdir(destination);
    for (const item of SOURCE_PATHS) {
      await copyAllowed(path.join(sourceRoot, item), path.join(destination, item));
    }
  }

  const control = await fileHashes(path.join(outputRoot, 'control'));
  const scout = await fileHashes(path.join(outputRoot, 'scout'));
  if (JSON.stringify(control) !== JSON.stringify(scout)) throw new Error('Arm snapshots differ');
  const manifest = { source: sourceRoot, files: control };
  await writeFile(
    path.join(outputRoot, 'source-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(`${outputRoot}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
