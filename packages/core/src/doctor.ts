import fs from 'node:fs';
import path from 'node:path';
import { readConfig } from './config.js';
import { ScoutError } from './errors.js';

export interface GuidanceFinding {
  ruleId: string;
  suggestion: string;
  file: string;
  line: number;
  guideUrl: string;
}

export interface DoctorResult {
  command: 'doctor';
  findings: GuidanceFinding[];
  unknowns: string[];
}

export function doctor(root: string): DoctorResult {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new ScoutError('USAGE', 'root must be an existing directory');
  }
  const config = readConfig(resolvedRoot);
  const findings: GuidanceFinding[] = [];
  const unknowns: string[] = [];
  if (!config.configFile) {
    unknowns.push('No Playwright config found; Playwright defaults or another config may apply.');
  } else if (config.testDirLine !== null && !config.testDirLiteral) {
    unknowns.push('Some Playwright config values could not be determined statically.');
  } else if (config.testDirLiteral && config.testDirLine !== null) {
    const target = path.resolve(resolvedRoot, config.testDir);
    const relative = path.relative(resolvedRoot, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      unknowns.push('The configured testDir is outside the project root; Scout did not inspect it.');
    } else {
      try {
        if (!fs.statSync(target).isDirectory()) {
          findings.push({
            ruleId: 'config.test-dir-missing',
            suggestion: 'The configured testDir is not a directory. Check whether it is generated or whether the path should be updated.',
            file: config.configFile,
            line: config.testDirLine,
            guideUrl: 'https://playwright.dev/docs/test-configuration',
          });
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          findings.push({
            ruleId: 'config.test-dir-missing',
            suggestion: 'The configured testDir does not exist. Check whether it is generated or whether the path should be updated.',
            file: config.configFile,
            line: config.testDirLine,
            guideUrl: 'https://playwright.dev/docs/test-configuration',
          });
        } else {
          unknowns.push('The configured testDir could not be inspected.');
        }
      }
    }
  }
  if (config.configFile && config.testDirLine === null && config.diagnostics.some((item) => item.code === 'CONFIG_DYNAMIC')) {
    unknowns.push('Some Playwright config values could not be determined statically.');
  }
  return { command: 'doctor', findings, unknowns };
}
