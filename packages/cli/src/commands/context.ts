import { buildContext } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function contextCommand(index: Index, query: string, limit = 8) {
  return buildContext(index, query, { limit });
}
