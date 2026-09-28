import type { Page } from '@playwright/test';
/** Waits until the network is idle. */
export async function waitForIdle(page: Page) { await page.waitForLoadState('networkidle'); }