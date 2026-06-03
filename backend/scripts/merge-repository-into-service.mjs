import fs from 'node:fs';
import path from 'node:path';

const [servicePath, repoPath] = process.argv.slice(2);
if (!servicePath || !repoPath) {
  console.error('Usage: node merge-repository-into-service.mjs <service.ts> <repository.ts>');
  process.exit(1);
}

const service = fs.readFileSync(servicePath, 'utf8');
const repo = fs.readFileSync(repoPath, 'utf8');

const repoImportMatch = repo.match(/^([\s\S]*?)@Injectable\(\)/);
const repoClassMatch = repo.match(
  /export class \w+Repository \{[\s\S]*?constructor\([^\)]*\) \{[^\}]*\}\s*([\s\S]*)\n\}/,
);

if (!repoClassMatch) {
  console.error('Could not parse repository class body:', repoPath);
  process.exit(1);
}

const repoImports = (repoImportMatch?.[1] ?? '')
  .split('\n')
  .filter((line) => line.startsWith('import '));

let merged = service;
for (const imp of repoImports) {
  if (!merged.includes(imp)) {
    const idx = merged.lastIndexOf('\nimport ');
    const end = merged.indexOf('\n', merged.indexOf(';', idx));
    merged = `${merged.slice(0, end + 1)}${imp}\n${merged.slice(end + 1)}`;
  }
}

merged = merged.replace(/import \{ \w+Repository \} from '[^']+';\n/g, '');
merged = merged.replace(
  /private readonly repository: \w+Repository,?\n?\s*/g,
  '',
);
const repoCtorMatch = repo.match(/constructor\(([^)]*)\)/);
const ctorParam = repoCtorMatch?.[1]?.trim();
if (ctorParam && !merged.includes(ctorParam.split(':')[0].trim())) {
  merged = merged.replace(
    /constructor\(\s*\n/,
    `constructor(\n    ${ctorParam},\n`,
  );
}

merged = merged.replace(/this\.repository\./g, 'this.');

const repoBody = repoClassMatch[1];
const insertAt = merged.lastIndexOf('\n}');
merged = `${merged.slice(0, insertAt)}\n${repoBody}${merged.slice(insertAt)}`;

fs.writeFileSync(servicePath, merged);
console.log(`Merged ${path.basename(repoPath)} -> ${path.basename(servicePath)}`);
