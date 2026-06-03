# Configuration

One place for **all environment variables**. Instead of sprinkling `process.env` or `config.get()` through the codebase, inject `AppConfigService`.

`AppConfigModule` is registered globally in `AppModule`. It is not listed in `modules/feature-modules.ts`.

Copy `backend/.env.example` to `backend/.env` and edit from there.

---

## Files in this folder

| File | Role |
| ---- | ---- |
| `configuration.ts` | Loads `.env` into a typed tree |
| `config.types.ts` | TypeScript shapes (`AppConfiguration`) |
| `config.util.ts` | Parsers (`parsePositiveInt`, `parseBool`, …) |
| `app-config.service.ts` | Injectable getters you use in services |
| `config.module.ts` | Global Nest module — import once in `AppModule` |
| `index.ts` | Public exports |

---

## How to use it

```typescript
import { AppConfigService } from '../../common/config';

@Injectable()
export class ExampleService {
  constructor(private readonly cfg: AppConfigService) {}

  demo() {
    this.cfg.paypal.currency;
    this.cfg.inventory.reservationTtlMs;
    this.cfg.isMockPaymentGateway;
  }
}
```

`main.ts` may call `configuration()` before Nest boots (port, CORS).

BullMQ queue **names** also come from env — see `infrastructure/bullmq/bullmq.constants.ts`.

`DATABASE_URL` is parsed here; the live Prisma client is in `infrastructure/database/prisma/prisma.service.ts`.

---

## What you can read off `AppConfigService`

| Namespace | Examples |
| --------- | -------- |
| `app` | port, nodeEnv, baseUrl, frontendBaseUrl, corsOrigins |
| `database` | `url` |
| `redis` | host, port, password, prefix |
| `bullmq` | queue names, retry settings |
| `paypal` | credentials, currency |
| `mock` | mock gateway flag, webhook secret, capture delay |
| `order` | processing TTLs and sweeps |
| `inventory` | reservation TTLs and sweeps |
| `reconciliation` | sweep interval, batch size, lookback |

Variable names match `backend/.env.example`.

---

## Adding a new setting

1. Add the env var to `backend/.env.example` with a short comment.
2. Extend `AppConfiguration` in `config.types.ts`.
3. Parse it in `configuration.ts`.
4. Add a getter on `AppConfigService` if other code needs it.
5. Inject `AppConfigService` where you use it.

---

## Related

- [Infrastructure](../infrastructure/README.md) — Redis, BullMQ
- [Prisma & seeder](../../prisma/README.md)
- [Project README](../../../README.md)
