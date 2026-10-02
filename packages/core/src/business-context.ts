import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ScoutError } from './errors.js';
import { tokenize } from './search.js';

const entrySchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  kind: z.enum(['journey', 'term', 'rule', 'risk']),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  keywords: z.array(z.string().min(1).max(60)).max(12).optional(),
}).strict();
const fileSchema = z.object({ version: z.literal(1), entries: z.array(entrySchema).max(100) }).strict();

export interface BusinessReference {
  id: string;
  kind: 'journey' | 'term' | 'rule' | 'risk';
  title: string;
  summary: string;
  source: string;
  line: number;
}

const ignoredName = /^(\.|node_modules$|dist$|build$|out$|coverage$|test-results$|playwright-report$)|secret|credential|token|\.env/i;
const maxFiles = 64;
const maxFileBytes = 64 * 1024;
const maxTotalBytes = 512 * 1024;

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export async function readBusinessContext(root: string, selected: string, query: string, allowExternal = false): Promise<BusinessReference[]> {
  if (!selected || selected.split(/[\\/]/).some((part) => part === '..' || ignoredName.test(part))) {
    throw new ScoutError('USAGE', 'business context path contains a disallowed component');
  }
  const realRoot = await fs.realpath(root).catch(() => { throw new ScoutError('USAGE', 'project root does not exist'); });
  const target = path.resolve(realRoot, selected);
  if (!inside(realRoot, target) && !allowExternal) {
    throw new ScoutError('USAGE', 'business context outside the project requires --allow-external-business-context');
  }
  const realTarget = await fs.realpath(target).catch(() => { throw new ScoutError('USAGE', 'business context path does not exist'); });
  if (!inside(realRoot, realTarget) && !allowExternal) {
    throw new ScoutError('USAGE', 'business context symlink escapes the project root');
  }
  const files: string[] = [];
  async function visit(current: string, depth: number): Promise<void> {
    if (depth > 8 || files.length > maxFiles) throw new ScoutError('USAGE', 'business context tree exceeds traversal limit');
    const info = await fs.lstat(current).catch(() => { throw new ScoutError('USAGE', `business context path does not exist: ${current}`); });
    if (info.isSymbolicLink()) throw new ScoutError('USAGE', 'business context symlinks are not allowed');
    if (info.isFile()) {
      if (!current.endsWith('.json')) {
        if (depth === 0) throw new ScoutError('USAGE', 'business context files must be JSON');
        return;
      }
      if (info.size > maxFileBytes) throw new ScoutError('USAGE', 'business context file exceeds 64 KiB');
      files.push(current);
      return;
    }
    if (!info.isDirectory()) throw new ScoutError('USAGE', 'business context path must be a file or directory');
    const names = (await fs.readdir(current)).sort();
    for (const name of names) {
      if (ignoredName.test(name)) continue;
      await visit(path.join(current, name), depth + 1);
    }
  }
  await visit(target, 0);
  if (files.length > maxFiles) throw new ScoutError('USAGE', 'business context tree exceeds 64 files');
  const queryTokens = tokenize(query);
  const results: BusinessReference[] = [];
  let totalBytes = 0;
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    totalBytes += Buffer.byteLength(raw);
    if (totalBytes > maxTotalBytes) throw new ScoutError('USAGE', 'business context tree exceeds 512 KiB');
    let value: unknown;
    try { value = JSON.parse(raw) as unknown; }
    catch { throw new ScoutError('USAGE', `invalid business context JSON file: ${file}`); }
    const parsed = fileSchema.safeParse(value);
    if (!parsed.success) throw new ScoutError('USAGE', `invalid business context v1 file: ${file}`);
    if (new Set(parsed.data.entries.map((entry) => entry.id)).size !== parsed.data.entries.length) {
      throw new ScoutError('USAGE', `duplicate business context ID: ${file}`);
    }
    const source = path.relative(realRoot, file).split(path.sep).join('/');
    const lines = raw.split(/\r?\n/);
    for (const entry of parsed.data.entries) {
      const terms = new Set(tokenize([entry.title, ...(entry.keywords ?? [])].join(' ')));
      if (!queryTokens.some((token) => terms.has(token))) continue;
      const found = lines.findIndex((line) => line.includes(JSON.stringify(entry.id)));
      results.push({ id: entry.id, kind: entry.kind, title: entry.title, summary: entry.summary,
        source, line: Math.max(1, found + 1) });
    }
  }
  return results.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : a.line - b.line || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
