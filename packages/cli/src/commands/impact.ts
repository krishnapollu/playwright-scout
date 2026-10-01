import { getImpact } from 'playwright-scout-core';
import type { Index } from 'playwright-scout-core';

export function impactCommand(index: Index, id: string) {
  return getImpact(index, id);
}
