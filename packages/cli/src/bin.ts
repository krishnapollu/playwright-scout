#!/usr/bin/env node
import { main } from './program.js';

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
