import { test as base } from '@playwright/test';

const impl = base.extend({
  account: async ({}, use) => {
    await use(1);
  },
});
export const test = impl;
