import { boundTaskBrief, buildTaskBrief } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function contextCommand(index: Index, query: string, options: { limit?: number; maxChars?: number; staleIndex?: boolean; format?: 'text' | 'json' } = {}) {
  const brief = buildTaskBrief(index, query, { limit: options.limit, staleIndex: options.staleIndex });
  return boundTaskBrief(brief, options.maxChars ?? 1800, options.format ?? 'text');
}
