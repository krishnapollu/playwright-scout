import fs from 'node:fs/promises';
import path from 'node:path';
import { IndexSchema, SCHEMA_VERSION, type Index } from './schema.js';
import { ScoutError } from './errors.js';

export async function writeIndex(rootDir: string, index: Index): Promise<void> {
  const scoutDir = path.join(rootDir, '.scout');
  await fs.mkdir(scoutDir, { recursive: true });

  const gitignorePath = path.join(scoutDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, '*\n', 'utf8');
  }

  const indexPath = path.join(scoutDir, 'index.json');
  // Serializing keys in deterministic order if necessary, but JSON.stringify
  // keeps insertion order which should be as specified.
  const json = JSON.stringify(index, null, 2) + '\n';
  await fs.writeFile(indexPath, json, 'utf8');
}

export async function readIndex(rootDir: string): Promise<Index> {
  const indexPath = path.join(rootDir, '.scout', 'index.json');
  let content: string;
  try {
    content = await fs.readFile(indexPath, 'utf8');
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ScoutError('INDEX_MISSING');
    }
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ScoutError('INDEX_INVALID');
  }

  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed) {
    if ((parsed as { schemaVersion: unknown }).schemaVersion !== SCHEMA_VERSION) {
      throw new ScoutError('INDEX_SCHEMA_MISMATCH');
    }
  } else {
    throw new ScoutError('INDEX_INVALID');
  }

  const result = IndexSchema.safeParse(parsed);
  if (!result.success) {
    throw new ScoutError('INDEX_INVALID');
  }

  return result.data;
}
