# playwright-scout-core

Static indexer and query library for Playwright test projects. It parses source without running tests or evaluating project code.

```ts
import { buildIndex, searchIndex } from 'playwright-scout-core';

const index = await buildIndex({ root: process.cwd(), deterministic: true });
const results = searchIndex(index, 'login', { limit: 10 });
```

Node.js 20 or newer and TypeScript 5 or newer are required. See the [project README](https://github.com/krishnapollu/playwright-scout#playwright-scout) for CLI usage and known limitations.
