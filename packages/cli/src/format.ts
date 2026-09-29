export function formatSummary(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}
