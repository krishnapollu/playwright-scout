import { buildPlan } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function planCommand(index: Index, query: string, limit = 8) {
  return buildPlan(index, query, limit);
}
