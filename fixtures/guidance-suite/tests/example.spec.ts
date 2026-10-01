import { expect, test } from '@playwright/test';

test('guidance examples', async ({ page }) => {
  await page.waitForTimeout(1000);
  expect(await page.getByRole('button', { name: 'Save' }).isVisible()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible();
});

const unrelated = { waitForTimeout: async (_ms: number) => undefined };
void unrelated.waitForTimeout(1000);
