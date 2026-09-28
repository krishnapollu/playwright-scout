import { expect, test } from 'vitest';
import { SCHEMA_VERSION } from '../src/index.js';

test('SCHEMA_VERSION is 1', () => {
  expect(SCHEMA_VERSION).toBe(1);
});
