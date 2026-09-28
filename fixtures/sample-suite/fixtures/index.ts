import { test as base, expect } from '@playwright/test';
import { LoginPage, CheckoutPage } from '@pages/index';
type Fx = { loginPage: LoginPage; checkoutPage: CheckoutPage; adminToken: string };
export const test = base.extend<Fx>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  checkoutPage: async ({ page }, use) => { await use(new CheckoutPage(page)); },
  adminToken: [async ({}, use) => { await use('t'); }, { scope: 'worker', auto: true }],
});
export { expect };