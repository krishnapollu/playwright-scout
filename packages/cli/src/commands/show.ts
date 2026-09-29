import { showEntry } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function showCommand(index: Index, id: string) {
  return showEntry(index, id);
}
