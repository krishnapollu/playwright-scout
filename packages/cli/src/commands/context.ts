import { boundTaskBrief, buildTaskBrief } from 'playwright-scout-core';
import type { BusinessReference, Index } from 'playwright-scout-core';

export function contextCommand(
  index: Index,
  query: string,
  options: {
    limit?: number;
    maxChars?: number;
    staleIndex?: boolean;
    format?: 'text' | 'json';
    businessContext?: BusinessReference[];
    businessContextConfigured?: boolean;
  } = {},
) {
  const brief = buildTaskBrief(index, query, {
    limit: options.limit,
    staleIndex: options.staleIndex,
    businessContext: options.businessContext,
    businessContextConfigured: options.businessContextConfigured,
  });
  return boundTaskBrief(brief, options.maxChars ?? 1800, options.format ?? 'text');
}
