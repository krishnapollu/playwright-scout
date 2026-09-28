import { test } from '@playwright/test';
import { uniqueEmail } from '../utils/auth.js';
test('legacy signup', async ({ page }) => {
  await page.goto('/signup');
  uniqueEmail('legacy');
});