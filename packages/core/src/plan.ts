import type { Index } from './schema.js';
import { buildContext, type ContextResult } from './context.js';

export interface PlanResult {
  query: string;
  context: ContextResult;
  recommendations: string[];
}

/** Builds an evidence-based reuse plan for an agent task. */
export function buildPlan(index: Index, query: string, limit = 8): PlanResult {
  const context = buildContext(index, query, { limit });
  const recommendations: string[] = [];
  if (context.relatedHelpers.length > 0) recommendations.push(`Reuse existing helpers: ${context.relatedHelpers.join(', ')}`);
  if (context.fixtures.length > 0) recommendations.push(`Consider existing fixtures: ${context.fixtures.join(', ')}`);
  if (context.relatedSpecs.length > 0) recommendations.push(`Review related specs: ${context.relatedSpecs.join(', ')}`);
  if (recommendations.length === 0) recommendations.push('No matching indexed code was found; inspect the project normally before creating new helpers.');
  return { query, context, recommendations };
}
