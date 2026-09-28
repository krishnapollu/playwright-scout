import { expect, test } from 'vitest';
import { cli } from '../src/bin.js';

test('cli is true', () => {
  expect(cli).toBe(true);
});
