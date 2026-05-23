# Prisma (`backend/prisma`)

Prisma CLI assets and database seeders. Runtime Nest access is in **`src/database/prisma/`** (separate folder).

---

## CLI layout

| Path | Role |
| ---- | ---- |
| `schema.prisma` | Data model (status fields are `String`; enums in `src/modules/*/enums/`) |
| `migrations/` | SQL migrations |
| `seeder/` | All seed scripts |

---

## Seeder (`seeder/`)

Entry: `npm run db:seed` → `tsx prisma/seeder/main.ts` (see `package.json` → `prisma.seed`).

| File | Role |
| ---- | ---- |
| `main.ts` | Runs all seeders, disconnects client |
| `prisma-client.ts` | Shared `PrismaClient` instance |
| `product.seeder.ts` | Demo products (`wireless-mouse`, `usb-c-cable`, `laptop-stand`) |
| `demo-order.seeder.ts` | Static unpaid demo order |

**Add a seeder:** create `seeder/<name>.seeder.ts`, export `seedX()`, call it from `main.ts`.

---

## Nest runtime (`src/database/prisma/`)

| File | Role |
| ---- | ---- |
| `prisma.module.ts` | `@Global()` module — registered in `AppModule` |
| `prisma.service.ts` | `PrismaClient` connect/disconnect on boot |
| `prisma.extension.ts` | `Prisma.defineExtension` hook (compose when needed) |

Import paths (no barrel `index.ts`):

```typescript
import { PrismaModule } from './database/prisma/prisma.module';
import { PrismaService } from '../../database/prisma/prisma.service';
```

---

## Commands

From `backend/`:

```bash
npm run prisma:generate
npm run prisma:migrate    # dev
npm run prisma:deploy     # production / Docker entry
npm run db:seed
```
