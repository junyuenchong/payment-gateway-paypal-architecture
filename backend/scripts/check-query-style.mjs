import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const TARGET_EXT = new Set(['.ts']);

/** ----- Walk directory recursively ----- **/
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (TARGET_EXT.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

/** ----- Convert offset to line number ----- **/
function lineNumberFromOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

/** ----- Check query style rules ----- **/
function main() {
  if (!fs.existsSync(MODULES_DIR)) {
    console.error('Missing modules directory.');
    process.exit(1);
  }

  const files = walk(MODULES_DIR);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const pattern = /\bselect\s*:/g;
    const matches = content.matchAll(pattern);

    for (const match of matches) {
      const offset = match.index ?? 0;
      violations.push({
        filePath,
        line: lineNumberFromOffset(content, offset),
      });
    }
  }

  if (violations.length === 0) {
    console.log('Query style check passed.');
    return;
  }

  console.error('Query style check failed. Do not use select:');
  console.error('Use relation include/join patterns instead.');
  console.error('');

  for (const item of violations) {
    const relative = path.relative(ROOT, item.filePath);
    console.error(`- ${relative}:${item.line}`);
  }

  process.exit(1);
}

/** ----- Run query style checker ----- **/
main();

