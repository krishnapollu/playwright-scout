import type { Page } from '@playwright/test';
export default class CheckoutPage {
  constructor(readonly page: Page) {}
  async open() { await this.page.goto('/checkout'); }
  async applyCoupon(code: string) { await this.page.getByPlaceholder('Coupon').fill(code); }
}