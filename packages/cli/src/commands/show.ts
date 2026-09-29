import { resolveEntry } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function showCommand(index: Index, id: string) {
  return resolveEntry(index, id);
}
