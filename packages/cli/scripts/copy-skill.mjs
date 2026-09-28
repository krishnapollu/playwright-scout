import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootSkillPath = path.resolve(__dirname, '../../../skills/playwright-scout/SKILL.md');
const destDir = path.resolve(__dirname, '../skills/playwright-scout');
const destSkillPath = path.resolve(destDir, 'SKILL.md');

await fs.mkdir(destDir, { recursive: true });
try {
  await fs.copyFile(rootSkillPath, destSkillPath);
} catch {
  // Ignore if it doesn't exist yet during scaffold
}
