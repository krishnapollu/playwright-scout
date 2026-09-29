import { buildIndex, writeIndex } from 'playwright-scout-core';

export async function mapCommand(root: string, options: { json?: boolean; quiet?: boolean } = {}) {
  const index = await buildIndex({ root, deterministic: !!options.quiet });
  await writeIndex(root, index);
  const output = {
    specFiles: index.stats.specFiles,
    tests: index.stats.tests,
    helpers: index.stats.helpers,
    indexPath: `${root}/.scout/index.json`,
  };
  if (options.json) {
    return JSON.stringify(output);
  }
  return `scout: indexed ${index.stats.specFiles} spec files, ${index.stats.tests} tests, ${index.stats.helpers} helpers`;
}
