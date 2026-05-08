import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const TARGET_EXT = new Set(['.ts', '.mjs']);

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

/** ----- Detect descriptive JSDoc block ----- **/
function isDescriptiveJSDoc(block) {
  return !/^\s*\*\s*@\w+/m.test(block);
}

/** ----- Validate short banner style ----- **/
function isShortBannerStyle(block) {
  const normalized = block.replace(/\r/g, '').trim();
  return /^\/\*\*\s*-{2,}\s+.+\s+-{2,}\s+\*+\/$/.test(normalized);
}

/** ----- Calculate line from text offset ----- **/
function lineNumberFromOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

/** ----- Check service file has banner comment ----- **/
function hasShortBannerComment(content) {
  return /\/\*\*\s*-{2,}\s+.+\s+-{2,}\s+\*+\/\s*/.test(content);
}

/** ----- Check file requires banner comment ----- **/
function requiresBannerComment(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('.service.ts')) return true;
  if (normalized.endsWith('.controller.ts')) return true;
  if (normalized.endsWith('.repository.ts')) return true;
  if (normalized.endsWith('.module.ts')) return true;
  if (/\/application\/commands\/.+\.ts$/.test(normalized)) return true;
  if (/\/application\/handlers\/.+\.ts$/.test(normalized)) return true;
  return false;
}

/** ----- Check line is short banner comment ----- **/
function isBannerLine(line) {
  const trimmed = line.trim();
  return /^\/\*\*\s*-{2,}\s+.+\s+-{2,}\s+\*+\/$/.test(trimmed);
}

/** ----- Check comment exists before declaration ----- **/
function hasBannerBefore(lines, lineIdx) {
  const start = Math.max(0, lineIdx - 30);
  for (let i = lineIdx - 1; i >= start; i -= 1) {
    if (isBannerLine(lines[i])) return true;
  }
  return false;
}

/** ----- Collect missing coverage comment violations ----- **/
function collectCoverageViolations(filePath, content) {
  if (!requiresBannerComment(filePath)) return [];

  const lines = content.split(/\r?\n/);
  const violations = [];
  const classPattern = /^\s*export\s+class\s+([A-Za-z_]\w*)/;
  const methodPattern =
    /^\s*(public|private|protected)?\s*(async\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*[:{]/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (classPattern.test(line) && !hasBannerBefore(lines, i)) {
      violations.push({ filePath, line: i + 1 });
      continue;
    }

    const methodMatch = line.match(methodPattern);
    if (!methodMatch) continue;

    const methodName = methodMatch[3];
    if (methodName === 'if' || methodName === 'for' || methodName === 'while') {
      continue;
    }
    if (!hasBannerBefore(lines, i)) {
      violations.push({ filePath, line: i + 1 });
    }
  }

  return violations;
}

/** ----- Check comment style in source files ----- **/
function main() {
  if (!fs.existsSync(SRC_DIR) && !fs.existsSync(SCRIPTS_DIR)) {
    console.error('Missing scan directories.');
    process.exit(1);
  }

  const files = [
    ...(fs.existsSync(SRC_DIR) ? walk(SRC_DIR) : []),
    ...(fs.existsSync(SCRIPTS_DIR) ? walk(SCRIPTS_DIR) : []),
  ];
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.matchAll(jsdocPattern);
    for (const match of matches) {
      const block = match[0];
      if (!isDescriptiveJSDoc(block)) continue;
      if (isShortBannerStyle(block)) continue;

      const offset = match.index ?? 0;
      violations.push({
        filePath,
        line: lineNumberFromOffset(content, offset),
      });
    }

    if (requiresBannerComment(filePath) && !hasShortBannerComment(content)) {
      violations.push({
        filePath,
        line: 1,
      });
    }

    violations.push(...collectCoverageViolations(filePath, content));
  }

  if (violations.length === 0) {
    console.log('Comment style check passed.');
    return;
  }

  console.error('Comment style check failed. Use short banner JSDoc format:');
  console.error('/** ----- Your title ----- **/');
  console.error('');

  for (const item of violations) {
    const relative = path.relative(ROOT, item.filePath);
    console.error(`- ${relative}:${item.line}`);
  }

  process.exit(1);
}

/** ----- Run comment style checker ----- **/
main();
