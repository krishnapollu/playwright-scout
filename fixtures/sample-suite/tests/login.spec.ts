import { test, expect } from '../fixtures/index';
import { USERS } from '../utils/data';
import { uniqueEmail } from '@utils/auth';

test.describe('Login', { tag: '@auth' }, () => {
  test('logs in with valid credentials @smoke', async ({ loginPage, page }) => {
    await loginPage.login(USERS.admin.name, USERS.admin.pass);
    await expect(page).toHaveURL('/home');
  });
  test.skip('shows error for bad password', async ({ loginPage }) => {
    await loginPage.errorText();
  });
  test('registers new user', { tag: ['@auth', '@regression'] }, async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(uniqueEmail());
  });
});

for (const role of ['admin', 'guest']) {
  test(`dashboard for ${role}`, async ({ page }) => {
    await page.goto(`/dashboard`);
  });
}
