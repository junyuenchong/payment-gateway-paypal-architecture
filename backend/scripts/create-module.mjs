import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, 'src', 'modules');

/** ----- Exit process with error ----- **/
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/** ----- Convert text to kebab-case ----- **/
function toKebab(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/** ----- Convert text to PascalCase ----- **/
function toPascal(input) {
  return String(input)
    .trim()
    .replace(/[_\- ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** ----- Build short banner comment ----- **/
function comment(title, indent = '') {
  const t = String(title).trim().replace(/\s+/g, ' ') || 'Comment';
  return `${indent}/** ----- ${t} ----- **/\n`;
}

/** ----- Ensure directory exists ----- **/
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/** ----- Write file if not exists ----- **/
function writeFileSafe(filePath, content) {
  if (fs.existsSync(filePath)) die(`File already exists: ${filePath}`);
  fs.writeFileSync(filePath, content, 'utf8');
}

/** ----- Generate module scaffold files ----- **/
function main() {
  const rawName = process.argv[2];
  if (!rawName) {
    die(
      [
        'Usage:',
        '  node scripts/create-module.mjs <module-name>',
        '',
        'Example:',
        '  node scripts/create-module.mjs payment-gateway',
      ].join('\n'),
    );
  }

  if (!fs.existsSync(MODULES_DIR)) die(`Missing modules dir: ${MODULES_DIR}`);

  const name = toKebab(rawName);
  const classBase = toPascal(name);
  const moduleDir = path.join(MODULES_DIR, name);

  if (fs.existsSync(moduleDir)) die(`Module already exists: ${moduleDir}`);

  /** ----- Create module folders ----- **/
  ensureDir(path.join(moduleDir, 'dto'));
  ensureDir(path.join(moduleDir, 'enums'));
  ensureDir(path.join(moduleDir, 'helpers'));
  ensureDir(path.join(moduleDir, 'cqrs', 'commands'));
  ensureDir(path.join(moduleDir, 'cqrs', 'queries'));
  ensureDir(path.join(moduleDir, 'cqrs', 'handlers'));

  /** ----- Create module files ----- **/
  writeFileSafe(
    path.join(moduleDir, `${name}.constant.ts`),
    comment(`Define ${name} constants.`) +
      `export const ${classBase}Constant = {} as const;\n`,
  );

  writeFileSafe(
    path.join(moduleDir, `${name}.service.ts`),
    `import { Injectable } from '@nestjs/common';\n\n` +
      comment(`Handle ${name} service.`) +
      `@Injectable()\n` +
      `export class ${classBase}Service {}\n`,
  );

  writeFileSafe(
    path.join(moduleDir, `${name}.controller.ts`),
    `import { Controller, Get } from '@nestjs/common';\n\n` +
      comment(`Handle ${name} module endpoints.`) +
      `@Controller('internal/${name}')\n` +
      `export class ${classBase}Controller {\n` +
      `  ${comment(`Get ${name} module status.`, '  ').trimEnd()}\n` +
      `  @Get('status')\n` +
      `  getStatus() {\n` +
      `    return { ok: true, module: '${name}' } as const;\n` +
      `  }\n` +
      `}\n`,
  );

  writeFileSafe(
    path.join(moduleDir, 'cqrs', 'commands', `${name}.command.ts`),
    `export class ${classBase}Command {\n` +
      `  ${comment(`${classBase} command payload`, '  ').trimEnd()}\n` +
      `  constructor() {}\n` +
      `}\n`,
  );

  writeFileSafe(
    path.join(moduleDir, 'cqrs', 'handlers', `${name}.handler.ts`),
    `import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';\n\n` +
      `import { ${classBase}Service } from '../../${name}.service';\n` +
      `import { ${classBase}Command } from '../commands/${name}.command';\n\n` +
      comment(`Handle ${name} command.`) +
      `@CommandHandler(${classBase}Command)\n` +
      `export class ${classBase}Handler implements ICommandHandler<${classBase}Command> {\n` +
      `  constructor(private readonly service: ${classBase}Service) {}\n\n` +
      `  async execute(command: ${classBase}Command): Promise<void> {\n` +
      `    void command;\n` +
      `    void this.service;\n` +
      `  }\n` +
      `}\n`,
  );

  writeFileSafe(
    path.join(moduleDir, 'cqrs', 'index.ts'),
    `import { ${classBase}Handler } from './handlers/${name}.handler';\n\n` +
      `export const CommandHandlers = [${classBase}Handler];\n` +
      `export const QueryHandlers: never[] = [];\n` +
      `export const EventHandlers: never[] = [];\n`,
  );

  writeFileSafe(
    path.join(moduleDir, `${name}.module.ts`),
    `import { Module } from '@nestjs/common';\n` +
      `import { CqrsModule } from '@nestjs/cqrs';\n\n` +
      `import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';\n` +
      `import { ${classBase}Controller } from './${name}.controller';\n` +
      `import { ${classBase}Service } from './${name}.service';\n\n` +
      comment(`Configure ${name} module.`) +
      `@Module({\n` +
      `  imports: [CqrsModule],\n` +
      `  controllers: [${classBase}Controller],\n` +
      `  providers: [${classBase}Service, ...EventHandlers, ...CommandHandlers, ...QueryHandlers],\n` +
      `  exports: [${classBase}Service],\n` +
      `})\n` +
      `export class ${classBase}Module {}\n`,
  );

  console.log(`Created module: src/modules/${name}`);
}

/** ----- Run module generator ----- **/
main();
