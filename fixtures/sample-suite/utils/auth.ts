import type { APIRequestContext } from '@playwright/test';
/** Creates a unique test user email. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}+${Date.now()}@example.com`;
}
export const loginViaApi = async (request: APIRequestContext, user: string) => {
  await request.post('/api/login', { data: { user } });
};