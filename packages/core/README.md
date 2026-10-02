# playwright-scout-core

Static indexer and query library for Playwright test projects. It parses source without running tests or evaluating project code.

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: process.cwd(), deterministic: true });
const results = searchIndex(index, 'login', { limit: 10 });
```

Node.js 20 or newer is required. Core installs its own TypeScript 5 compiler API dependency for static analysis, independently of the project's TypeScript compiler version. See the [project README](https://github.com/krishnapollu/playwright-scout#playwright-scout) for CLI usage and known limitations.
