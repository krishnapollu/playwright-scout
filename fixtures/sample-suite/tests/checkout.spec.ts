import { test } from '../fixtures/index';
import { CheckoutPage } from '@pages/index';
import { COUPON_CODE } from '../utils/data';
import * as auth from '../utils/auth.js';

test.describe.serial('Checkout', () => {
  test('applies coupon', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.open();
    await checkout.applyCoupon(COUPON_CODE);
    await auth.loginViaApi(page.request, 'x');
  });
  test.fixme('pays with saved card', async ({ page }) => {});
});