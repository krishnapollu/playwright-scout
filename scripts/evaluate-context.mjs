import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildContext,
  buildIndex,
  buildTaskBrief,
  boundTaskBrief,
  getFileImpact,
} from 'playwright-scout-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/sample-suite');
const index = await buildIndex({ root, deterministic: true });

const tasks = [
  {
    name: 'reuse POM method',
    query: 'coupon checkout',
    reuse: 'CheckoutPage.applyCoupon',
    analogous: 'tests/checkout.spec.ts',
  },
  {
    name: 'author through fixture',
    query: 'login',
    reuse: 'LoginPage.login',
    analogous: 'tests/login.spec.ts',
  },
  {
    name: 'modify helper',
    query: 'unique email',
    reuse: 'uniqueEmail',
    impactFile: 'utils/auth.ts',
    affected: 'tests/login.spec.ts',
  },
  {
    name: 'modify fixture',
    query: 'loginPage',
    impactFile: 'fixtures/index.ts',
    affected: 'tests/login.spec.ts',
  },
  {
    name: 'assess source impact',
    query: 'checkout',
    impactFile: 'pages/checkout.page.ts',
    affected: 'tests/checkout.spec.ts',
  },
];

let failed = false;
for (const task of tasks) {
  const before = performance.now();
  const baseline = JSON.stringify(buildContext(index, task.query));
  const output = boundTaskBrief(buildTaskBrief(index, task.query), 6000, 'json');
  const milliseconds = Number((performance.now() - before).toFixed(2));
  const impact = task.impactFile ? getFileImpact(index, task.impactFile) : null;
  const reuseFound = task.reuse
    ? output.brief.reuse.some((item) => item.id.endsWith(task.reuse))
    : null;
  const analogousFound = task.analogous
    ? output.brief.analogousTest?.file === task.analogous
    : null;
  const impactFound = task.affected
    ? impact?.knownAffectedTests.some((test) => test.file === task.affected)
    : null;
  const pass = [reuseFound, analogousFound, impactFound].every((value) => value !== false);
  if (!pass) failed = true;
  process.stdout.write(
    `${JSON.stringify({
      task: task.name,
      query: task.query,
      pass,
      baselineChars: baseline.length,
      briefChars: output.output.length,
      roughTokenEstimate: Math.ceil(Buffer.byteLength(output.output, 'utf8') / 4),
      reuseFound,
      analogousFound,
      impactFound,
      milliseconds,
    })}\n`,
  );
}
if (failed) process.exitCode = 1;
