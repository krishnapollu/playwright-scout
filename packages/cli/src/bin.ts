import { createProgram } from './program.js';

export const cli = true;

export async function main(): Promise<number> {
  const program = createProgram();
  await program.parseAsync(process.argv);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
