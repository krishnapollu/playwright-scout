import { randomInt, createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';

const IGNORED = new Set(['node_modules', '.agents', '.scout', '.git', '.logbook', 'playwright-report', 'test-results']);

function childEnv() {
  const allowed = ['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'CODEX_HOME'];
  const env = {};
  for (const name of allowed) if (process.env[name]) env[name] = process.env[name];
  return env;
}

async function sourceHashes(root, relative = '') {
  const hashes = {};
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    if (IGNORED.has(name)) continue;
    const item = path.join(relative, name);
    const full = path.join(root, item);
    const info = await lstat(full);
    if (info.isDirectory()) Object.assign(hashes, await sourceHashes(root, item));
    else if (info.isFile()) hashes[item.split(path.sep).join('/')] = createHash('sha256').update(await readFile(full)).digest('hex');
  }
  return hashes;
}

function usageFromJsonl(jsonl) {
  const usage = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
  let completedTurns = 0;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type !== 'turn.completed' || !event.usage) continue;
    completedTurns++;
    for (const key of Object.keys(usage)) {
      const value = event.usage[key];
      if (typeof value === 'number' && Number.isFinite(value)) usage[key] += value;
    }
  }
  return { ...usage, completed_turns: completedTurns, measured: completedTurns > 0 };
}

async function runArm({ codex, arm, directory, model, timeoutMs, prompt, outputRoot, original }) {
  const stdoutPath = path.join(outputRoot, `${arm}.jsonl`);
  const stderrPath = path.join(outputRoot, `${arm}.stderr.log`);
  const out = createWriteStream(stdoutPath);
  const err = createWriteStream(stderrPath);
  const started = performance.now();
  const child = spawn(codex, ['exec', '--json', '--full-auto', '-m', model, '-C', directory, '-'], {
    cwd: directory,
    env: childEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  child.stdin.end(prompt);
  let timedOut = false;
  let forceTimer;
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    forceTimer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
    }, 5_000);
  }, timeoutMs);
  const exit = await new Promise((resolve) => {
    child.on('error', (error) => resolve({ error: error.message }));
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  if (forceTimer) clearTimeout(forceTimer);
  await Promise.all([finished(out), finished(err)]);
  const modelElapsedMs = Math.round(performance.now() - started);
  const usage = usageFromJsonl(await readFile(stdoutPath, 'utf8'));
  const check = spawnSync('npx', ['--no-install', 'tsc', '--noEmit'], {
    cwd: directory,
    env: childEnv(),
    encoding: 'utf8',
    timeout: 60_000,
  });
  const final = await sourceHashes(directory);
  const changedFiles = Object.keys({ ...original, ...final }).filter((file) => original[file] !== final[file]).sort();
  return {
    arm,
    exit,
    timed_out: timedOut,
    elapsed_ms: modelElapsedMs,
    usage,
    typecheck_pass: check.status === 0,
    typecheck_exit: check.status,
    changed_files: changedFiles,
    diff_fingerprint: createHash('sha256').update(JSON.stringify(changedFiles.map((file) => [file, final[file] ?? null]))).digest('hex'),
    raw_logs: [stdoutPath, stderrPath],
  };
}

async function main() {
  const [rootArg, model, maxMinutesArg] = process.argv.slice(2);
  const maxMinutes = Number(maxMinutesArg);
  if (!rootArg || !model || !Number.isFinite(maxMinutes) || maxMinutes <= 0 || maxMinutes > 10 || process.argv.length !== 5) {
    throw new Error('Usage: node bench/run-codex-pilot.mjs <prepared-temp-root> <model> <minutes-per-arm: 0-10>');
  }
  const root = await realpath(rootArg);
  const temp = await realpath(os.tmpdir());
  if (!root.startsWith(`${temp}${path.sep}`) || !path.basename(root).startsWith('scout-codex-pilot-')) {
    throw new Error('Refusing to run outside a prepared temporary pilot directory');
  }
  const codex = spawnSync('which', ['codex'], { encoding: 'utf8' }).stdout.trim();
  if (!codex) throw new Error('Codex CLI not found on PATH');
  const manifest = JSON.parse(await readFile(path.join(root, 'source-manifest.json'), 'utf8'));
  const prompt = await readFile(path.join(root, 'task.txt'), 'utf8');
  if (!prompt.trim()) throw new Error('Empty task prompt');
  for (const arm of ['control', 'scout']) {
    const baseline = await sourceHashes(path.join(root, arm));
    if (JSON.stringify(baseline) !== JSON.stringify(manifest.files)) throw new Error(`${arm} source has drifted before agent run`);
  }
  const order = randomInt(2) === 0 ? ['control', 'scout'] : ['scout', 'control'];
  const resultsPath = path.join(root, 'pilot-summary.json');
  const summary = { model, codex, order, minutes_per_arm: maxMinutes, results: [] };
  await writeFile(resultsPath, `${JSON.stringify(summary, null, 2)}\n`);
  for (const arm of order) {
    const result = await runArm({ codex, arm, directory: path.join(root, arm), model, timeoutMs: maxMinutes * 60_000, prompt, outputRoot: root, original: manifest.files });
    summary.results.push(result);
    await writeFile(resultsPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${resultsPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
