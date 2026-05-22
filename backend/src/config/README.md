# Configuration (`src/config`)

Single source for all environment variables. Modules inject **`AppConfigService`** instead of reading `process.env` or scattered `config.get()` calls.

---

## Files

| File | Role |
| ---- | ---- |
| `configuration.ts` | Loads `.env` into a typed tree (Nest `ConfigModule.load`) |
| `config.types.ts` | TypeScript shapes (`AppConfiguration`) |
| `config.util.ts` | Parsers (`parsePositiveInt`, `parseBool`, …) |
| `app-config.service.ts` | Injectable typed accessors |
| `config.module.ts` | Global `@Module` — import once in `AppModule` |
| `redis-connection.ts` | Shared Redis options for locks / BullMQ |
| `index.ts` | Public exports |

---

## Usage

```typescript
import { AppConfigService } from '../../config';

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

**Bootstrap** (`main.ts`) may call `configuration()` directly before Nest starts (port, CORS).

**Constants** loaded at module init (e.g. `queue.constant.ts`) use `configuration()` once.

---

## Config namespaces

| Key | Contents |
| --- | -------- |
| `app` | `port`, `nodeEnv`, `baseUrl`, `frontendBaseUrl`, `corsOrigins` |
| `database` | `url` |
| `redis` | `host`, `port`, `password`, `prefix` |
| `bullmq` | `queueName`, job retry settings |
| `paypal` | API credentials, currency |
| `mock` | Mock gateway flag, webhook secret, capture delay |
| `order` | Processing / sweep TTLs |
| `inventory` | Reservation TTLs and sweeps |
| `reconciliation` | Sweep interval, batch, lookback |

See `backend/.env.example` for variable names.

---

## Adding a new setting

1. Add env var to `backend/.env.example`
2. Extend `AppConfiguration` in `config.types.ts`
3. Parse in `configuration.ts`
4. Expose via getter on `AppConfigService` if needed
5. Inject `AppConfigService` in the consuming service
